"""Add dismiss reasons configuration module.

Revision ID: 0007_dismiss_reasons
Revises: 0006_audits_hidden_scope
Create Date: 2026-04-03 09:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0007_dismiss_reasons"
down_revision = "0006_audits_hidden_scope"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dismiss_reasons",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("system_key", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("action_type", sa.String(), nullable=False, server_default="dismiss"),
        sa.Column("reason_category", sa.String(), nullable=False, server_default="other"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.UniqueConstraint("name", name="uq_dismiss_reasons_name"),
    )
    op.create_index(op.f("ix_dismiss_reasons_id"), "dismiss_reasons", ["id"], unique=False)
    op.create_index(op.f("ix_dismiss_reasons_name"), "dismiss_reasons", ["name"], unique=False)
    op.create_index(op.f("ix_dismiss_reasons_system_key"), "dismiss_reasons", ["system_key"], unique=False)

    op.create_table(
        "dismiss_reason_suboptions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("reason_id", sa.Integer(), nullable=False),
        sa.Column("system_key", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.ForeignKeyConstraint(["reason_id"], ["dismiss_reasons.id"]),
        sa.UniqueConstraint("reason_id", "name", name="uq_dismiss_reason_suboptions_reason_name"),
    )
    op.create_index(op.f("ix_dismiss_reason_suboptions_id"), "dismiss_reason_suboptions", ["id"], unique=False)
    op.create_index(op.f("ix_dismiss_reason_suboptions_reason_id"), "dismiss_reason_suboptions", ["reason_id"], unique=False)
    op.create_index(op.f("ix_dismiss_reason_suboptions_system_key"), "dismiss_reason_suboptions", ["system_key"], unique=False)

    op.add_column("official_audits", sa.Column("suboption", sa.String(), nullable=True))
    op.add_column("official_audits", sa.Column("dismiss_reason_id", sa.Integer(), nullable=True))
    op.add_column("official_audits", sa.Column("dismiss_suboption_id", sa.Integer(), nullable=True))
    op.add_column("official_audits", sa.Column("reason_category", sa.String(), nullable=True))
    op.create_index(op.f("ix_official_audits_dismiss_reason_id"), "official_audits", ["dismiss_reason_id"], unique=False)
    op.create_index(op.f("ix_official_audits_dismiss_suboption_id"), "official_audits", ["dismiss_suboption_id"], unique=False)

    op.add_column("user_hidden_officials", sa.Column("suboption", sa.String(), nullable=True))
    op.add_column("user_hidden_officials", sa.Column("dismiss_reason_id", sa.Integer(), nullable=True))
    op.add_column("user_hidden_officials", sa.Column("dismiss_suboption_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_user_hidden_officials_dismiss_reason_id"), "user_hidden_officials", ["dismiss_reason_id"], unique=False)
    op.create_index(op.f("ix_user_hidden_officials_dismiss_suboption_id"), "user_hidden_officials", ["dismiss_suboption_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_user_hidden_officials_dismiss_suboption_id"), table_name="user_hidden_officials")
    op.drop_index(op.f("ix_user_hidden_officials_dismiss_reason_id"), table_name="user_hidden_officials")
    op.drop_column("user_hidden_officials", "dismiss_suboption_id")
    op.drop_column("user_hidden_officials", "dismiss_reason_id")
    op.drop_column("user_hidden_officials", "suboption")

    op.drop_index(op.f("ix_official_audits_dismiss_suboption_id"), table_name="official_audits")
    op.drop_index(op.f("ix_official_audits_dismiss_reason_id"), table_name="official_audits")
    op.drop_column("official_audits", "reason_category")
    op.drop_column("official_audits", "dismiss_suboption_id")
    op.drop_column("official_audits", "dismiss_reason_id")
    op.drop_column("official_audits", "suboption")

    op.drop_index(op.f("ix_dismiss_reason_suboptions_system_key"), table_name="dismiss_reason_suboptions")
    op.drop_index(op.f("ix_dismiss_reason_suboptions_reason_id"), table_name="dismiss_reason_suboptions")
    op.drop_index(op.f("ix_dismiss_reason_suboptions_id"), table_name="dismiss_reason_suboptions")
    op.drop_table("dismiss_reason_suboptions")

    op.drop_index(op.f("ix_dismiss_reasons_system_key"), table_name="dismiss_reasons")
    op.drop_index(op.f("ix_dismiss_reasons_name"), table_name="dismiss_reasons")
    op.drop_index(op.f("ix_dismiss_reasons_id"), table_name="dismiss_reasons")
    op.drop_table("dismiss_reasons")
