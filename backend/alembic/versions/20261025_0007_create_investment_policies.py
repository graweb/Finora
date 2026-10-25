"""create investment policies

Revision ID: 20261025_0007
Revises: 20261024_0006
Create Date: 2026-10-25 10:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20261025_0007"
down_revision = "20261024_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investment_policies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("max_sector_percentage", sa.Numeric(5, 2), nullable=False, server_default="20"),
        sa.Column("max_fund_percentage", sa.Numeric(5, 2), nullable=False, server_default="10"),
        sa.Column("min_sectors", sa.Integer(), nullable=False, server_default="5"),
        sa.Column("include_paper", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("include_brick", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("include_hybrid", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("excluded_sectors", sa.JSON(), nullable=False, server_default="[]"),
        sa.Column("dividend_yield_weight", sa.Numeric(5, 2), nullable=False, server_default="50"),
        sa.Column("diversification_weight", sa.Numeric(5, 2), nullable=False, server_default="35"),
        sa.Column("liquidity_weight", sa.Numeric(5, 2), nullable=False, server_default="15"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.CheckConstraint("max_sector_percentage > 0 AND max_sector_percentage <= 100", name="ck_investment_policies_sector_limit"),
        sa.CheckConstraint("max_fund_percentage > 0 AND max_fund_percentage <= 100", name="ck_investment_policies_fund_limit"),
        sa.CheckConstraint("min_sectors > 0", name="ck_investment_policies_min_sectors"),
    )


def downgrade() -> None:
    op.drop_table("investment_policies")
