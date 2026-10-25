from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, JSON, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class InvestmentPolicy(Base):
    __tablename__ = "investment_policies"

    id: Mapped[int] = mapped_column(primary_key=True)
    max_sector_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="20"
    )
    max_fund_percentage: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="10"
    )
    min_sectors: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default="5"
    )
    include_paper: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    include_brick: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    include_hybrid: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    excluded_sectors: Mapped[list[str]] = mapped_column(
        JSON, nullable=False, server_default="[]"
    )
    dividend_yield_weight: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="50"
    )
    diversification_weight: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="35"
    )
    liquidity_weight: Mapped[float] = mapped_column(
        Numeric(5, 2), nullable=False, server_default="15"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
