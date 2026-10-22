from decimal import Decimal

import logging
import re

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    status,
)
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import SessionLocal, get_db
from app.models.investment_fund import InvestmentFund
from app.services.funds_explorer import FundsExplorerError, fetch_fund

router = APIRouter(prefix="/investment-funds", tags=["investment-funds"])
logger = logging.getLogger(__name__)


class InvestmentFundPayload(BaseModel):
    ticker: str = Field(min_length=1, max_length=10)
    name: str = Field(min_length=1, max_length=255)
    sector: str | None = Field(default=None, max_length=100)
    latest_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    annual_dividend_yield: Decimal | None = Field(
        default=None, ge=0, max_digits=8, decimal_places=6
    )


class InvestmentFundResponse(InvestmentFundPayload):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PaginationResponse(BaseModel):
    page: int
    limit: int
    total_items: int
    total_pages: int


class InvestmentFundTotals(BaseModel):
    total_funds: int
    funds_with_price: int
    funds_with_dividend_yield: int


class InvestmentFundListResponse(BaseModel):
    items: list[InvestmentFundResponse]
    pagination: PaginationResponse
    totals: InvestmentFundTotals


class BulkDeletePayload(BaseModel):
    ids: list[int] = Field(min_length=1)


class FundImportQueuedResponse(BaseModel):
    detail: str
    tickers: list[str]
    source: str


class FundsExplorerImportPayload(BaseModel):
    tickers: list[str] = Field(min_length=1, max_length=5)

    @field_validator("tickers")
    @classmethod
    def normalize_tickers(cls, tickers: list[str]) -> list[str]:
        normalized_tickers = list(
            dict.fromkeys(ticker.strip().upper() for ticker in tickers if ticker.strip())
        )
        if not normalized_tickers:
            raise ValueError("Informe ao menos um ticker.")
        if len(normalized_tickers) > 5:
            raise ValueError("Informe no máximo cinco tickers por importação.")
        if any(
            not re.fullmatch(r"[A-Z0-9]{1,10}", ticker)
            for ticker in normalized_tickers
        ):
            raise ValueError("Informe tickers válidos, como HGLG11 ou MXRF11.")
        return normalized_tickers


def get_fund_or_404(fund_id: int, db: Session) -> InvestmentFund:
    fund = db.get(InvestmentFund, fund_id)
    if fund is None:
        raise HTTPException(status_code=404, detail="Fundo imobiliário não encontrado.")
    return fund


def create_fund_from_explorer(ticker: str) -> None:
    try:
        explorer_fund = fetch_fund(ticker, settings.funds_explorer_base_url)
        with SessionLocal() as db:
            fund = db.scalar(
                select(InvestmentFund).where(
                    InvestmentFund.ticker == explorer_fund.ticker
                )
            )
            if fund is not None:
                logger.info("Funds Explorer import skipped for existing FII %s", ticker)
                return

            fund = InvestmentFund(
                ticker=explorer_fund.ticker,
                name=explorer_fund.name,
                sector=explorer_fund.sector,
                latest_price=explorer_fund.latest_price,
                annual_dividend_yield=explorer_fund.annual_dividend_yield,
            )
            db.add(fund)
            db.commit()
    except FundsExplorerError as error:
        logger.warning("Funds Explorer import failed for %s: %s", ticker, error)
    except Exception:
        logger.exception("Unexpected Funds Explorer import failure for %s", ticker)


def import_funds_from_explorer(tickers: list[str]) -> None:
    for ticker in tickers:
        create_fund_from_explorer(ticker)


@router.post(
    "/import/funds-explorer",
    response_model=FundImportQueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def import_investment_funds_from_explorer(
    payload: FundsExplorerImportPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> FundImportQueuedResponse:
    existing_tickers = list(
        db.scalars(
            select(InvestmentFund.ticker).where(
                InvestmentFund.ticker.in_(payload.tickers)
            )
        )
    )
    if existing_tickers:
        tickers = ", ".join(existing_tickers)
        raise HTTPException(
            status_code=409,
            detail=f"O FII {tickers} já está cadastrado na base.",
        )

    background_tasks.add_task(import_funds_from_explorer, payload.tickers)
    return FundImportQueuedResponse(
        detail=(
            f"Consulta de {len(payload.tickers)} FII(s) agendada no Funds Explorer "
            "em segundo plano."
        ),
        tickers=payload.tickers,
        source="funds_explorer",
    )


@router.get("", response_model=InvestmentFundListResponse)
def list_investment_funds(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    search: str = Query(default="", max_length=255),
    db: Session = Depends(get_db),
) -> InvestmentFundListResponse:
    normalized_search = search.strip()
    filters = ()
    if normalized_search:
        pattern = f"%{normalized_search}%"
        filters = (
            or_(
                InvestmentFund.ticker.ilike(pattern),
                InvestmentFund.name.ilike(pattern),
                InvestmentFund.sector.ilike(pattern),
            ),
        )

    total_funds, funds_with_price, funds_with_dividend_yield = db.execute(
        select(
            func.count(InvestmentFund.id),
            func.count(InvestmentFund.latest_price),
            func.count(InvestmentFund.annual_dividend_yield),
        ).where(*filters)
    ).one()
    total_pages = max(1, (total_funds + limit - 1) // limit)
    items = list(
        db.scalars(
            select(InvestmentFund)
            .where(*filters)
            .order_by(InvestmentFund.ticker)
            .offset((page - 1) * limit)
            .limit(limit)
        )
    )
    return InvestmentFundListResponse(
        items=items,
        pagination=PaginationResponse(
            page=page,
            limit=limit,
            total_items=total_funds,
            total_pages=total_pages,
        ),
        totals=InvestmentFundTotals(
            total_funds=total_funds,
            funds_with_price=funds_with_price,
            funds_with_dividend_yield=funds_with_dividend_yield,
        ),
    )


@router.post("", response_model=InvestmentFundResponse, status_code=status.HTTP_201_CREATED)
def create_investment_fund(
    payload: InvestmentFundPayload, db: Session = Depends(get_db)
) -> InvestmentFund:
    fund_data = payload.model_dump()
    fund_data["ticker"] = payload.ticker.upper()
    existing_fund = db.scalar(
        select(InvestmentFund).where(InvestmentFund.ticker == fund_data["ticker"])
    )
    if existing_fund is not None:
        raise HTTPException(
            status_code=409,
            detail=f"O FII {fund_data['ticker']} já está cadastrado na base.",
        )

    fund = InvestmentFund(**fund_data)
    db.add(fund)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail=f"O FII {fund_data['ticker']} já está cadastrado na base.",
        ) from error
    db.refresh(fund)
    return fund


@router.put("/{fund_id}", response_model=InvestmentFundResponse)
def update_investment_fund(
    fund_id: int, payload: InvestmentFundPayload, db: Session = Depends(get_db)
) -> InvestmentFund:
    fund = get_fund_or_404(fund_id, db)
    for field, value in payload.model_dump().items():
        setattr(fund, field, value.upper() if field == "ticker" else value)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Já existe um fundo com este ticker."
        ) from error
    db.refresh(fund)
    return fund


@router.delete("/{fund_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investment_fund(fund_id: int, db: Session = Depends(get_db)) -> None:
    fund = get_fund_or_404(fund_id, db)
    db.delete(fund)
    db.commit()


@router.delete("")
def delete_investment_funds(
    payload: BulkDeletePayload, db: Session = Depends(get_db)
) -> dict[str, int]:
    deleted_count = db.query(InvestmentFund).filter(
        InvestmentFund.id.in_(payload.ids)
    ).delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": deleted_count}
