"""Scope hidden officials and official audits by period.

Revision ID: 0006_audits_hidden_scope
Revises: 0005_groups_period_scope
Create Date: 2026-04-01 16:20:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0006_audits_hidden_scope"
down_revision = "0005_groups_period_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("official_audits", sa.Column("period_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_official_audits_period_id"), "official_audits", ["period_id"], unique=False)
    op.create_foreign_key(
        "fk_official_audits_period_id_programming_periods",
        "official_audits",
        "programming_periods",
        ["period_id"],
        ["id"],
    )

    op.add_column("user_hidden_officials", sa.Column("period_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_user_hidden_officials_period_id"), "user_hidden_officials", ["period_id"], unique=False)
    op.create_foreign_key(
        "fk_user_hidden_officials_period_id_programming_periods",
        "user_hidden_officials",
        "programming_periods",
        ["period_id"],
        ["id"],
    )

    op.execute(
        sa.text(
            """
            UPDATE official_audits
            SET period_id = (
                SELECT f.period_id
                FROM funcionarios f
                WHERE f.id = official_audits.funcionario_id
            )
            WHERE period_id IS NULL
              AND funcionario_id IS NOT NULL
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE official_audits
            SET period_id = (
                SELECT derived.period_id
                FROM (
                    SELECT f.rut, MIN(f.period_id) AS period_id
                    FROM funcionarios f
                    WHERE f.rut IS NOT NULL AND f.period_id IS NOT NULL
                    GROUP BY f.rut
                    HAVING COUNT(DISTINCT f.period_id) = 1
                ) AS derived
                WHERE derived.rut = official_audits.rut
            )
            WHERE period_id IS NULL
              AND rut IS NOT NULL
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE user_hidden_officials
            SET period_id = (
                SELECT derived.period_id
                FROM (
                    SELECT uho.id AS hidden_id, MIN(f.period_id) AS period_id
                    FROM user_hidden_officials uho
                    JOIN user_officials uo ON uo.user_id = uho.user_id
                    JOIN funcionarios f ON f.id = uo.funcionario_id
                    WHERE f.rut = uho.funcionario_rut
                      AND f.period_id IS NOT NULL
                    GROUP BY uho.id
                    HAVING COUNT(DISTINCT f.period_id) = 1
                ) AS derived
                WHERE derived.hidden_id = user_hidden_officials.id
            )
            WHERE period_id IS NULL
            """
        )
    )

    op.execute(
        sa.text(
            """
            UPDATE user_hidden_officials
            SET period_id = (
                SELECT derived.period_id
                FROM (
                    SELECT f.rut, MIN(f.period_id) AS period_id
                    FROM funcionarios f
                    WHERE f.rut IS NOT NULL AND f.period_id IS NOT NULL
                    GROUP BY f.rut
                    HAVING COUNT(DISTINCT f.period_id) = 1
                ) AS derived
                WHERE derived.rut = user_hidden_officials.funcionario_rut
            )
            WHERE period_id IS NULL
              AND funcionario_rut IS NOT NULL
            """
        )
    )

    with op.batch_alter_table("user_hidden_officials") as batch_op:
        batch_op.drop_constraint("uq_user_hidden_officials_user_rut", type_="unique")
        batch_op.create_unique_constraint(
            "uq_user_hidden_officials_user_rut_period",
            ["user_id", "funcionario_rut", "period_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("user_hidden_officials") as batch_op:
        batch_op.drop_constraint("uq_user_hidden_officials_user_rut_period", type_="unique")
        batch_op.create_unique_constraint(
            "uq_user_hidden_officials_user_rut",
            ["user_id", "funcionario_rut"],
        )

    op.drop_constraint(
        "fk_user_hidden_officials_period_id_programming_periods",
        "user_hidden_officials",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_user_hidden_officials_period_id"), table_name="user_hidden_officials")
    op.drop_column("user_hidden_officials", "period_id")

    op.drop_constraint(
        "fk_official_audits_period_id_programming_periods",
        "official_audits",
        type_="foreignkey",
    )
    op.drop_index(op.f("ix_official_audits_period_id"), table_name="official_audits")
    op.drop_column("official_audits", "period_id")
