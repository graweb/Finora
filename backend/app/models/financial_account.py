from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class FinancialAccount(Base):
    __tablename__ = "financial_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    counterparty: Mapped[str] = mapped_column(String(255))
    account_type: Mapped[str] = mapped_column(String(12))
    destination: Mapped[str] = mapped_column(String(20))
    description: Mapped[str] = mapped_column(String(255))
    original_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    due_on: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[str] = mapped_column(String(12), default="open")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    settlements: Mapped[list["FinancialAccountSettlement"]] = relationship(
        back_populates="account", cascade="all, delete-orphan"
    )


class FinancialAccountSettlement(Base):
    __tablename__ = "financial_account_settlements"

    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(
        ForeignKey("financial_accounts.id", ondelete="CASCADE"), index=True
    )
    financial_movement_id: Mapped[int] = mapped_column(
        ForeignKey("financial_movements.id", ondelete="CASCADE"), unique=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    account: Mapped[FinancialAccount] = relationship(back_populates="settlements")
