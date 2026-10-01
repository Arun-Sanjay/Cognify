"""Pydantic schemas for Learn quizzes (question bank, attempts, adaptive practice)."""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from app.schemas.learn import TutorMessage

QuizMode = Literal["practice", "exam", "adaptive"]
QuestionType = Literal["mcq", "msq", "nat"]


class SkillView(BaseModel):
    subtopic: str
    rating: float
    attempts: int
    correct: int
    level: Literal["new", "learning", "proficient", "mastered"]
    readiness: float  # 0–100: predicted % of GATE 2-mark numericals answered right
    uncertainty: float  # Elo U(n): 1 = no evidence yet, shrinks with practice
    before: float | None = None
    readiness_before: float | None = None


class SubtopicOverview(BaseModel):
    id: str
    name: str
    question_count: int
    by_difficulty: dict[str, int]
    by_type: dict[str, int]
    by_difficulty_type: dict[str, int]  # "3:nat" → count
    seen: int
    reviews_due: int
    skill: SkillView


class TopicOverview(BaseModel):
    id: str
    title: str
    readiness: float | None = None  # mean over practised subtopics
    subtopics: list[SubtopicOverview]


class AttemptSummary(BaseModel):
    id: str
    mode: QuizMode
    status: Literal["active", "completed"]
    subject_id: str
    unit_id: str
    config: dict[str, Any]
    question_count: int
    answered: int
    correct: int
    score: float
    max_score: float
    started_at: datetime
    completed_at: datetime | None = None


class QuizOverview(BaseModel):
    subject_id: str
    unit_id: str
    question_count: int
    answered_total: int
    correct_total: int
    reviews_due: int
    topics: list[TopicOverview]
    recent_attempts: list[AttemptSummary]


class Question(BaseModel):
    """A question as served. Answer fields are present only once it may be revealed."""
    id: str
    topic_id: str
    subtopic: str
    difficulty: int
    type: QuestionType
    marks: int = 1
    est_seconds: int = 60
    concepts: list[str] = Field(default_factory=list)
    stem: str
    options: list[str] | None = None
    answer: Any = None
    explanation: str | None = None
    option_feedback: list[str] | None = None
    trap: str | None = None


class ResponseView(BaseModel):
    question_id: str
    response: Any = None
    is_correct: bool | None = None
    marks_awarded: float | None = None
    time_ms: int | None = None
    is_review: bool | None = None
    p_expected: float | None = None
    skill_before: float | None = None
    skill_after: float | None = None


class SubtopicResult(BaseModel):
    id: str
    name: str
    topic_id: str | None = None
    topic_title: str | None = None
    answered: int
    correct: int
    readiness_start: float | None = None
    skill: SkillView


class AttemptResults(BaseModel):
    subtopics: list[SubtopicResult]
    by_difficulty: dict[str, dict[str, int]]
    unanswered: int
    reviews: int
    total_time_ms: int
    focus_next: list[str]


class AttemptDetail(AttemptSummary):
    questions: list[Question]
    responses: list[ResponseView]
    # Adaptive mode: the question waiting for an answer (for resuming).
    current_question_id: str | None = None
    summary: AttemptResults | None = None


class StartQuizRequest(BaseModel):
    mode: QuizMode
    subtopics: list[str] = Field(min_length=1, max_length=100)
    difficulties: list[int] | None = Field(default=None, max_length=5)
    types: list[QuestionType] | None = Field(default=None, max_length=3)
    count: int = Field(default=10, ge=3, le=65)
    # Adaptive only — target success rate: challenge 60% / balanced 70% / confidence 80%.
    target: Literal["challenge", "balanced", "confidence"] = "balanced"


class AnswerRequest(BaseModel):
    question_id: str = Field(min_length=1, max_length=32)
    # "B" | ["A","C"] | 12.5 | null (skip / "I don't know")
    response: Any = None
    time_ms: int | None = Field(default=None, ge=0, le=6 * 3600 * 1000)


class AnswerResult(BaseModel):
    question_id: str
    recorded: bool
    done: bool
    # Present in practice/adaptive mode (instant feedback); absent in exam mode.
    is_correct: bool | None = None
    marks_awarded: float | None = None
    is_review: bool | None = None
    question: Question | None = None
    p_expected: float | None = None
    skill: SkillView | None = None
    next_question: Question | None = None
    next_is_review: bool = False


class QuestionHelpRequest(BaseModel):
    messages: list[TutorMessage] = Field(min_length=1, max_length=40)
