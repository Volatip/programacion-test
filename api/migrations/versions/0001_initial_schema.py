"""Initial schema baseline.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-03-30 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "programming_periods",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("start_date", sa.DateTime(), nullable=False),
        sa.Column("end_date", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=True),
        sa.Column("is_closed", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_programming_periods_name"), "programming_periods", ["name"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("password_hash", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("rut", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("last_access", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)
    op.create_index(op.f("ix_users_rut"), "users", ["rut"], unique=True)

    op.create_table(
        "configs",
        sa.Column("key", sa.String(), nullable=False),
        sa.Column("value", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("key"),
    )
    op.create_index(op.f("ix_configs_key"), "configs", ["key"], unique=False)

    op.create_table(
        "funcionarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("law_code", sa.String(), nullable=True),
        sa.Column("specialty_sis", sa.String(), nullable=True),
        sa.Column("hours_per_week", sa.Integer(), nullable=True),
        sa.Column("rut", sa.String(), nullable=True),
        sa.Column("dv", sa.String(), nullable=True),
        sa.Column("contract_id", sa.String(), nullable=True),
        sa.Column("contract_correlative", sa.Integer(), nullable=True),
        sa.Column("establishment_id", sa.Integer(), nullable=True),
        sa.Column("effective_hours", sa.Float(), nullable=True),
        sa.Column("shift_system", sa.String(), nullable=True),
        sa.Column("observations", sa.Text(), nullable=True),
        sa.Column("holiday_days", sa.Integer(), nullable=True),
        sa.Column("administrative_days", sa.Integer(), nullable=True),
        sa.Column("congress_days", sa.Integer(), nullable=True),
        sa.Column("breastfeeding_time", sa.Integer(), nullable=True),
        sa.Column("lunch_time_minutes", sa.Integer(), nullable=True),
        sa.Column("contract_start_date", sa.DateTime(), nullable=True),
        sa.Column("contract_end_date", sa.DateTime(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("is_active_roster", sa.Boolean(), nullable=True),
        sa.Column("latency_hours", sa.Integer(), nullable=True),
        sa.Column("break_minutes", sa.Integer(), nullable=True),
        sa.Column("unscheduled_count", sa.Integer(), nullable=True),
        sa.Column("rrhh_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("raw_data", sa.Text(), nullable=True),
        sa.Column("period_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["period_id"], ["programming_periods.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_funcionarios_name"), "funcionarios", ["name"], unique=False)
    op.create_index(op.f("ix_funcionarios_rut"), "funcionarios", ["rut"], unique=False)
    op.create_index(op.f("ix_funcionarios_specialty_sis"), "funcionarios", ["specialty_sis"], unique=False)
    op.create_index(op.f("ix_funcionarios_status"), "funcionarios", ["status"], unique=False)
    op.create_index(op.f("ix_funcionarios_is_active_roster"), "funcionarios", ["is_active_roster"], unique=False)

    op.create_table(
        "activities",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_activities_type"), "activities", ["type"], unique=False)
    op.create_index(op.f("ix_activities_created_at"), "activities", ["created_at"], unique=False)

    op.create_table(
        "groups",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_groups_name"), "groups", ["name"], unique=False)

    op.create_table(
        "specialties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("visible", sa.String(), nullable=True),
        sa.Column("period_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["period_id"], ["programming_periods.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_specialties_name"), "specialties", ["name"], unique=False)
    op.create_index(op.f("ix_specialties_visible"), "specialties", ["visible"], unique=False)

    op.create_table(
        "processes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("period_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["period_id"], ["programming_periods.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_processes_name"), "processes", ["name"], unique=False)

    op.create_table(
        "activity_types",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("process", sa.String(), nullable=True),
        sa.Column("profession", sa.String(), nullable=True),
        sa.Column("specialty", sa.String(), nullable=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("visible", sa.String(), nullable=True),
        sa.Column("prais", sa.String(), nullable=True),
        sa.Column("req_rendimiento", sa.String(length=2), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=True),
        sa.Column("period_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["period_id"], ["programming_periods.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_activity_types_process"), "activity_types", ["process"], unique=False)
    op.create_index(op.f("ix_activity_types_profession"), "activity_types", ["profession"], unique=False)
    op.create_index(op.f("ix_activity_types_specialty"), "activity_types", ["specialty"], unique=False)
    op.create_index(op.f("ix_activity_types_name"), "activity_types", ["name"], unique=False)
    op.create_index(op.f("ix_activity_types_visible"), "activity_types", ["visible"], unique=False)

    op.create_table(
        "performance_units",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("period_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["period_id"], ["programming_periods.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_performance_units_name"), "performance_units", ["name"], unique=False)

    op.create_table(
        "schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("funcionario_id", sa.Integer(), nullable=True),
        sa.Column("start_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("end_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("activity_type", sa.String(), nullable=False),
        sa.Column("assigned_hours", sa.Float(), nullable=True),
        sa.Column("performance", sa.Float(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["funcionario_id"], ["funcionarios.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "programmings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("funcionario_id", sa.Integer(), nullable=False),
        sa.Column("period_id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("observation", sa.Text(), nullable=True),
        sa.Column("assigned_group_id", sa.Integer(), nullable=True),
        sa.Column("assigned_status", sa.String(), nullable=True),
        sa.Column("prais", sa.Boolean(), nullable=True),
        sa.Column("global_specialty", sa.String(), nullable=True),
        sa.Column("selected_process", sa.String(), nullable=True),
        sa.Column("selected_performance_unit", sa.String(), nullable=True),
        sa.Column("time_unit", sa.String(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["assigned_group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["funcionario_id"], ["funcionarios.id"]),
        sa.ForeignKeyConstraint(["period_id"], ["programming_periods.id"]),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_hidden_officials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("funcionario_rut", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_hidden_officials_user_id"), "user_hidden_officials", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_hidden_officials_funcionario_rut"), "user_hidden_officials", ["funcionario_rut"], unique=False)

    op.create_table(
        "official_audits",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("funcionario_id", sa.Integer(), nullable=True),
        sa.Column("funcionario_name", sa.String(), nullable=True),
        sa.Column("rut", sa.String(), nullable=True),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "specialty_stats",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("specialty_id", sa.Integer(), nullable=True),
        sa.Column("new_consult_percentage", sa.Float(), nullable=True),
        sa.Column("yield_new", sa.Float(), nullable=True),
        sa.Column("yield_control", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["specialty_id"], ["specialties.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("specialty_id"),
    )

    op.create_table(
        "user_officials",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("funcionario_id", sa.Integer(), nullable=True),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["funcionario_id"], ["funcionarios.id"]),
        sa.ForeignKeyConstraint(["group_id"], ["groups.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_officials_user_id"), "user_officials", ["user_id"], unique=False)
    op.create_index(op.f("ix_user_officials_funcionario_id"), "user_officials", ["funcionario_id"], unique=False)

    op.create_table(
        "programming_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("programming_id", sa.Integer(), nullable=False),
        sa.Column("activity_type_id", sa.Integer(), nullable=True),
        sa.Column("activity_name", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("subtitle", sa.String(), nullable=True),
        sa.Column("specialty", sa.String(), nullable=True),
        sa.Column("day_of_week", sa.Integer(), nullable=True),
        sa.Column("start_time", sa.String(), nullable=True),
        sa.Column("end_time", sa.String(), nullable=True),
        sa.Column("assigned_hours", sa.Float(), nullable=True),
        sa.Column("performance", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["activity_type_id"], ["activity_types.id"]),
        sa.ForeignKeyConstraint(["programming_id"], ["programmings.id"]),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "revoked_tokens",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("token", sa.String(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
        sa.UniqueConstraint("token"),
    )
    op.create_index(op.f("ix_revoked_tokens_token_hash"), "revoked_tokens", ["token_hash"], unique=True)
    op.create_index(op.f("ix_revoked_tokens_token"), "revoked_tokens", ["token"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_revoked_tokens_token"), table_name="revoked_tokens")
    op.drop_index(op.f("ix_revoked_tokens_token_hash"), table_name="revoked_tokens")
    op.drop_table("revoked_tokens")
    op.drop_table("programming_items")
    op.drop_index(op.f("ix_user_officials_funcionario_id"), table_name="user_officials")
    op.drop_index(op.f("ix_user_officials_user_id"), table_name="user_officials")
    op.drop_table("user_officials")
    op.drop_table("specialty_stats")
    op.drop_table("official_audits")
    op.drop_index(op.f("ix_user_hidden_officials_funcionario_rut"), table_name="user_hidden_officials")
    op.drop_index(op.f("ix_user_hidden_officials_user_id"), table_name="user_hidden_officials")
    op.drop_table("user_hidden_officials")
    op.drop_table("programmings")
    op.drop_table("schedules")
    op.drop_index(op.f("ix_performance_units_name"), table_name="performance_units")
    op.drop_table("performance_units")
    op.drop_index(op.f("ix_activity_types_visible"), table_name="activity_types")
    op.drop_index(op.f("ix_activity_types_name"), table_name="activity_types")
    op.drop_index(op.f("ix_activity_types_specialty"), table_name="activity_types")
    op.drop_index(op.f("ix_activity_types_profession"), table_name="activity_types")
    op.drop_index(op.f("ix_activity_types_process"), table_name="activity_types")
    op.drop_table("activity_types")
    op.drop_index(op.f("ix_processes_name"), table_name="processes")
    op.drop_table("processes")
    op.drop_index(op.f("ix_specialties_visible"), table_name="specialties")
    op.drop_index(op.f("ix_specialties_name"), table_name="specialties")
    op.drop_table("specialties")
    op.drop_index(op.f("ix_groups_name"), table_name="groups")
    op.drop_table("groups")
    op.drop_index(op.f("ix_activities_created_at"), table_name="activities")
    op.drop_index(op.f("ix_activities_type"), table_name="activities")
    op.drop_table("activities")
    op.drop_index(op.f("ix_funcionarios_is_active_roster"), table_name="funcionarios")
    op.drop_index(op.f("ix_funcionarios_status"), table_name="funcionarios")
    op.drop_index(op.f("ix_funcionarios_specialty_sis"), table_name="funcionarios")
    op.drop_index(op.f("ix_funcionarios_rut"), table_name="funcionarios")
    op.drop_index(op.f("ix_funcionarios_name"), table_name="funcionarios")
    op.drop_table("funcionarios")
    op.drop_index(op.f("ix_configs_key"), table_name="configs")
    op.drop_table("configs")
    op.drop_index(op.f("ix_users_rut"), table_name="users")
    op.drop_index(op.f("ix_users_email"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_programming_periods_name"), table_name="programming_periods")
    op.drop_table("programming_periods")
