"""create financial movements

Revision ID: 20261022_0002
Revises: 20261021_0001
Create Date: 2026-10-22 00:00:00
"""

import sqlalchemy as sa
from alembic import op


revision = "20261022_0002"
down_revision = "20261021_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("movement_type", sa.String(length=10), nullable=False),
        sa.Column("destination", sa.String(length=20), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
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
            "movement_type IN ('income', 'expense')",
            name="ck_financial_movements_type",
        ),
        sa.CheckConstraint(
            "destination IN ('fisica', 'juridica')",
            name="ck_financial_movements_destination",
        ),
    )
    op.create_index(
        "ix_financial_movements_occurred_on", "financial_movements", ["occurred_on"]
    )


def downgrade() -> None:
    op.drop_index("ix_financial_movements_occurred_on", table_name="financial_movements")
    op.drop_table("financial_movements")
