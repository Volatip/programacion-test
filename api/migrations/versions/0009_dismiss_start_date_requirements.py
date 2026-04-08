"""Add dismiss start date persistence and reason requirement flag.

Revision ID: 0009_dismiss_start_date
Revises: 0008_partial_commission_hours
Create Date: 2026-04-08 10:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0009_dismiss_start_date"
down_revision = "0008_partial_commission_hours"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "dismiss_reasons",
        sa.Column("requires_start_date", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    op.add_column("funcionarios", sa.Column("dismiss_start_date", sa.DateTime(), nullable=True))
    op.add_column("programmings", sa.Column("dismiss_start_date", sa.DateTime(), nullable=True))
    op.add_column("official_audits", sa.Column("dismiss_start_date", sa.DateTime(), nullable=True))
    op.add_column("user_hidden_officials", sa.Column("dismiss_start_date", sa.DateTime(), nullable=True))

    op.execute("UPDATE dismiss_reasons SET requires_start_date = TRUE WHERE action_type = 'dismiss'")
    op.execute(
        "UPDATE dismiss_reasons SET requires_start_date = FALSE WHERE system_key = 'agregado-error' OR lower(name) = 'agregado por error'"
    )

    op.alter_column("dismiss_reasons", "requires_start_date", server_default=None)


def downgrade() -> None:
    op.drop_column("user_hidden_officials", "dismiss_start_date")
    op.drop_column("official_audits", "dismiss_start_date")
    op.drop_column("programmings", "dismiss_start_date")
    op.drop_column("funcionarios", "dismiss_start_date")
    op.drop_column("dismiss_reasons", "requires_start_date")
