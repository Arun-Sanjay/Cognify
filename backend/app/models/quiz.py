"""Learn quizzes — attempts, per-question responses and the adaptive model's state.

The questions themselves are content (JSON under content/learn/<subject>/<unit>/quiz/),
not rows. The database holds what students did and what the adaptive engine has
learned from it:

- `QuizAttempt` / `QuizResponse` — one practice/adaptive/exam session and its answers.
- `LearnerSkill` — a student's Elo skill per subtopic and per topic
  (`skill_id == "topic:<topic id>"`), persisted across sessions.
- `QuizItemStat` — each question's Elo difficulty, learned from every student's answers.

`mode` and `status` are plain strings (validated in the schemas) rather than
Postgres enums, so adding a mode needs no enum migration.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

TOPIC_SKILL_PREFIX = "topic:"


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    mode: Mapped[str] = mapped_column(String(16), nullable=False)  # practice | adaptive | exam
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="active")  # active | completed
    # What the student asked for: {subtopics, difficulties, types, count, time_limit_sec}
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    # Question ids in the order served. Fixed up front for practice/exam; grows
    # one at a time in adaptive mode, where a missed question can reappear later
    # in the same session (spaced retrieval) — so ids may repeat there.
    question_ids: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    answered: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    max_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    responses: Mapped[list["QuizResponse"]] = relationship(
        back_populates="attempt", cascade="all, delete-orphan", order_by="QuizResponse.created_at"
    )


class QuizResponse(Base):
    __tablename__ = "quiz_responses"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    attempt_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("quiz_attempts.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question_id: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    subtopic: Mapped[str] = mapped_column(String(64), nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    # The student's answer: "B" | ["A","C"] | 12.5 | null (skipped)
    response: Mapped[object | None] = mapped_column(JSON)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    marks_awarded: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    time_ms: Mapped[int | None] = mapped_column(Integer)
    # Served as a spaced review of an earlier miss (same session or a later day).
    is_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # The adaptive model's prediction before the answer, and the skill move it caused.
    p_expected: Mapped[float | None] = mapped_column(Float)
    skill_before: Mapped[float | None] = mapped_column(Float)
    skill_after: Mapped[float | None] = mapped_column(Float)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    attempt: Mapped["QuizAttempt"] = relationship(back_populates="responses")


class LearnerSkill(Base):
    __tablename__ = "learner_skills"
    __table_args__ = (
        UniqueConstraint("user_id", "subject_id", "unit_id", "skill_id", name="uq_learner_skill"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    subject_id: Mapped[str] = mapped_column(String(64), nullable=False)
    unit_id: Mapped[str] = mapped_column(String(64), nullable=False)
    skill_id: Mapped[str] = mapped_column(String(96), nullable=False)  # subtopic id or "topic:<id>"
    rating: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)  # logit scale
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class QuizItemStat(Base):
    __tablename__ = "quiz_item_stats"

    # "<subject>/<unit>/<question id>" — question ids are only unique within a unit.
    item_key: Mapped[str] = mapped_column(String(160), primary_key=True)
    difficulty: Mapped[float] = mapped_column(Float, nullable=False)  # logit scale
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
