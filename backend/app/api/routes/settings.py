from decimal import Decimal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_fund import InvestmentFund
from app.models.investment_policy import InvestmentPolicy
from app.services.fund_cache import clear_portfolio_dashboard_cache, clear_recommendation_cache
from app.services.investment_policy import get_or_create_investment_policy

router = APIRouter(prefix="/settings", tags=["settings"])


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
