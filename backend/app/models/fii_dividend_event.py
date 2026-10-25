from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FiiDividendEvent(Base):
    __tablename__ = "fii_dividend_events"
    __table_args__ = (
        UniqueConstraint(
            "investment_fund_id",
            "ex_date",
            "payment_date",
            "amount_per_share",
            name="uq_fii_dividend_events_identity",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    investment_fund_id: Mapped[int] = mapped_column(
        ForeignKey("investment_funds.id", ondelete="CASCADE"), index=True
    )
    ex_date: Mapped[date] = mapped_column(Date, index=True)
    payment_date: Mapped[date] = mapped_column(Date, index=True)
    amount_per_share: Mapped[Decimal] = mapped_column(Numeric(12, 4))
    source: Mapped[str] = mapped_column(String(40), default="funds_explorer")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
