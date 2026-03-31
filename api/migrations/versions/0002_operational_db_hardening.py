"""Operational database hardening.

Revision ID: 0002_operational_db_hardening
Revises: 0001_initial_schema
Create Date: 2026-03-30 00:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0002_operational_db_hardening"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def _assert_no_duplicates(table_name: str, columns: tuple[str, ...]) -> None:
    bind = op.get_bind()
    select_columns = ", ".join(columns)
    result = bind.execute(
        sa.text(
            f"""
            SELECT {select_columns}, COUNT(*) AS duplicate_count
            FROM {table_name}
            GROUP BY {select_columns}
            HAVING COUNT(*) > 1
            LIMIT 5
            """
        )
    ).mappings().all()

    if not result:
        return

    duplicated_keys = "; ".join(
        ", ".join(f"{column}={row[column]!r}" for column in columns) + f" (count={row['duplicate_count']})"
        for row in result
    )
    raise RuntimeError(
        f"Cannot apply {revision}: duplicate rows detected in {table_name}. "
        f"Clean these keys first: {duplicated_keys}"
    )


def upgrade() -> None:
    _assert_no_duplicates("programmings", ("funcionario_id", "period_id"))
    _assert_no_duplicates("user_officials", ("user_id", "funcionario_id"))
    _assert_no_duplicates("user_hidden_officials", ("user_id", "funcionario_rut"))

    with op.batch_alter_table("programmings") as batch_op:
        batch_op.create_unique_constraint(
            "uq_programmings_funcionario_period",
            ["funcionario_id", "period_id"],
        )

    with op.batch_alter_table("user_officials") as batch_op:
        batch_op.create_unique_constraint(
            "uq_user_officials_user_funcionario",
            ["user_id", "funcionario_id"],
        )

    with op.batch_alter_table("user_hidden_officials") as batch_op:
        batch_op.create_unique_constraint(
            "uq_user_hidden_officials_user_rut",
            ["user_id", "funcionario_rut"],
        )


def downgrade() -> None:
    with op.batch_alter_table("user_hidden_officials") as batch_op:
        batch_op.drop_constraint("uq_user_hidden_officials_user_rut", type_="unique")

    with op.batch_alter_table("user_officials") as batch_op:
        batch_op.drop_constraint("uq_user_officials_user_funcionario", type_="unique")

    with op.batch_alter_table("programmings") as batch_op:
        batch_op.drop_constraint("uq_programmings_funcionario_period", type_="unique")
