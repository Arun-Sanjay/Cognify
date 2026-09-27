"""Pydantic schemas for chat endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ChatTypeLiteral = Literal["assistant"]
MessageRoleLiteral = Literal["user", "assistant", "system"]
# Assistant response modes — picked per message.
AssistantModeLiteral = Literal["explain", "diagram", "questions"]


class SourceCitation(BaseModel):
    """A single citation pointing back to a knowledge-base chunk."""

    document_id: str
    document_title: str
    chunk_index: int
    similarity: float


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    session_id: uuid.UUID
    role: MessageRoleLiteral
    content: str
    source_citations: list[SourceCitation] | None = None
    # Mode the assistant rendered in (None for user messages).
    mode: AssistantModeLiteral | None = None
    created_at: datetime


class ChatSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    chat_type: ChatTypeLiteral
    document_id: uuid.UUID | None = None
    title: str | None = None
    created_at: datetime
    last_message_at: datetime


class ChatSessionWithMessages(ChatSessionResponse):
    messages: list[ChatMessageResponse] = []


class ChatSessionCreate(BaseModel):
    chat_type: ChatTypeLiteral = "assistant"
    document_id: uuid.UUID | None = None  # optional: scope retrieval to one document
    title: str | None = Field(None, max_length=255)


class ChatMessageRequest(BaseModel):
    """Body of POST /chat/sessions/{id}/messages."""

    content: str = Field(..., min_length=1, max_length=8000)
    mode: AssistantModeLiteral | None = "explain"
