"""Enable row-level security on every public table (Postgres only).

Supabase exposes the `public` schema over its REST API to anyone holding the
anon key. The backend connects as the table owner, which bypasses RLS, so
enabling RLS with no policies locks the REST API out without affecting the app.

Every future migration that creates a table must enable RLS on it too.

Revision ID: 000000000002
Revises: 000000000001
Create Date: 2026-09-27
"""
from __future__ import annotations

from alembic import op

revision = "000000000002"
down_revision = "000000000001"
branch_labels = None
depends_on = None

TABLES = (
    "alembic_version",
    "users",
    "student_profiles",
    "teacher_profiles",
    "documents",
    "document_chunks",
    "chat_sessions",
    "chat_messages",
    "notification_delivery",
)


def upgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
