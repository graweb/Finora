from datetime import datetime
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
from app.models.investment_policy import InvestmentPolicy
from app.services.dividend_events import upsert_dividend_events
from app.services.fund_cache import (
    cache_fund,
    cache_recommendation,
    clear_portfolio_dashboard_cache,
    clear_fund_cache,
    create_fund_sync_job,
    finish_fund_refresh,
    FundCacheError,
    get_cached_fund,
    get_cached_recommendation,
    get_fund_sync_job,
    is_fund_refreshing,
    schedule_fund_refresh,
    finish_fund_sync_job,
    update_fund_sync_job,
)
from app.services.funds_explorer import FundsExplorerError, fetch_fund
from app.services.investment_policy import get_or_create_investment_policy

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
    updated_at: datetime
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
    ids: list[int] = Field(min_length=1)


class FundImportQueuedResponse(BaseModel):
    detail: str
    tickers: list[str]
    source: str
    job_id: str | None = None


class FundSyncJobResponse(BaseModel):
    status: str
    total: int
    processed: int
    failed: int


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
                average_daily_liquidity=explorer_fund.average_daily_liquidity,
            )
            db.add(fund)
            db.commit()
            upsert_dividend_events(db, fund, explorer_fund.dividend_events)
            db.commit()
            clear_portfolio_dashboard_cache()
    except FundsExplorerError as error:
        logger.warning("Funds Explorer import failed for %s: %s", ticker, error)
    except Exception:
        logger.exception("Unexpected Funds Explorer import failure for %s", ticker)


def import_funds_from_explorer(tickers: list[str]) -> None:
    for ticker in tickers:
        create_fund_from_explorer(ticker)


def sync_fund_from_explorer(ticker: str) -> bool:
    try:
        explorer_fund = fetch_fund(ticker, settings.funds_explorer_base_url)
        cache_fund(explorer_fund)
        with SessionLocal() as db:
            fund = db.scalar(
                select(InvestmentFund).where(InvestmentFund.ticker == ticker)
            )
            if fund is None:
                logger.info("Funds Explorer sync skipped for missing FII %s", ticker)
                return False
            fund.name = explorer_fund.name
            fund.sector = explorer_fund.sector
            fund.latest_price = explorer_fund.latest_price
            fund.annual_dividend_yield = explorer_fund.annual_dividend_yield
            fund.average_daily_liquidity = explorer_fund.average_daily_liquidity
            upsert_dividend_events(db, fund, explorer_fund.dividend_events)
            db.commit()
            clear_portfolio_dashboard_cache()
            return True
    except FundsExplorerError as error:
        logger.warning("Funds Explorer sync failed for %s: %s", ticker, error)
    except Exception:
        logger.exception("Unexpected Funds Explorer sync failure for %s", ticker)
    return False


def sync_funds_from_explorer(tickers: list[str], job_id: str) -> None:
    for ticker in tickers:
        succeeded = sync_fund_from_explorer(ticker)
        update_fund_sync_job(job_id, succeeded=succeeded)
    finish_fund_sync_job(job_id)


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


def _fund_category(sector: str) -> str:
    normalized_sector = sector.casefold()
    if "papel" in normalized_sector or "receb" in normalized_sector:
        return "paper"
    if "híbr" in normalized_sector or "hibr" in normalized_sector or "multi" in normalized_sector:
        return "hybrid"
    return "brick"


def _build_recommendations(
    funds: list[InvestmentFund], desired_income: Decimal, policy: InvestmentPolicy
) -> tuple[list[InvestmentFundRecommendation], Decimal | None, Decimal | None, Decimal | None, list[str]]:
    candidates: list[dict[str, object]] = []
    uncached_tickers: list[str] = []

    for fund in funds:
        cached_fund = get_cached_fund(fund.ticker)
        if cached_fund is None or cached_fund.average_daily_liquidity is None:
            uncached_tickers.append(fund.ticker)

        latest_price = (
            cached_fund.latest_price if cached_fund else fund.latest_price
        )
        annual_yield = (
            cached_fund.annual_dividend_yield
            if cached_fund
            else fund.annual_dividend_yield
        )
        average_daily_liquidity = (
            cached_fund.average_daily_liquidity
            if cached_fund
            else fund.average_daily_liquidity
        )
        if latest_price is None or latest_price <= 0 or annual_yield is None or annual_yield <= 0:
            continue

        sector = (cached_fund.sector if cached_fund else fund.sector) or "Não informado"
        category = _fund_category(sector)
        if sector in (policy.excluded_sectors or []):
            continue
        if (
            (category == "paper" and not policy.include_paper)
            or (category == "brick" and not policy.include_brick)
            or (category == "hybrid" and not policy.include_hybrid)
        ):
            continue

        candidates.append(
            {
                "ticker": fund.ticker,
                "name": cached_fund.name if cached_fund else fund.name,
                "sector": sector,
                "latest_price": latest_price,
                "annual_yield": annual_yield,
                "average_daily_liquidity": average_daily_liquidity,
                "source": "redis" if cached_fund else "database",
            }
        )

    if not candidates:
        return [], None, None, None, uncached_tickers

    highest_yield = max(Decimal(item["annual_yield"]) for item in candidates)
    highest_liquidity = max(
        (Decimal(item["average_daily_liquidity"] or 0) for item in candidates),
        default=Decimal("0"),
    )
    funds_per_sector: dict[str, int] = {}
    for item in candidates:
        sector = str(item["sector"])
        funds_per_sector[sector] = funds_per_sector.get(sector, 0) + 1

    for item in candidates:
        annual_yield = Decimal(item["annual_yield"])
        sector = str(item["sector"])
        yield_score = (annual_yield / highest_yield) * Decimal(policy.dividend_yield_weight)
        diversification_score = Decimal(policy.diversification_weight) / funds_per_sector[sector]
        liquidity = Decimal(item["average_daily_liquidity"] or 0)
        liquidity_score = (
            (liquidity / highest_liquidity) * Decimal(policy.liquidity_weight)
            if highest_liquidity > 0
            else Decimal("0")
        )
        item["score"] = int(
            (yield_score + diversification_score + liquidity_score).quantize(Decimal("1"))
        )

    ranked = sorted(candidates, key=lambda item: int(item["score"]), reverse=True)
    selected: list[dict[str, object]] = []
    selected_sectors: set[str] = set()
    for item in ranked:
        sector = str(item["sector"])
        if sector not in selected_sectors:
            selected.append(item)
            selected_sectors.add(sector)
        if len(selected_sectors) >= policy.min_sectors:
            break
    minimum_funds = max(10, int((Decimal("100") / Decimal(policy.max_fund_percentage)).to_integral_value(rounding="ROUND_CEILING")))
    for item in ranked:
        if item not in selected:
            selected.append(item)
        if len(selected) >= minimum_funds:
            break
    total_score = sum(Decimal(int(item["score"])) for item in selected)
    if total_score <= 0:
        return [], None, None, None, uncached_tickers

    max_fund_weight = Decimal(policy.max_fund_percentage) / Decimal("100")
    max_sector_weight = Decimal(policy.max_sector_percentage) / Decimal("100")
    sector_weights: dict[str, Decimal] = {}
    remaining_weight = Decimal("1")
    for item in selected:
        item["allocation_weight"] = Decimal("0")
    while remaining_weight > Decimal("0.000001"):
        eligible = [
            item
            for item in selected
            if Decimal(item["allocation_weight"]) < max_fund_weight
            and sector_weights.get(str(item["sector"]), Decimal("0")) < max_sector_weight
        ]
        if not eligible:
            break
        eligible_score = sum(Decimal(int(item["score"])) for item in eligible)
        allocated_this_round = Decimal("0")
        for item in eligible:
            sector = str(item["sector"])
            remaining_fund = max_fund_weight - Decimal(item["allocation_weight"])
            remaining_sector = max_sector_weight - sector_weights.get(sector, Decimal("0"))
            proposed = remaining_weight * Decimal(int(item["score"])) / eligible_score
            allocated = min(proposed, remaining_fund, remaining_sector)
            if allocated <= 0:
                continue
            item["allocation_weight"] = Decimal(item["allocation_weight"]) + allocated
            sector_weights[sector] = sector_weights.get(sector, Decimal("0")) + allocated
            allocated_this_round += allocated
        if allocated_this_round <= 0:
            break
        remaining_weight -= allocated_this_round

    selected = [item for item in selected if Decimal(item["allocation_weight"]) > 0]
    if not selected:
        return [], None, None, None, uncached_tickers
    for item in selected:
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
    ) = _build_recommendations(
        funds, desired_income, get_or_create_investment_policy(db)
    )
    scheduled_tickers = schedule_fund_refresh(uncached_tickers)
    if scheduled_tickers:
        background_tasks.add_task(refresh_fund_cache, scheduled_tickers)
    refreshing_tickers = [
        ticker for ticker in uncached_tickers if is_fund_refreshing(ticker)
    ]

    response = InvestmentFundRecommendationResponse(
        desired_income=desired_income,
        required_capital=required_capital,
        annual_yield=annual_yield,
        monthly_yield=monthly_yield,
        recommendations=recommendations,
        refreshing_tickers=refreshing_tickers,
    )
    cache_recommendation(response.model_dump(mode="json"))
    clear_portfolio_dashboard_cache()
    return response


@router.get(
    "/recommendations/cached",
    response_model=InvestmentFundRecommendationResponse,
)
def get_cached_investment_fund_recommendations() -> InvestmentFundRecommendationResponse:
    cached_recommendation = get_cached_recommendation()
    if cached_recommendation is None:
        raise HTTPException(status_code=404, detail="Nenhuma recomendação em cache.")
    return InvestmentFundRecommendationResponse.model_validate(cached_recommendation)


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
    try:
        job_id = create_fund_sync_job(tickers)
    except FundCacheError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    background_tasks.add_task(sync_funds_from_explorer, tickers, job_id)
    return FundImportQueuedResponse(
        detail=(
            f"Atualização de {len(tickers)} FII(s) agendada no Funds Explorer "
            "em segundo plano."
        ),
        tickers=tickers,
        source="funds_explorer",
        job_id=job_id,
    )


@router.get(
    "/sync/funds-explorer/{job_id}", response_model=FundSyncJobResponse
)
def get_investment_fund_sync_status(job_id: str) -> FundSyncJobResponse:
    try:
        job = get_fund_sync_job(job_id)
    except FundCacheError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
    if job is None:
        raise HTTPException(status_code=404, detail="Atualização não encontrada.")
    return FundSyncJobResponse(**job)


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
    clear_portfolio_dashboard_cache()
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
    clear_portfolio_dashboard_cache()
    return fund


@router.delete("/{fund_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_investment_fund(fund_id: int, db: Session = Depends(get_db)) -> None:
    fund = get_fund_or_404(fund_id, db)
    db.delete(fund)
    db.commit()
    clear_portfolio_dashboard_cache()


@router.delete("")
def delete_investment_funds(
    payload: BulkDeletePayload, db: Session = Depends(get_db)
) -> dict[str, int]:
    deleted_count = db.query(InvestmentFund).filter(
        InvestmentFund.id.in_(payload.ids)
    ).delete(synchronize_session=False)
    db.commit()
    clear_portfolio_dashboard_cache()
    return {"deleted_count": deleted_count}
