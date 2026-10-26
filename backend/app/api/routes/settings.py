from decimal import Decimal

from datetime import UTC, datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_fund import InvestmentFund
from app.models.investment_policy import InvestmentPolicy
from app.services.fund_cache import (
    FundCacheError,
    append_integration_sync_history,
    clear_cached_funds,
    clear_fund_cache,
    clear_portfolio_dashboard_cache,
    clear_recommendation_cache,
    create_fund_sync_job,
    get_integration_cache_status,
)
from app.api.routes.investment_funds import sync_funds_from_explorer
from app.services.investment_policy import get_or_create_investment_policy

router = APIRouter(prefix="/settings", tags=["settings"])


class IntegrationHistoryItem(BaseModel):
    created_at: str
    total: int
    status: str


class IntegrationStatusResponse(BaseModel):
    redis_online: bool
    cached_funds: int
    fund_cache_ttl: int
    recommendation_ttl: int
    total_funds: int
    history: list[IntegrationHistoryItem]


class IntegrationSyncResponse(BaseModel):
    job_id: str
    total: int


class InvestmentPolicyPayload(BaseModel):
    max_sector_percentage: Decimal = Field(ge=1, le=100, max_digits=5, decimal_places=2)
    max_fund_percentage: Decimal = Field(ge=1, le=100, max_digits=5, decimal_places=2)
    min_sectors: int = Field(ge=1, le=50)
    include_paper: bool
    include_brick: bool
    include_hybrid: bool
    excluded_sectors: list[str] = Field(default_factory=list, max_length=50)
    dividend_yield_weight: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    diversification_weight: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    liquidity_weight: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)

    @model_validator(mode="after")
    def validate_policy(self) -> "InvestmentPolicyPayload":
        if not (self.include_paper or self.include_brick or self.include_hybrid):
            raise ValueError("Selecione ao menos um tipo de FII elegível.")
        if (
            self.dividend_yield_weight
            + self.diversification_weight
            + self.liquidity_weight
            != Decimal("100")
        ):
            raise ValueError("Os pesos dos critérios devem somar 100%.")
        self.excluded_sectors = list(
            dict.fromkeys(sector.strip() for sector in self.excluded_sectors if sector.strip())
        )
        return self


class InvestmentPolicyResponse(InvestmentPolicyPayload):
    available_sectors: list[str]


def serialize_policy(policy: InvestmentPolicy, db: Session) -> InvestmentPolicyResponse:
    sectors = list(
        db.scalars(
            select(InvestmentFund.sector)
            .where(InvestmentFund.sector.is_not(None))
            .distinct()
            .order_by(InvestmentFund.sector)
        )
    )
    return InvestmentPolicyResponse(
        max_sector_percentage=policy.max_sector_percentage,
        max_fund_percentage=policy.max_fund_percentage,
        min_sectors=policy.min_sectors,
        include_paper=policy.include_paper,
        include_brick=policy.include_brick,
        include_hybrid=policy.include_hybrid,
        excluded_sectors=policy.excluded_sectors or [],
        dividend_yield_weight=policy.dividend_yield_weight,
        diversification_weight=policy.diversification_weight,
        liquidity_weight=policy.liquidity_weight,
        available_sectors=[sector for sector in sectors if sector],
    )


@router.get("/investment-policy", response_model=InvestmentPolicyResponse)
def get_investment_policy(db: Session = Depends(get_db)) -> InvestmentPolicyResponse:
    return serialize_policy(get_or_create_investment_policy(db), db)


@router.put("/investment-policy", response_model=InvestmentPolicyResponse)
def update_investment_policy(
    payload: InvestmentPolicyPayload, db: Session = Depends(get_db)
) -> InvestmentPolicyResponse:
    policy = get_or_create_investment_policy(db)
    for field, value in payload.model_dump().items():
        setattr(policy, field, value)
    db.commit()
    db.refresh(policy)
    clear_recommendation_cache()
    clear_portfolio_dashboard_cache()
    return serialize_policy(policy, db)


@router.get("/integrations", response_model=IntegrationStatusResponse)
def get_integrations_status(db: Session = Depends(get_db)) -> IntegrationStatusResponse:
    cache_status = get_integration_cache_status()
    return IntegrationStatusResponse(
        **cache_status,
        total_funds=int(db.scalar(select(func.count(InvestmentFund.id))) or 0),
    )


@router.post("/integrations/sync", response_model=IntegrationSyncResponse, status_code=status.HTTP_202_ACCEPTED)
def sync_all_integrations(
    background_tasks: BackgroundTasks, db: Session = Depends(get_db)
) -> IntegrationSyncResponse:
    tickers = list(db.scalars(select(InvestmentFund.ticker).order_by(InvestmentFund.ticker)))
    if not tickers:
        raise HTTPException(status_code=400, detail="Não há FIIs cadastrados para sincronizar.")
    try:
        job_id = create_fund_sync_job(tickers)
    except FundCacheError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error

    def sync_and_record() -> None:
        sync_funds_from_explorer(tickers, job_id)
        append_integration_sync_history(
            {"created_at": datetime.now(UTC).isoformat(), "total": len(tickers), "status": "Concluído"}
        )

    background_tasks.add_task(sync_and_record)
    return IntegrationSyncResponse(job_id=job_id, total=len(tickers))


@router.delete("/integrations/cache/funds")
def clear_integrations_fund_cache() -> dict[str, int]:
    try:
        return {"deleted_count": clear_cached_funds()}
    except FundCacheError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@router.delete("/integrations/cache/recommendations")
def clear_integrations_recommendation_cache() -> dict[str, bool]:
    clear_recommendation_cache()
    return {"cleared": True}


@router.delete("/integrations/cache")
def clear_integrations_cache() -> dict[str, int]:
    try:
        return {"deleted_count": clear_fund_cache()}
    except FundCacheError as error:
        raise HTTPException(status_code=503, detail=str(error)) from error
