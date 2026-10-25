"""add average daily liquidity to investment funds

Revision ID: 20261025_0008
Revises: 20261025_0007
Create Date: 2026-10-25 10:30:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20261025_0008"
down_revision = "20261025_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "investment_funds",
        sa.Column("average_daily_liquidity", sa.Numeric(18, 2), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("investment_funds", "average_daily_liquidity")
