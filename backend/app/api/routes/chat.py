"""Chat endpoints — sessions + streaming RAG responses."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.api.deps import ClaudeRateLimited, CurrentUser, DbSession
from app.models.chat import ChatType
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionCreate,
    ChatSessionResponse,
    ChatSessionWithMessages,
    SourceCitation,
)
from app.services import ai_chat
from app.services import chat as chat_service
from app.services import document as document_service

router = APIRouter()


def _to_session_response(session) -> ChatSessionResponse:
    return ChatSessionResponse(
        id=session.id,
        user_id=session.user_id,
        chat_type=session.chat_type.value,
        document_id=session.document_id,
        title=session.title,
        created_at=session.created_at,
        last_message_at=session.last_message_at,
    )


def _to_message_response(message) -> ChatMessageResponse:
    citations: list[SourceCitation] | None = None
    if message.source_citations:
        citations = [SourceCitation(**c) for c in message.source_citations]
    meta = message.assistant_meta or {}
    mode = meta.get("mode") if isinstance(meta, dict) else None
    return ChatMessageResponse(
        id=message.id,
        session_id=message.session_id,
        role=message.role.value,
        content=message.content,
        source_citations=citations,
        mode=mode,
        created_at=message.created_at,
    )


# ═══════════════════════════════════════════════════════════════
# Session CRUD
# ═══════════════════════════════════════════════════════════════

@router.get(
    "/sessions",
    response_model=list[ChatSessionResponse],
    summary="List the current user's chat sessions (newest first)",
)
def list_sessions(
    db: DbSession,
    current_user: CurrentUser,
    chat_type: str = "assistant",
    document_id: uuid.UUID | None = None,
) -> list[ChatSessionResponse]:
    try:
        chat_type_enum = ChatType(chat_type)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid chat_type: {chat_type}")
    sessions = chat_service.list_sessions(db, current_user, chat_type_enum, document_id=document_id)
    return [_to_session_response(s) for s in sessions]


@router.post(
    "/sessions",
    response_model=ChatSessionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a new chat session",
)
def create_session(data: ChatSessionCreate, db: DbSession, current_user: CurrentUser) -> ChatSessionResponse:
    if data.document_id is not None:
        document_service.get_document(db, data.document_id, current_user)  # visibility check
    session = chat_service.create_session(
        db,
        user=current_user,
        chat_type=ChatType(data.chat_type),
        document_id=data.document_id,
        title=data.title,
    )
    return _to_session_response(session)


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionWithMessages,
    summary="Get a session with all of its messages",
)
def get_session(session_id: uuid.UUID, db: DbSession, current_user: CurrentUser) -> ChatSessionWithMessages:
    session = chat_service.get_session(db, session_id, current_user, eager_messages=True)
    return ChatSessionWithMessages(
        **_to_session_response(session).model_dump(),
        messages=[_to_message_response(m) for m in session.messages],
    )


@router.delete(
    "/sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a chat session and its messages",
)
def delete_session(session_id: uuid.UUID, db: DbSession, current_user: CurrentUser) -> None:
    chat_service.delete_session(db, session_id, current_user)


# ═══════════════════════════════════════════════════════════════
# Streaming RAG message endpoint
# ═══════════════════════════════════════════════════════════════

@router.post(
    "/sessions/{session_id}/messages",
    summary="Send a user message and stream the assistant's RAG response",
    response_class=StreamingResponse,
)
def send_message(
    session_id: uuid.UUID,
    data: ChatMessageRequest,
    db: DbSession,
    current_user: ClaudeRateLimited,
):
    """Returns a stream of plain-text deltas. Once the stream ends, the
    assistant message is persisted with its source citations — a follow-up
    GET /sessions/{id} returns the complete history."""
    session = chat_service.get_session(db, session_id, current_user)

    def event_stream():
        yield from ai_chat.stream_rag_response(
            db,
            user=current_user,
            session=session,
            user_message_text=data.content,
            mode=data.mode,
        )

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")


@router.post(
    "/sessions/{session_id}/messages/blocking",
    response_model=ChatMessageResponse,
    summary="Non-streaming version of /messages — returns the full assistant reply at once",
)
def send_message_blocking(
    session_id: uuid.UUID,
    data: ChatMessageRequest,
    db: DbSession,
    current_user: ClaudeRateLimited,
) -> ChatMessageResponse:
    session = chat_service.get_session(db, session_id, current_user)
    ai_chat.answer_question_blocking(
        db,
        user=current_user,
        session=session,
        user_message_text=data.content,
        mode=data.mode,
    )
    return _to_message_response(chat_service.list_messages(db, session)[-1])
