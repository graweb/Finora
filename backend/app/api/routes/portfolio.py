from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.investment_fund import InvestmentFund
from app.models.portfolio_transaction import PortfolioTransaction

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


class PortfolioTransactionPayload(BaseModel):
    investment_fund_id: int
    transaction_type: Literal["buy", "sell"]
    unit_price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    quantity: int = Field(gt=0)
    occurred_on: date


class PortfolioTransactionResponse(PortfolioTransactionPayload):
    id: int
    total_amount: Decimal


class PortfolioTransactionDeletePayload(BaseModel):
    ids: list[int] = Field(min_length=1)


class PortfolioPosition(BaseModel):
    fund_id: int
    ticker: str
    name: str
    sector: str
    total_quantity: int
    total_value: Decimal
    transactions: list[PortfolioTransactionResponse]


class PortfolioTotals(BaseModel):
    total_value: Decimal
    total_funds: int


class PortfolioResponse(BaseModel):
    items: list[PortfolioPosition]
    totals: PortfolioTotals
    page: int
    limit: int
    total_items: int
    total_pages: int


def transaction_sign(transaction_type: str) -> int:
    return 1 if transaction_type == "buy" else -1


@router.get("", response_model=PortfolioResponse)
def list_portfolio(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PortfolioResponse:
    rows = db.execute(
        select(
            InvestmentFund.id,
            InvestmentFund.ticker,
            InvestmentFund.name,
            InvestmentFund.sector,
            PortfolioTransaction,
        )
        .join(
            PortfolioTransaction,
            PortfolioTransaction.investment_fund_id == InvestmentFund.id,
        )
        .order_by(
            InvestmentFund.ticker,
            PortfolioTransaction.occurred_on.desc(),
            PortfolioTransaction.id.desc(),
        )
    ).all()
    positions: dict[int, PortfolioPosition] = {}
    for fund_id, ticker, name, sector, transaction in rows:
        position = positions.setdefault(
            fund_id,
            PortfolioPosition(
                fund_id=fund_id,
                ticker=ticker,
                name=name,
                sector=sector or "Não informado",
                total_quantity=0,
                total_value=Decimal("0"),
                transactions=[],
            ),
        )
        sign = transaction_sign(transaction.transaction_type)
        position.total_quantity += sign * transaction.quantity
        position.total_value += sign * transaction.total_amount
        position.transactions.append(
            PortfolioTransactionResponse(
                id=transaction.id,
                investment_fund_id=transaction.investment_fund_id,
                transaction_type=transaction.transaction_type,
                unit_price=transaction.unit_price,
                quantity=transaction.quantity,
                total_amount=transaction.total_amount,
                occurred_on=transaction.occurred_on,
            )
        )

    all_positions = list(positions.values())
    total_items = len(all_positions)
    total_pages = max(1, (total_items + limit - 1) // limit)
    return PortfolioResponse(
        items=all_positions[(page - 1) * limit : page * limit],
        totals=PortfolioTotals(
            total_value=sum(
                (position.total_value for position in all_positions), Decimal("0")
            ),
            total_funds=total_items,
        ),
        page=page,
        limit=limit,
        total_items=total_items,
        total_pages=total_pages,
    )


@router.post(
    "/transactions",
    response_model=PortfolioTransactionResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_portfolio_transaction(
    payload: PortfolioTransactionPayload, db: Session = Depends(get_db)
) -> PortfolioTransactionResponse:
    if db.get(InvestmentFund, payload.investment_fund_id) is None:
        raise HTTPException(status_code=404, detail="FII não encontrado.")
    transaction = PortfolioTransaction(
        **payload.model_dump(),
        total_amount=payload.unit_price * payload.quantity,
    )
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return PortfolioTransactionResponse(
        id=transaction.id,
        investment_fund_id=transaction.investment_fund_id,
        transaction_type=transaction.transaction_type,
        unit_price=transaction.unit_price,
        quantity=transaction.quantity,
        total_amount=transaction.total_amount,
        occurred_on=transaction.occurred_on,
    )


@router.put("/transactions/{transaction_id}", response_model=PortfolioTransactionResponse)
def update_portfolio_transaction(
    transaction_id: int,
    payload: PortfolioTransactionPayload,
    db: Session = Depends(get_db),
) -> PortfolioTransactionResponse:
    transaction = db.get(PortfolioTransaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    if db.get(InvestmentFund, payload.investment_fund_id) is None:
        raise HTTPException(status_code=404, detail="FII não encontrado.")

    transaction.investment_fund_id = payload.investment_fund_id
    transaction.transaction_type = payload.transaction_type
    transaction.unit_price = payload.unit_price
    transaction.quantity = payload.quantity
    transaction.total_amount = payload.unit_price * payload.quantity
    transaction.occurred_on = payload.occurred_on
    db.commit()
    db.refresh(transaction)
    return PortfolioTransactionResponse(
        id=transaction.id,
        investment_fund_id=transaction.investment_fund_id,
        transaction_type=transaction.transaction_type,
        unit_price=transaction.unit_price,
        quantity=transaction.quantity,
        total_amount=transaction.total_amount,
        occurred_on=transaction.occurred_on,
    )


@router.delete("/transactions", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_transactions(
    payload: PortfolioTransactionDeletePayload,
    db: Session = Depends(get_db),
) -> None:
    transactions = db.scalars(
        select(PortfolioTransaction).where(PortfolioTransaction.id.in_(payload.ids))
    ).all()
    if len(transactions) != len(set(payload.ids)):
        raise HTTPException(status_code=404, detail="Um ou mais lançamentos não foram encontrados.")
    for transaction in transactions:
        db.delete(transaction)
    db.commit()


@router.delete("/transactions/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_portfolio_transaction(transaction_id: int, db: Session = Depends(get_db)) -> None:
    transaction = db.get(PortfolioTransaction, transaction_id)
    if transaction is None:
        raise HTTPException(status_code=404, detail="Lançamento não encontrado.")
    db.delete(transaction)
    db.commit()
