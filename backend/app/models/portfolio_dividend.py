from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PortfolioDividend(Base):
    __tablename__ = "portfolio_dividends"

    id: Mapped[int] = mapped_column(primary_key=True)
    investment_fund_id: Mapped[int] = mapped_column(
        ForeignKey("investment_funds.id", ondelete="CASCADE"), index=True
    )
    payment_date: Mapped[date] = mapped_column(Date, index=True)
    amount_per_share: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    eligible_quantity: Mapped[int] = mapped_column()
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
