from calendar import monthrange
from datetime import date
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, extract, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.financial_movement import FinancialMovement

router = APIRouter(prefix="/financial-movements", tags=["financial-movements"])


class FinancialMovementPayload(BaseModel):
    movement_type: Literal["income", "expense"]
    destination: Literal["fisica", "juridica"]
    description: str = Field(min_length=1, max_length=255)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    occurred_on: date


class FinancialMovementResponse(FinancialMovementPayload):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PaginationResponse(BaseModel):
    page: int
    limit: int
    total_items: int
    total_pages: int


class FinancialMovementDestinationTotals(BaseModel):
    income: Decimal
    expense: Decimal


class FinancialMovementTotals(BaseModel):
    fisica: FinancialMovementDestinationTotals
    juridica: FinancialMovementDestinationTotals
    income: Decimal
    expense: Decimal


class FinancialMovementListResponse(BaseModel):
    items: list[FinancialMovementResponse]
    pagination: PaginationResponse
    totals: FinancialMovementTotals


class BulkDeletePayload(BaseModel):
    ids: list[int] = Field(min_length=1)


class BulkDuplicatePayload(BaseModel):
    ids: list[int] = Field(min_length=1)


def get_movement_or_404(movement_id: int, db: Session) -> FinancialMovement:
    movement = db.get(FinancialMovement, movement_id)
    if movement is None:
        raise HTTPException(status_code=404, detail="Movimentação não encontrada.")
    return movement


def next_month(occurred_on: date) -> date:
    year = occurred_on.year + (occurred_on.month // 12)
    month = (occurred_on.month % 12) + 1
    day = min(occurred_on.day, monthrange(year, month)[1])
    return date(year, month, day)


def create_duplicate(movement: FinancialMovement) -> FinancialMovement:
    return FinancialMovement(
        movement_type=movement.movement_type,
        destination=movement.destination,
        description=movement.description,
        amount=Decimal("0"),
        occurred_on=next_month(movement.occurred_on),
    )


@router.get("", response_model=FinancialMovementListResponse)
def list_financial_movements(
    year: int = Query(ge=2000, le=2100),
    month: int = Query(ge=1, le=12),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
) -> FinancialMovementListResponse:
    filters = (
        extract("year", FinancialMovement.occurred_on) == year,
        extract("month", FinancialMovement.occurred_on) == month,
    )
    total_items = db.scalar(
        select(func.count(FinancialMovement.id)).where(*filters)
    ) or 0
    grouped_totals = db.execute(
        select(
            FinancialMovement.destination,
            FinancialMovement.movement_type,
            func.sum(FinancialMovement.amount),
        )
        .where(*filters)
        .group_by(FinancialMovement.destination, FinancialMovement.movement_type)
    ).all()
    totals_by_destination = {
        "fisica": {"income": Decimal("0"), "expense": Decimal("0")},
        "juridica": {"income": Decimal("0"), "expense": Decimal("0")},
    }
    for destination, movement_type, amount in grouped_totals:
        totals_by_destination[destination][movement_type] = amount

    total_pages = max(1, (total_items + limit - 1) // limit)
    items = list(
        db.scalars(
            select(FinancialMovement)
            .where(*filters)
            .order_by(FinancialMovement.occurred_on.desc(), FinancialMovement.id.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        )
    )
    return FinancialMovementListResponse(
        items=items,
        pagination=PaginationResponse(
            page=page,
            limit=limit,
            total_items=total_items,
            total_pages=total_pages,
        ),
        totals=FinancialMovementTotals(
            fisica=FinancialMovementDestinationTotals(
                **totals_by_destination["fisica"]
            ),
            juridica=FinancialMovementDestinationTotals(
                **totals_by_destination["juridica"]
            ),
            income=totals_by_destination["fisica"]["income"]
            + totals_by_destination["juridica"]["income"],
            expense=totals_by_destination["fisica"]["expense"]
            + totals_by_destination["juridica"]["expense"],
        ),
    )


@router.post("", response_model=FinancialMovementResponse, status_code=status.HTTP_201_CREATED)
def create_financial_movement(
    payload: FinancialMovementPayload, db: Session = Depends(get_db)
) -> FinancialMovement:
    movement = FinancialMovement(**payload.model_dump())
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


@router.post(
    "/duplicate",
    response_model=list[FinancialMovementResponse],
    status_code=status.HTTP_201_CREATED,
)
def duplicate_financial_movements(
    payload: BulkDuplicatePayload, db: Session = Depends(get_db)
) -> list[FinancialMovement]:
    movements = list(
        db.scalars(
            select(FinancialMovement)
            .where(FinancialMovement.id.in_(payload.ids))
            .order_by(FinancialMovement.id)
        )
    )
    if len(movements) != len(set(payload.ids)):
        raise HTTPException(
            status_code=404,
            detail="Uma ou mais movimentações não foram encontradas.",
        )

    duplicates = [create_duplicate(movement) for movement in movements]
    db.add_all(duplicates)
    db.commit()
    for duplicate in duplicates:
        db.refresh(duplicate)
    return duplicates


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


@router.delete("")
def delete_financial_movements(
    payload: BulkDeletePayload, db: Session = Depends(get_db)
) -> dict[str, int]:
    deleted_count = db.query(FinancialMovement).filter(
        FinancialMovement.id.in_(payload.ids)
    ).delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": deleted_count}
