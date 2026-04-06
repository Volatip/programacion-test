"""Persist partial commission hours in programming and audits.

Revision ID: 0008_partial_commission_hours
Revises: 0007_dismiss_reasons
Create Date: 2026-04-06 10:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0008_partial_commission_hours"
down_revision = "0007_dismiss_reasons"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("programmings", sa.Column("dismiss_reason_id", sa.Integer(), nullable=True))
    op.add_column("programmings", sa.Column("dismiss_suboption_id", sa.Integer(), nullable=True))
    op.add_column("programmings", sa.Column("dismiss_partial_hours", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_programmings_dismiss_reason_id"), "programmings", ["dismiss_reason_id"], unique=False)
    op.create_index(op.f("ix_programmings_dismiss_suboption_id"), "programmings", ["dismiss_suboption_id"], unique=False)

    op.add_column("official_audits", sa.Column("dismiss_partial_hours", sa.Integer(), nullable=True))
    op.add_column("user_hidden_officials", sa.Column("dismiss_partial_hours", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("user_hidden_officials", "dismiss_partial_hours")
    op.drop_column("official_audits", "dismiss_partial_hours")

    op.drop_index(op.f("ix_programmings_dismiss_suboption_id"), table_name="programmings")
    op.drop_index(op.f("ix_programmings_dismiss_reason_id"), table_name="programmings")
    op.drop_column("programmings", "dismiss_partial_hours")
    op.drop_column("programmings", "dismiss_suboption_id")
    op.drop_column("programmings", "dismiss_reason_id")
