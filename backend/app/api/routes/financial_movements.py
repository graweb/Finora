from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import extract, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.financial_movement import FinancialMovement, FinancialMovementOwnerType

router = APIRouter(prefix="/financial-movements", tags=["financial-movements"])


class FinancialMovementPayload(BaseModel):
    movement_type: Literal["income", "expense"]
    owner_type: FinancialMovementOwnerType
    description: str = Field(min_length=1, max_length=255)
    category: str | None = Field(default=None, max_length=100)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    occurred_on: date


class FinancialMovementResponse(FinancialMovementPayload):
    id: int
    model_config = ConfigDict(from_attributes=True)


def get_movement_or_404(movement_id: int, db: Session) -> FinancialMovement:
    movement = db.get(FinancialMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada.")
    return movement


@router.get("", response_model=list[FinancialMovementResponse])
def list_financial_movements(
    year: int = Query(ge=2000, le=2100),
    month: int = Query(ge=1, le=12),
    db: Session = Depends(get_db),
) -> list[FinancialMovement]:
    statement = (
        select(FinancialMovement)
        .where(
            extract("year", FinancialMovement.occurred_on) == year,
            extract("month", FinancialMovement.occurred_on) == month,
        )
        .order_by(FinancialMovement.occurred_on.desc(), FinancialMovement.id.desc())
    )
    return list(db.scalars(statement))


@router.post("", response_model=FinancialMovementResponse, status_code=status.HTTP_201_CREATED)
def create_financial_movement(
    payload: FinancialMovementPayload, db: Session = Depends(get_db)
) -> FinancialMovement:
    movement = FinancialMovement(**payload.model_dump())
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


@router.put("/{movement_id}", response_model=FinancialMovementResponse)
def update_financial_movement(
    movement_id: int, payload: FinancialMovementPayload, db: Session = Depends(get_db)
) -> FinancialMovement:
    movement = get_movement_or_404(movement_id, db)
    for field, value in payload.model_dump().items():
        setattr(movement, field, value)
    db.commit()
    db.refresh(movement)
    return movement


@router.delete("/{movement_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_financial_movement(movement_id: int, db: Session = Depends(get_db)) -> None:
    movement = get_movement_or_404(movement_id, db)
    db.delete(movement)
    db.commit()
