"""Learn quiz endpoints — question-bank overview, practice/exam/adaptive attempts, AI help."""
from __future__ import annotations

import uuid

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.deps import ClaudeRateLimited, CurrentUser, DbSession
from app.schemas.quiz import (
    AnswerRequest,
    AnswerResult,
    AttemptDetail,
    AttemptSummary,
    QuestionHelpRequest,
    QuizOverview,
    StartQuizRequest,
)
from app.services import quiz as quiz_service

router = APIRouter()


@router.get(
    "/units/{subject_id}/{unit_id}",
    response_model=QuizOverview,
    summary="Question bank by topic/subtopic, with the student's skill per subtopic",
)
def get_overview(subject_id: str, unit_id: str, user: CurrentUser, db: DbSession) -> QuizOverview:
    return QuizOverview(**quiz_service.overview(db, user, subject_id, unit_id))


@router.get(
    "/units/{subject_id}/{unit_id}/attempts",
    response_model=list[AttemptSummary],
    summary="The student's recent quizzes for a unit",
)
def list_attempts(subject_id: str, unit_id: str, user: CurrentUser, db: DbSession) -> list[AttemptSummary]:
    return [AttemptSummary(**a) for a in quiz_service.list_attempts(db, user, subject_id, unit_id)]


@router.post(
    "/units/{subject_id}/{unit_id}/attempts",
    response_model=AttemptDetail,
    status_code=201,
    summary="Start a practice, exam or adaptive quiz",
)
def start_attempt(
    subject_id: str, unit_id: str, data: StartQuizRequest, user: CurrentUser, db: DbSession
) -> AttemptDetail:
    return AttemptDetail(**quiz_service.start_attempt(db, user, subject_id, unit_id, data.model_dump()))


@router.get("/attempts/{attempt_id}", response_model=AttemptDetail, summary="A quiz attempt (resume or review)")
def get_attempt(attempt_id: uuid.UUID, user: CurrentUser, db: DbSession) -> AttemptDetail:
    return AttemptDetail(**quiz_service.attempt_detail(db, user, attempt_id))


@router.post(
    "/attempts/{attempt_id}/answer",
    response_model=AnswerResult,
    summary="Answer a question (instant feedback + next adaptive question, except in exam mode)",
)
def answer(attempt_id: uuid.UUID, data: AnswerRequest, user: CurrentUser, db: DbSession) -> AnswerResult:
    return AnswerResult(
        **quiz_service.submit_answer(db, user, attempt_id, data.question_id, data.response, data.time_ms)
    )


@router.post("/attempts/{attempt_id}/finish", response_model=AttemptDetail, summary="Finish / submit a quiz")
def finish(attempt_id: uuid.UUID, user: CurrentUser, db: DbSession) -> AttemptDetail:
    return AttemptDetail(**quiz_service.finish_attempt(db, user, attempt_id))


@router.post(
    "/attempts/{attempt_id}/questions/{question_id}/ask",
    summary="Ask the AI tutor about an answered question — streams plain-text deltas",
    response_class=StreamingResponse,
)
def ask_about_question(
    attempt_id: uuid.UUID, question_id: str, data: QuestionHelpRequest, user: ClaudeRateLimited, db: DbSession
):
    stream = quiz_service.stream_question_help(
        db, user, attempt_id, question_id, [m.model_dump() for m in data.messages]
    )
    # Resolve eagerly (all DB work happens before the first chunk) so errors are clean 4xx.
    first = next(stream, "")

    def event_stream():
        if first:
            yield first
        yield from stream

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
