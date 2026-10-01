"""Learn quizzes — attempts, responses, learner skills, item difficulty stats.

Revision ID: 000000000003
Revises: 000000000002
Create Date: 2026-10-01
"""
from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "000000000003"
down_revision = "000000000002"
branch_labels = None
depends_on = None

TABLES = ("quiz_attempts", "quiz_responses", "learner_skills", "quiz_item_stats")


def _ts(name: str, nullable: bool = False, server_default: bool = True) -> sa.Column:
    return sa.Column(
        name,
        sa.DateTime(timezone=True),
        server_default=sa.func.now() if server_default else None,
        nullable=nullable,
    )


def _user_fk() -> sa.Column:
    return sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False)


def upgrade() -> None:
    op.create_table(
        "quiz_attempts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_fk(),
        sa.Column("subject_id", sa.String(64), nullable=False),
        sa.Column("unit_id", sa.String(64), nullable=False),
        sa.Column("mode", sa.String(16), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("config", sa.JSON(), nullable=False),
        sa.Column("question_ids", sa.JSON(), nullable=False),
        sa.Column("answered", sa.Integer(), nullable=False),
        sa.Column("correct", sa.Integer(), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("max_score", sa.Float(), nullable=False),
        _ts("started_at"),
        _ts("completed_at", nullable=True, server_default=False),
    )
    op.create_index("ix_quiz_attempts_user_id", "quiz_attempts", ["user_id"])

    op.create_table(
        "quiz_responses",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "attempt_id", sa.Uuid(), sa.ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False
        ),
        _user_fk(),
        sa.Column("question_id", sa.String(32), nullable=False),
        sa.Column("subtopic", sa.String(64), nullable=False),
        sa.Column("difficulty", sa.Integer(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=True),
        sa.Column("is_correct", sa.Boolean(), nullable=False),
        sa.Column("marks_awarded", sa.Float(), nullable=False),
        sa.Column("time_ms", sa.Integer(), nullable=True),
        sa.Column("is_review", sa.Boolean(), nullable=False),
        sa.Column("p_expected", sa.Float(), nullable=True),
        sa.Column("skill_before", sa.Float(), nullable=True),
        sa.Column("skill_after", sa.Float(), nullable=True),
        _ts("created_at"),
    )
    op.create_index("ix_quiz_responses_attempt_id", "quiz_responses", ["attempt_id"])
    op.create_index("ix_quiz_responses_user_id", "quiz_responses", ["user_id"])
    op.create_index("ix_quiz_responses_question_id", "quiz_responses", ["question_id"])

    op.create_table(
        "learner_skills",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _user_fk(),
        sa.Column("subject_id", sa.String(64), nullable=False),
        sa.Column("unit_id", sa.String(64), nullable=False),
        sa.Column("skill_id", sa.String(96), nullable=False),
        sa.Column("rating", sa.Float(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("correct", sa.Integer(), nullable=False),
        _ts("updated_at"),
        sa.UniqueConstraint("user_id", "subject_id", "unit_id", "skill_id", name="uq_learner_skill"),
    )
    op.create_index("ix_learner_skills_user_id", "learner_skills", ["user_id"])

    op.create_table(
        "quiz_item_stats",
        sa.Column("item_key", sa.String(160), primary_key=True),
        sa.Column("difficulty", sa.Float(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("correct", sa.Integer(), nullable=False),
        _ts("updated_at"),
    )

    if op.get_bind().dialect.name == "postgresql":
        for table in TABLES:
            op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in reversed(TABLES):
        op.drop_table(table)
