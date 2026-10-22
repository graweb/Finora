from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_fund import InvestmentFund

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


def get_fund_or_404(fund_id: int, db: Session) -> InvestmentFund:
    fund = db.get(InvestmentFund, fund_id)
    if fund is None:
        raise HTTPException(status_code=404, detail="Fundo imobiliário não encontrado.")
    return fund


@router.get("", response_model=list[InvestmentFundResponse])
def list_investment_funds(db: Session = Depends(get_db)) -> list[InvestmentFund]:
    return list(db.scalars(select(InvestmentFund).order_by(InvestmentFund.ticker)))


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
