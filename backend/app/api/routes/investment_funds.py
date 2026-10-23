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
from app.services.fund_cache import (
    cache_fund,
    clear_fund_cache,
    finish_fund_refresh,
    FundCacheError,
    get_cached_fund,
    is_fund_refreshing,
    schedule_fund_refresh,
)
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


class InvestmentFundRecommendation(BaseModel):
    ticker: str
    name: str
    sector: str
    latest_price: Decimal
    annual_dividend_yield: Decimal
    monthly_yield: Decimal
    score: int
    allocation_weight: Decimal
    allocation_amount: Decimal
    estimated_monthly_income: Decimal
    source: str


class InvestmentFundRecommendationResponse(BaseModel):
    desired_income: Decimal
    required_capital: Decimal | None
    annual_yield: Decimal | None
    monthly_yield: Decimal | None
    recommendations: list[InvestmentFundRecommendation]
    refreshing_tickers: list[str]


class FundCacheClearResponse(BaseModel):
    deleted_count: int


class BulkDeletePayload(BaseModel):
    ids: list[int] = Field(min_length=1)


class FundsExplorerSyncPayload(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=5)


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
        cache_fund(explorer_fund)
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


def sync_fund_from_explorer(ticker: str) -> None:
    try:
        explorer_fund = fetch_fund(ticker, settings.funds_explorer_base_url)
        cache_fund(explorer_fund)
        with SessionLocal() as db:
            fund = db.scalar(
                select(InvestmentFund).where(InvestmentFund.ticker == ticker)
            )
            if fund is None:
                logger.info("Funds Explorer sync skipped for missing FII %s", ticker)
                return
            fund.name = explorer_fund.name
            fund.sector = explorer_fund.sector
            fund.latest_price = explorer_fund.latest_price
            fund.annual_dividend_yield = explorer_fund.annual_dividend_yield
            db.commit()
    except FundsExplorerError as error:
        logger.warning("Funds Explorer sync failed for %s: %s", ticker, error)
    except Exception:
        logger.exception("Unexpected Funds Explorer sync failure for %s", ticker)


def sync_funds_from_explorer(tickers: list[str]) -> None:
    for ticker in tickers:
        sync_fund_from_explorer(ticker)


def refresh_fund_cache(tickers: list[str]) -> None:
    for ticker in tickers:
        try:
            cache_fund(fetch_fund(ticker, settings.funds_explorer_base_url))
        except FundsExplorerError as error:
            logger.warning("Funds Explorer cache refresh failed for %s: %s", ticker, error)
        except Exception:
            logger.exception("Unexpected Funds Explorer cache refresh failure for %s", ticker)
        finally:
            finish_fund_refresh(ticker)


def _monthly_yield(annual_yield: Decimal) -> Decimal:
    return Decimal(str((1 + float(annual_yield)) ** (1 / 12) - 1))


def _build_recommendations(
    funds: list[InvestmentFund], desired_income: Decimal
) -> tuple[list[InvestmentFundRecommendation], Decimal | None, Decimal | None, Decimal | None, list[str]]:
    candidates: list[dict[str, object]] = []
    uncached_tickers: list[str] = []

    for fund in funds:
        cached_fund = get_cached_fund(fund.ticker)
        if cached_fund is None:
            uncached_tickers.append(fund.ticker)

        latest_price = (
            cached_fund.latest_price if cached_fund else fund.latest_price
        )
        annual_yield = (
            cached_fund.annual_dividend_yield
            if cached_fund
            else fund.annual_dividend_yield
        )
        if latest_price is None or latest_price <= 0 or annual_yield is None or annual_yield <= 0:
            continue

        candidates.append(
            {
                "ticker": fund.ticker,
                "name": cached_fund.name if cached_fund else fund.name,
                "sector": (cached_fund.sector if cached_fund else fund.sector)
                or "Não informado",
                "latest_price": latest_price,
                "annual_yield": annual_yield,
                "source": "redis" if cached_fund else "database",
            }
        )

    if not candidates:
        return [], None, None, None, uncached_tickers

    highest_yield = max(Decimal(item["annual_yield"]) for item in candidates)
    funds_per_sector: dict[str, int] = {}
    for item in candidates:
        sector = str(item["sector"])
        funds_per_sector[sector] = funds_per_sector.get(sector, 0) + 1

    for item in candidates:
        annual_yield = Decimal(item["annual_yield"])
        sector = str(item["sector"])
        yield_score = (annual_yield / highest_yield) * Decimal("60")
        diversification_score = Decimal("25") / funds_per_sector[sector]
        freshness_score = Decimal("15") if item["source"] == "redis" else Decimal("5")
        item["score"] = int(
            (yield_score + diversification_score + freshness_score).quantize(Decimal("1"))
        )

    selected = sorted(candidates, key=lambda item: int(item["score"]), reverse=True)[:10]
    total_score = sum(Decimal(int(item["score"])) for item in selected)
    if total_score <= 0:
        return [], None, None, None, uncached_tickers

    for item in selected:
        item["allocation_weight"] = Decimal(int(item["score"])) / total_score
        item["monthly_yield"] = _monthly_yield(Decimal(item["annual_yield"]))

    monthly_yield = sum(
        Decimal(item["allocation_weight"]) * Decimal(item["monthly_yield"])
        for item in selected
    )
    annual_yield = sum(
        Decimal(item["allocation_weight"]) * Decimal(item["annual_yield"])
        for item in selected
    )
    required_capital = desired_income / monthly_yield if monthly_yield > 0 else None

    recommendations = [
        InvestmentFundRecommendation(
            ticker=str(item["ticker"]),
            name=str(item["name"]),
            sector=str(item["sector"]),
            latest_price=Decimal(item["latest_price"]),
            annual_dividend_yield=Decimal(item["annual_yield"]),
            monthly_yield=Decimal(item["monthly_yield"]),
            score=int(item["score"]),
            allocation_weight=Decimal(item["allocation_weight"]),
            allocation_amount=(required_capital or Decimal("0"))
            * Decimal(item["allocation_weight"]),
            estimated_monthly_income=desired_income
            * Decimal(item["allocation_weight"]),
            source=str(item["source"]),
        )
        for item in selected
    ]
    return recommendations, required_capital, annual_yield, monthly_yield, uncached_tickers


@router.get("/recommendations", response_model=InvestmentFundRecommendationResponse)
def get_investment_fund_recommendations(
    background_tasks: BackgroundTasks,
    desired_income: Decimal = Query(gt=0, max_digits=12, decimal_places=2),
    db: Session = Depends(get_db),
) -> InvestmentFundRecommendationResponse:
    funds = list(db.scalars(select(InvestmentFund).order_by(InvestmentFund.ticker)))
    (
        recommendations,
        required_capital,
        annual_yield,
        monthly_yield,
        uncached_tickers,
    ) = _build_recommendations(funds, desired_income)
    scheduled_tickers = schedule_fund_refresh(uncached_tickers)
    if scheduled_tickers:
        background_tasks.add_task(refresh_fund_cache, scheduled_tickers)
    refreshing_tickers = [
        ticker for ticker in uncached_tickers if is_fund_refreshing(ticker)
    ]

    return InvestmentFundRecommendationResponse(
        desired_income=desired_income,
        required_capital=required_capital,
        annual_yield=annual_yield,
        monthly_yield=monthly_yield,
        recommendations=recommendations,
        refreshing_tickers=refreshing_tickers,
    )


@router.delete("/cache", response_model=FundCacheClearResponse)
def clear_investment_fund_cache() -> FundCacheClearResponse:
    try:
        deleted_count = clear_fund_cache()
    except FundCacheError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    return FundCacheClearResponse(deleted_count=deleted_count)


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


@router.post(
    "/sync/funds-explorer",
    response_model=FundImportQueuedResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def sync_investment_funds_from_explorer(
    payload: FundsExplorerSyncPayload,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
) -> FundImportQueuedResponse:
    funds = list(
        db.scalars(select(InvestmentFund).where(InvestmentFund.id.in_(payload.ids)))
    )
    if len(funds) != len(set(payload.ids)):
        raise HTTPException(
            status_code=404,
            detail="Um ou mais fundos selecionados não foram encontrados.",
        )

    tickers = [fund.ticker for fund in funds]
    background_tasks.add_task(sync_funds_from_explorer, tickers)
    return FundImportQueuedResponse(
        detail=(
            f"Atualização de {len(tickers)} FII(s) agendada no Funds Explorer "
            "em segundo plano."
        ),
        tickers=tickers,
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
