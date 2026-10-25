"""create portfolio dividends

Revision ID: 20261024_0005
Revises: 20261023_0004
Create Date: 2026-10-24 15:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20261024_0005"
down_revision = "20261023_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_dividends",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "investment_fund_id",
            sa.Integer(),
            sa.ForeignKey("investment_funds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("payment_date", sa.Date(), nullable=False),
        sa.Column("amount_per_share", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("eligible_quantity", sa.Integer(), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.CheckConstraint("amount_per_share > 0", name="ck_portfolio_dividends_amount"),
        sa.CheckConstraint("eligible_quantity > 0", name="ck_portfolio_dividends_quantity"),
        sa.CheckConstraint("total_amount > 0", name="ck_portfolio_dividends_total"),
    )
    op.create_index(
        "ix_portfolio_dividends_investment_fund_id",
        "portfolio_dividends",
        ["investment_fund_id"],
    )
    op.create_index(
        "ix_portfolio_dividends_payment_date",
        "portfolio_dividends",
        ["payment_date"],
    )


def downgrade() -> None:
    op.drop_index("ix_portfolio_dividends_payment_date", table_name="portfolio_dividends")
    op.drop_index("ix_portfolio_dividends_investment_fund_id", table_name="portfolio_dividends")
    op.drop_table("portfolio_dividends")
