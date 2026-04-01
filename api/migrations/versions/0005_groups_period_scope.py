"""Scope groups by programming period.

Revision ID: 0005_groups_period_scope
Revises: 0004_session_audit_events
Create Date: 2026-04-01 13:15:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0005_groups_period_scope"
down_revision = "0004_session_audit_events"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("groups", sa.Column("period_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_groups_period_id"), "groups", ["period_id"], unique=False)
    op.create_foreign_key("fk_groups_period_id_programming_periods", "groups", "programming_periods", ["period_id"], ["id"])

    op.execute(
        sa.text(
            """
            UPDATE groups
            SET period_id = (
                SELECT MAX(f.period_id)
                FROM user_officials uo
                JOIN funcionarios f ON f.id = uo.funcionario_id
                WHERE uo.group_id = groups.id
            )
            WHERE period_id IS NULL
            """
        )
    )


def downgrade() -> None:
    op.drop_constraint("fk_groups_period_id_programming_periods", "groups", type_="foreignkey")
    op.drop_index(op.f("ix_groups_period_id"), table_name="groups")
    op.drop_column("groups", "period_id")
