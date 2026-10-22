from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_fund import InvestmentFund
from app.services.brapi import BrapiError, fetch_fund_quote
from app.core.config import settings

router = APIRouter(prefix="/investment-funds", tags=["investment-funds"])


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


def get_fund_or_404(fund_id: int, db: Session) -> InvestmentFund:
    fund = db.get(InvestmentFund, fund_id)
    if fund is None:
        raise HTTPException(status_code=404, detail="Fundo imobiliário não encontrado.")
    return fund


@router.post("/import/brapi/{ticker}", response_model=InvestmentFundResponse)
def import_investment_fund_from_brapi(
    ticker: str, db: Session = Depends(get_db)
) -> InvestmentFund:
    if not settings.brapi_token:
        raise HTTPException(
            status_code=503,
            detail="Configure BRAPI_TOKEN no backend para importar fundos.",
        )

    try:
        brapi_fund = fetch_fund_quote(
            ticker,
            settings.brapi_token,
            settings.brapi_fii_list_url,
        )
    except BrapiError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error

    fund = db.scalar(
        select(InvestmentFund).where(InvestmentFund.ticker == brapi_fund.ticker)
    )
    if fund is None:
        fund = InvestmentFund(
            ticker=brapi_fund.ticker,
            name=brapi_fund.name,
            sector=brapi_fund.sector,
            latest_price=brapi_fund.latest_price,
            annual_dividend_yield=brapi_fund.annual_dividend_yield,
        )
        db.add(fund)
    else:
        fund.name = brapi_fund.name
        fund.sector = brapi_fund.sector
        fund.latest_price = brapi_fund.latest_price
        fund.annual_dividend_yield = brapi_fund.annual_dividend_yield

    db.commit()
    db.refresh(fund)
    return fund


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
    fund = InvestmentFund(**fund_data)
    db.add(fund)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="Já existe um fundo com este ticker."
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
