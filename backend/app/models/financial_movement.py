from datetime import date, datetime

from sqlalchemy import Date, DateTime, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FinancialMovement(Base):
    __tablename__ = "financial_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    movement_type: Mapped[str] = mapped_column(String(10))
    destination: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(255))
    amount: Mapped[float] = mapped_column(Numeric(12, 2))
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
