"""create financial accounts and settlements

Revision ID: 20261022_0003
Revises: 20261022_0002
Create Date: 2026-10-22 00:10:00
"""

import sqlalchemy as sa
from alembic import op


revision = "20261022_0003"
down_revision = "20261022_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "financial_accounts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("counterparty", sa.String(length=255), nullable=False),
        sa.Column("account_type", sa.String(length=12), nullable=False),
        sa.Column("destination", sa.String(length=20), nullable=False),
        sa.Column("description", sa.String(length=255), nullable=False),
        sa.Column("original_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.CheckConstraint("account_type IN ('receivable', 'payable')", name="ck_financial_accounts_type"),
        sa.CheckConstraint("destination IN ('fisica', 'juridica')", name="ck_financial_accounts_destination"),
        sa.CheckConstraint("status IN ('open', 'settled')", name="ck_financial_accounts_status"),
    )
    op.create_index("ix_financial_accounts_due_on", "financial_accounts", ["due_on"])
    op.create_table(
        "financial_account_settlements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("account_id", sa.Integer(), sa.ForeignKey("financial_accounts.id", ondelete="CASCADE"), nullable=False),
        sa.Column("financial_movement_id", sa.Integer(), sa.ForeignKey("financial_movements.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("occurred_on", sa.Date(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_index("ix_financial_account_settlements_account_id", "financial_account_settlements", ["account_id"])
    op.create_index("ix_financial_account_settlements_occurred_on", "financial_account_settlements", ["occurred_on"])


def downgrade() -> None:
    op.drop_index("ix_financial_account_settlements_occurred_on", table_name="financial_account_settlements")
    op.drop_index("ix_financial_account_settlements_account_id", table_name="financial_account_settlements")
    op.drop_table("financial_account_settlements")
    op.drop_index("ix_financial_accounts_due_on", table_name="financial_accounts")
    op.drop_table("financial_accounts")
