from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class PortfolioDividendAdjustment(Base):
    __tablename__ = "portfolio_dividend_adjustments"
    __table_args__ = (
        UniqueConstraint("dividend_event_id", name="uq_portfolio_dividend_adjustments_event"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    dividend_event_id: Mapped[int] = mapped_column(
        ForeignKey("fii_dividend_events.id", ondelete="CASCADE"), index=True
    )
    amount_delta: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
