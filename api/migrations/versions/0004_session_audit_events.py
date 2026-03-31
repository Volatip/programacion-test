"""Add session audit events.

Revision ID: 0004_session_audit_events
Revises: 0003_contextual_help_pages
Create Date: 2026-03-31 01:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0004_session_audit_events"
down_revision = "0003_contextual_help_pages"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "session_audit_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_rut", sa.String(), nullable=True),
        sa.Column("event_type", sa.String(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("ip_address", sa.String(length=45), nullable=True),
        sa.Column("user_agent", sa.String(length=512), nullable=True),
        sa.Column("session_jti_hash", sa.String(length=64), nullable=True),
        sa.Column("failure_reason", sa.String(length=255), nullable=True),
        sa.Column("request_path", sa.String(length=255), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_session_audit_events_event_type"), "session_audit_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_session_audit_events_id"), "session_audit_events", ["id"], unique=False)
    op.create_index(op.f("ix_session_audit_events_ip_address"), "session_audit_events", ["ip_address"], unique=False)
    op.create_index(op.f("ix_session_audit_events_occurred_at"), "session_audit_events", ["occurred_at"], unique=False)
    op.create_index(op.f("ix_session_audit_events_session_jti_hash"), "session_audit_events", ["session_jti_hash"], unique=False)
    op.create_index(op.f("ix_session_audit_events_success"), "session_audit_events", ["success"], unique=False)
    op.create_index(op.f("ix_session_audit_events_user_id"), "session_audit_events", ["user_id"], unique=False)
    op.create_index(op.f("ix_session_audit_events_user_rut"), "session_audit_events", ["user_rut"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_session_audit_events_user_rut"), table_name="session_audit_events")
    op.drop_index(op.f("ix_session_audit_events_user_id"), table_name="session_audit_events")
    op.drop_index(op.f("ix_session_audit_events_success"), table_name="session_audit_events")
    op.drop_index(op.f("ix_session_audit_events_session_jti_hash"), table_name="session_audit_events")
    op.drop_index(op.f("ix_session_audit_events_occurred_at"), table_name="session_audit_events")
    op.drop_index(op.f("ix_session_audit_events_ip_address"), table_name="session_audit_events")
    op.drop_index(op.f("ix_session_audit_events_id"), table_name="session_audit_events")
    op.drop_index(op.f("ix_session_audit_events_event_type"), table_name="session_audit_events")
    op.drop_table("session_audit_events")
