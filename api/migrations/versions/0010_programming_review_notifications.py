"""Add programming review snapshot, audit trail, and notifications.

Revision ID: 0010_review_notifications
Revises: 0009_dismiss_start_date
Create Date: 2026-04-09 14:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "0010_review_notifications"
down_revision = "0009_dismiss_start_date"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("programmings", sa.Column("review_status", sa.String(), nullable=True))
    op.add_column("programmings", sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("programmings", sa.Column("reviewed_by_id", sa.Integer(), nullable=True))
    op.add_column("programmings", sa.Column("review_comment", sa.Text(), nullable=True))
    op.create_foreign_key(
        "fk_programmings_reviewed_by_id_users",
        "programmings",
        "users",
        ["reviewed_by_id"],
        ["id"],
    )
    op.create_index("ix_programmings_review_status", "programmings", ["review_status"])
    op.create_index("ix_programmings_reviewed_at", "programmings", ["reviewed_at"])

    op.create_table(
        "programming_review_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("programming_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(), nullable=False),
        sa.Column("comment", sa.Text(), nullable=True),
        sa.Column("reviewed_by_id", sa.Integer(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("email_status", sa.String(), nullable=True),
        sa.Column("email_error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["programming_id"], ["programmings.id"]),
        sa.ForeignKeyConstraint(["reviewed_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_programming_review_events_programming_id", "programming_review_events", ["programming_id"])
    op.create_index("ix_programming_review_events_reviewed_by_id", "programming_review_events", ["reviewed_by_id"])
    op.create_index("ix_programming_review_events_reviewed_at", "programming_review_events", ["reviewed_at"])

    op.create_table(
        "user_notifications",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("payload_json", sa.Text(), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_user_notifications_user_id", "user_notifications", ["user_id"])
    op.create_index("ix_user_notifications_type", "user_notifications", ["type"])
    op.create_index("ix_user_notifications_read_at", "user_notifications", ["read_at"])
    op.create_index("ix_user_notifications_created_at", "user_notifications", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_user_notifications_created_at", table_name="user_notifications")
    op.drop_index("ix_user_notifications_read_at", table_name="user_notifications")
    op.drop_index("ix_user_notifications_type", table_name="user_notifications")
    op.drop_index("ix_user_notifications_user_id", table_name="user_notifications")
    op.drop_table("user_notifications")

    op.drop_index("ix_programming_review_events_reviewed_at", table_name="programming_review_events")
    op.drop_index("ix_programming_review_events_reviewed_by_id", table_name="programming_review_events")
    op.drop_index("ix_programming_review_events_programming_id", table_name="programming_review_events")
    op.drop_table("programming_review_events")

    op.drop_index("ix_programmings_reviewed_at", table_name="programmings")
    op.drop_index("ix_programmings_review_status", table_name="programmings")
    op.drop_constraint("fk_programmings_reviewed_by_id_users", "programmings", type_="foreignkey")
    op.drop_column("programmings", "review_comment")
    op.drop_column("programmings", "reviewed_by_id")
    op.drop_column("programmings", "reviewed_at")
    op.drop_column("programmings", "review_status")
