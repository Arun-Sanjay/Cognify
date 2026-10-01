"""Pydantic schemas for the Learn (curated video lectures) endpoints."""
from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

LectureLanguage = Literal["hinglish", "english"]


class UnitSummary(BaseModel):
    id: str
    name: str
    number: int | None = None
    available: bool = False
    topic_count: int = 0
    lecture_count: int = 0
    has_quiz: bool = False
    syllabus: str = ""


class SubjectSummary(BaseModel):
    id: str
    code: str
    name: str
    description: str = ""
    units: list[UnitSummary]


class CatalogResponse(BaseModel):
    subjects: list[SubjectSummary]


class LectureSummary(BaseModel):
    id: str
    youtube_id: str
    title: str
    channel: str = ""
    language: LectureLanguage = "english"
    duration_sec: int = 0
    views: int | None = None
    headline: str | None = None
    has_notes: bool = False


class TopicOutline(BaseModel):
    id: str
    number: int
    title: str
    summary: str = ""
    syllabus_points: list[str] = Field(default_factory=list)
    lectures: list[LectureSummary]


class SubjectRef(BaseModel):
    id: str
    code: str
    name: str


class UnitDetail(BaseModel):
    subject: SubjectRef
    id: str
    name: str
    description: str = ""
    syllabus: str = ""
    has_quiz: bool = False
    topics: list[TopicOutline]


class TranscriptSegment(BaseModel):
    start: float
    dur: float = 0
    text: str


class Transcript(BaseModel):
    source: str = ""  # e.g. "manual-en", "auto-en", "auto-hi→en"
    language: str = "en"
    segments: list[TranscriptSegment] = Field(default_factory=list)


class LectureDetail(BaseModel):
    id: str
    youtube_id: str
    subject_id: str
    unit_id: str
    topic_id: str
    topic_title: str
    title: str
    channel: str = ""
    channel_url: str | None = None
    language: LectureLanguage = "english"
    duration_sec: int = 0
    views: int | None = None
    likes: int | None = None
    comments: int | None = None
    upload_date: str | None = None
    why: str = ""
    comment_highlights: list[str] = Field(default_factory=list)
    transcript: Transcript = Field(default_factory=Transcript)
    # The notes deck is authored content with a flexible block structure — see
    # `content/learn/README.md` for the shape the frontend renders.
    notes: dict[str, Any] | None = None


class TutorMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=8000)


class TutorRequest(BaseModel):
    messages: list[TutorMessage] = Field(min_length=1, max_length=40)
    slide_id: str | None = Field(default=None, max_length=64)
