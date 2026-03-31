"""Add contextual help pages.

Revision ID: 0003_contextual_help_pages
Revises: 0002_operational_db_hardening
Create Date: 2026-03-31 00:40:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "0003_contextual_help_pages"
down_revision = "0002_operational_db_hardening"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contextual_help_pages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("slug", sa.String(), nullable=False),
        sa.Column("page_name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("updated_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["updated_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_contextual_help_pages_slug"), "contextual_help_pages", ["slug"], unique=True)

    op.create_table(
        "contextual_help_sections",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("page_id", sa.Integer(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=True),
        sa.ForeignKeyConstraint(["page_id"], ["contextual_help_pages.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("page_id", "position", name="uq_contextual_help_sections_page_position"),
    )
    op.create_index(op.f("ix_contextual_help_sections_page_id"), "contextual_help_sections", ["page_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_contextual_help_sections_page_id"), table_name="contextual_help_sections")
    op.drop_table("contextual_help_sections")
    op.drop_index(op.f("ix_contextual_help_pages_slug"), table_name="contextual_help_pages")
    op.drop_table("contextual_help_pages")
