"""create investment funds

Revision ID: 20261021_0001
Revises:
Create Date: 2026-10-21 00:00:00
"""

import sqlalchemy as sa
from alembic import op


revision = "20261021_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_funds",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("ticker", sa.String(length=10), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("sector", sa.String(length=100), nullable=True),
        sa.Column("latest_price", sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column(
            "annual_dividend_yield", sa.Numeric(precision=8, scale=6), nullable=True
        ),
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
    )
    op.create_index(
        "ix_investment_funds_ticker", "investment_funds", ["ticker"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_investment_funds_ticker", table_name="investment_funds")
    op.drop_table("investment_funds")
