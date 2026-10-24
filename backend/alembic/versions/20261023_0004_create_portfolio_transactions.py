"""create portfolio transactions

Revision ID: 20261023_0004
Revises: 20261022_0003
Create Date: 2026-10-23 10:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20261023_0004"
down_revision = "20261022_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "portfolio_transactions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "investment_fund_id",
            sa.Integer(),
            sa.ForeignKey("investment_funds.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("transaction_type", sa.String(length=8), nullable=False),
        sa.Column("unit_price", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
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
        sa.CheckConstraint(
            "transaction_type IN ('buy', 'sell')",
            name="ck_portfolio_transactions_type",
        ),
        sa.CheckConstraint(
            "unit_price > 0",
            name="ck_portfolio_transactions_unit_price",
        ),
        sa.CheckConstraint(
            "quantity > 0", name="ck_portfolio_transactions_quantity"
        ),
        sa.CheckConstraint(
            "total_amount > 0", name="ck_portfolio_transactions_total"
        ),
    )
    op.create_index(
        "ix_portfolio_transactions_investment_fund_id",
        "portfolio_transactions",
        ["investment_fund_id"],
    )
    op.create_index(
        "ix_portfolio_transactions_occurred_on",
        "portfolio_transactions",
        ["occurred_on"],
    )


def downgrade() -> None:
    op.drop_index("ix_portfolio_transactions_occurred_on", table_name="portfolio_transactions")
    op.drop_index("ix_portfolio_transactions_investment_fund_id", table_name="portfolio_transactions")
    op.drop_table("portfolio_transactions")
