"""Learn endpoints — subject/unit catalog, lectures, and the streaming lecture tutor."""
from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from app.api.deps import ClaudeRateLimited, CurrentUser
from app.schemas.learn import (
    CatalogResponse,
    LectureDetail,
    SubjectSummary,
    TutorRequest,
    UnitDetail,
    UnitSummary,
)
from app.services import learn as learn_service

router = APIRouter()


@router.get("/catalog", response_model=CatalogResponse, summary="Subjects and their units")
def get_catalog(_: CurrentUser) -> CatalogResponse:
    subjects = [
        SubjectSummary(
            id=subject["id"],
            code=subject.get("code", ""),
            name=subject["name"],
            description=subject.get("description", ""),
            units=[UnitSummary(**unit) for unit in subject.get("units", [])],
        )
        for subject in learn_service.catalog_with_counts()
    ]
    return CatalogResponse(subjects=subjects)


@router.get(
    "/subjects/{subject_id}/units/{unit_id}",
    response_model=UnitDetail,
    summary="A unit's topics (NPTEL-style weeks) with their lectures",
)
def get_unit(subject_id: str, unit_id: str, _: CurrentUser) -> UnitDetail:
    return UnitDetail(**learn_service.get_unit(subject_id, unit_id))


@router.get(
    "/lectures/{lecture_id}",
    response_model=LectureDetail,
    summary="A lecture: video metadata, transcript, and notes deck",
)
def get_lecture(lecture_id: str, _: CurrentUser) -> LectureDetail:
    return LectureDetail(**learn_service.get_lecture(lecture_id))


@router.post(
    "/lectures/{lecture_id}/ask",
    summary="Ask the AI tutor about a lecture — streams plain-text deltas",
    response_class=StreamingResponse,
)
def ask_tutor(lecture_id: str, data: TutorRequest, _: ClaudeRateLimited):
    # Resolve eagerly so a bad id / bad history is a clean 4xx, not a broken stream.
    stream = learn_service.stream_lecture_answer(
        lecture_id,
        [m.model_dump() for m in data.messages],
        slide_id=data.slide_id,
    )
    first = next(stream, "")

    def event_stream():
        if first:
            yield first
        yield from stream

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
