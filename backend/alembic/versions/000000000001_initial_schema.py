"""Initial Cognify schema — users, knowledge base (RAG), chat, notifications.

Revision ID: 000000000001
Revises:
Create Date: 2026-09-27
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from pgvector.sqlalchemy import Vector

revision = "000000000001"
down_revision = None
branch_labels = None
depends_on = None

EMBEDDING_DIM = 384


def _is_postgres() -> bool:
    return op.get_bind().dialect.name == "postgresql"


def _enum(name: str, *values: str) -> sa.Enum:
    return sa.Enum(*values, name=name)


def _ts(name: str, nullable: bool = False, server_default: bool = True) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        server_default=sa.func.now() if server_default else None,
        nullable=nullable,
    )


def upgrade() -> None:
    if _is_postgres():
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # ── Users ──
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("role", _enum("user_role", "student", "teacher", "admin"), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_login", sa.DateTime(timezone=True), nullable=True),
        _ts("created_at"),
        _ts("updated_at"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_role", "users", ["role"])

    op.create_table(
        "student_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("branch", sa.String(100), nullable=True),
        _ts("created_at"),
    )
    op.create_table(
        "teacher_profiles",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("department_name", sa.String(255), nullable=True),
        sa.Column("designation", sa.String(255), nullable=True),
        _ts("created_at"),
    )

    # ── Knowledge base (RAG) ──
    op.create_table(
        "documents",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "uploaded_by_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("owner_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("file_name", sa.String(255), nullable=False),
        sa.Column("storage_path", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column(
            "processing_status",
            _enum("document_status", "pending", "processing", "ready", "failed"),
            nullable=False,
            server_default="pending",
        ),
        _ts("created_at"),
    )
    op.create_index("ix_documents_uploaded_by_id", "documents", ["uploaded_by_id"])
    op.create_index("ix_documents_owner_id", "documents", ["owner_id"])

    op.create_table(
        "document_chunks",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
        _ts("created_at"),
    )
    op.create_index("ix_document_chunks_document_id", "document_chunks", ["document_id"])
    if _is_postgres():
        op.execute(
            "CREATE INDEX ix_document_chunks_embedding_hnsw ON document_chunks "
            "USING hnsw (embedding vector_cosine_ops)"
        )

    # ── Chat ──
    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("chat_type", _enum("chat_type", "assistant"), nullable=False),
        sa.Column(
            "document_id", sa.Uuid(), sa.ForeignKey("documents.id", ondelete="SET NULL"), nullable=True
        ),
        sa.Column("title", sa.String(255), nullable=True),
        _ts("created_at"),
        _ts("last_message_at"),
    )
    op.create_index("ix_chat_sessions_user_id", "chat_sessions", ["user_id"])
    op.create_index("ix_chat_sessions_chat_type", "chat_sessions", ["chat_type"])
    op.create_index("ix_chat_sessions_document_id", "chat_sessions", ["document_id"])

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "session_id", sa.Uuid(), sa.ForeignKey("chat_sessions.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("role", _enum("message_role", "user", "assistant", "system"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("source_citations", sa.JSON(), nullable=True),
        sa.Column("assistant_meta", sa.JSON(), nullable=True),
        _ts("created_at"),
    )
    op.create_index("ix_chat_messages_session_id", "chat_messages", ["session_id"])

    # ── Notifications ──
    op.create_table(
        "notification_delivery",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "notification_type", _enum("notification_type", "system", "announcement"), nullable=False
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("sequence_number", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            _enum("notification_status", "sent", "acked", "failed", "pending"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("acked_at", sa.DateTime(timezone=True), nullable=True),
        _ts("created_at"),
    )
    op.create_index("ix_notification_delivery_user_id", "notification_delivery", ["user_id"])
    op.create_index(
        "ix_notification_delivery_sequence_number", "notification_delivery", ["sequence_number"]
    )


def downgrade() -> None:
    for table in (
        "notification_delivery",
        "chat_messages",
        "chat_sessions",
        "document_chunks",
        "documents",
        "teacher_profiles",
        "student_profiles",
        "users",
    ):
        op.drop_table(table)
    if _is_postgres():
        for enum_name in (
            "notification_status",
            "notification_type",
            "message_role",
            "chat_type",
            "document_status",
            "user_role",
        ):
            op.execute(f"DROP TYPE IF EXISTS {enum_name}")
