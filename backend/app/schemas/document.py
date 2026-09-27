"""Pydantic schemas for knowledge-base document endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

DocumentStatusLiteral = Literal["pending", "processing", "ready", "failed"]


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    uploaded_by_id: uuid.UUID
    # NULL = shared (teacher/admin upload). Set = private to that user.
    owner_id: uuid.UUID | None = None
    title: str
    file_name: str
    content_type: str | None = None
    file_size_bytes: int | None = None
    summary: str | None = None
    processing_status: DocumentStatusLiteral
    chunk_count: int = 0
    created_at: datetime


class DocumentChunkPreview(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    chunk_index: int
    chunk_text: str
    has_embedding: bool


class SemanticSearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=2000)
    document_id: uuid.UUID | None = None
    top_k: int = Field(5, ge=1, le=20)


class SemanticSearchHit(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    chunk_index: int
    chunk_text: str
    similarity: float


class SemanticSearchResponse(BaseModel):
    query: str
    hit_count: int
    hits: list[SemanticSearchHit]
