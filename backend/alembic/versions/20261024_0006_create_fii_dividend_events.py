"""create FII dividend events and exceptional adjustments

Revision ID: 20261024_0006
Revises: 20261024_0005
Create Date: 2026-10-24 16:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20261024_0006"
down_revision = "20261024_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fii_dividend_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "investment_fund_id",
            sa.Integer(),
            sa.ForeignKey("investment_funds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("ex_date", sa.Date(), nullable=False),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount_per_share", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("source", sa.String(length=40), nullable=False, server_default="funds_explorer"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("amount_per_share >= 0", name="ck_fii_dividend_events_amount"),
        sa.UniqueConstraint("investment_fund_id", "ex_date", "payment_date", "amount_per_share", name="uq_fii_dividend_events_identity"),
    )
    op.create_index("ix_fii_dividend_events_investment_fund_id", "fii_dividend_events", ["investment_fund_id"])
    op.create_index("ix_fii_dividend_events_ex_date", "fii_dividend_events", ["ex_date"])
    op.create_index("ix_fii_dividend_events_payment_date", "fii_dividend_events", ["payment_date"])
    op.create_table(
        "portfolio_dividend_adjustments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("dividend_event_id", sa.Integer(), sa.ForeignKey("fii_dividend_events.id", ondelete="CASCADE"), nullable=False),
        sa.Column("amount_delta", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.UniqueConstraint("dividend_event_id", name="uq_portfolio_dividend_adjustments_event"),
    )
    op.create_index("ix_portfolio_dividend_adjustments_dividend_event_id", "portfolio_dividend_adjustments", ["dividend_event_id"])


def downgrade() -> None:
    op.drop_index("ix_portfolio_dividend_adjustments_dividend_event_id", table_name="portfolio_dividend_adjustments")
    op.drop_table("portfolio_dividend_adjustments")
    op.drop_index("ix_fii_dividend_events_payment_date", table_name="fii_dividend_events")
    op.drop_index("ix_fii_dividend_events_ex_date", table_name="fii_dividend_events")
    op.drop_index("ix_fii_dividend_events_investment_fund_id", table_name="fii_dividend_events")
    op.drop_table("fii_dividend_events")
