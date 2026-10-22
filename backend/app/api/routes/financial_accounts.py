from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import extract, func, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.financial_account import FinancialAccount, FinancialAccountSettlement
from app.models.financial_movement import FinancialMovement

router = APIRouter(prefix="/financial-accounts", tags=["financial-accounts"])


class FinancialAccountPayload(BaseModel):
    counterparty: str = Field(default="", max_length=255)
    account_type: Literal["receivable", "payable"]
    destination: Literal["fisica", "juridica"]
    description: str = Field(min_length=1, max_length=255)
    original_amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    due_on: date


class FinancialAccountSettlementResponse(BaseModel):
    id: int
    amount: Decimal
    occurred_on: date
    model_config = ConfigDict(from_attributes=True)


class FinancialAccountResponse(FinancialAccountPayload):
    id: int
    status: Literal["open", "settled"]
    paid_amount: Decimal
    outstanding_amount: Decimal
    settlements: list[FinancialAccountSettlementResponse]


class PaginationResponse(BaseModel):
    page: int
    limit: int
    total_items: int
    total_pages: int


class FinancialAccountListResponse(BaseModel):
    items: list[FinancialAccountResponse]
    pagination: PaginationResponse


class FinancialAccountSettlementPayload(BaseModel):
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    occurred_on: date


def serialize_account(account: FinancialAccount) -> FinancialAccountResponse:
    paid_amount = sum((settlement.amount for settlement in account.settlements), Decimal("0"))
    outstanding_amount = max(Decimal("0"), account.original_amount - paid_amount)
    return FinancialAccountResponse(
        id=account.id,
        counterparty=account.counterparty,
        account_type=account.account_type,
        destination=account.destination,
        description=account.description,
        original_amount=account.original_amount,
        due_on=account.due_on,
        status="settled" if outstanding_amount == 0 else "open",
        paid_amount=paid_amount,
        outstanding_amount=outstanding_amount,
        settlements=sorted(account.settlements, key=lambda item: (item.occurred_on, item.id), reverse=True),
    )


def get_account_or_404(account_id: int, db: Session) -> FinancialAccount:
    account = db.scalar(
        select(FinancialAccount)
        .where(FinancialAccount.id == account_id)
        .options(selectinload(FinancialAccount.settlements))
    )
    if account is None:
        raise HTTPException(status_code=404, detail="Conta não encontrada.")
    return account


@router.get("", response_model=FinancialAccountListResponse)
def list_financial_accounts(
    destination: Literal["fisica", "juridica"] | None = None,
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> FinancialAccountListResponse:
    filters = [FinancialAccount.destination == destination] if destination else []
    if year is not None:
        filters.append(extract("year", FinancialAccount.due_on) == year)
    if month is not None:
        filters.append(extract("month", FinancialAccount.due_on) == month)
    total_items = db.scalar(select(func.count(FinancialAccount.id)).where(*filters)) or 0
    total_pages = max(1, (total_items + limit - 1) // limit)
    accounts = list(
        db.scalars(
            select(FinancialAccount)
            .where(*filters)
            .options(selectinload(FinancialAccount.settlements))
            .order_by(FinancialAccount.due_on.desc(), FinancialAccount.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    )
    return FinancialAccountListResponse(
        items=[serialize_account(account) for account in accounts],
        pagination=PaginationResponse(
            page=page, limit=limit, total_items=total_items, total_pages=total_pages
        ),
    )


@router.post("", response_model=FinancialAccountResponse, status_code=status.HTTP_201_CREATED)
def create_financial_account(
    payload: FinancialAccountPayload, db: Session = Depends(get_db)
) -> FinancialAccountResponse:
    account_data = payload.model_dump()
    account_data["counterparty"] = account_data["counterparty"].strip() or (
        "Pessoa física" if payload.destination == "fisica" else "Pessoa jurídica"
    )
    account = FinancialAccount(**account_data)
    db.add(account)
    db.commit()
    return serialize_account(get_account_or_404(account.id, db))


@router.put("/{account_id}", response_model=FinancialAccountResponse)
def update_financial_account(
    account_id: int, payload: FinancialAccountPayload, db: Session = Depends(get_db)
) -> FinancialAccountResponse:
    account = get_account_or_404(account_id, db)
    account_data = payload.model_dump()
    account_data["counterparty"] = account_data["counterparty"].strip() or (
        "Pessoa física" if payload.destination == "fisica" else "Pessoa jurídica"
    )
    for field, value in account_data.items():
        setattr(account, field, value)
    db.commit()
    return serialize_account(get_account_or_404(account_id, db))


@router.post("/{account_id}/settlements", response_model=FinancialAccountResponse)
def create_financial_account_settlement(
    account_id: int,
    payload: FinancialAccountSettlementPayload,
    db: Session = Depends(get_db),
) -> FinancialAccountResponse:
    account = get_account_or_404(account_id, db)
    paid_amount = sum((settlement.amount for settlement in account.settlements), Decimal("0"))
    outstanding_amount = account.original_amount - paid_amount
    if payload.amount > outstanding_amount:
        raise HTTPException(status_code=422, detail="O abatimento excede o saldo da conta.")

    movement = FinancialMovement(
        movement_type="income" if account.account_type == "receivable" else "expense",
        destination=account.destination,
        description=f"Abatimento: {account.counterparty} — {account.description}",
        amount=payload.amount,
        occurred_on=payload.occurred_on,
    )
    db.add(movement)
    db.flush()
    db.add(
        FinancialAccountSettlement(
            account_id=account.id,
            financial_movement_id=movement.id,
            amount=payload.amount,
            occurred_on=payload.occurred_on,
        )
    )
    if payload.amount == outstanding_amount:
        account.status = "settled"
    db.commit()
    return serialize_account(get_account_or_404(account_id, db))


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_financial_account(account_id: int, db: Session = Depends(get_db)) -> None:
    account = get_account_or_404(account_id, db)
    movement_ids = [settlement.financial_movement_id for settlement in account.settlements]
    db.delete(account)
    if movement_ids:
        db.query(FinancialMovement).filter(FinancialMovement.id.in_(movement_ids)).delete(
            synchronize_session=False
        )
    db.commit()
