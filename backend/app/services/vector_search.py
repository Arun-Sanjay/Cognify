"""Semantic search over knowledge-base chunks.

On Postgres + pgvector we lean on the `<=>` cosine-distance operator. On
SQLite (the local dev DB) there is no such operator, so we fall back to a
Python loop that computes cosine distance over the candidate chunks — fine
at local-dev scale.
"""
from __future__ import annotations

import logging
import math
import uuid
from dataclasses import dataclass

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.models.content import Document, DocumentChunk
from app.models.user import User, UserRole
from app.services import embeddings

logger = logging.getLogger(__name__)


def _is_sqlite(db: Session) -> bool:
    """True if the bound engine is SQLite."""
    bind = db.bind or db.get_bind()
    return bool(bind and bind.dialect.name == "sqlite")


def _embedding_to_list(value: object) -> list[float] | None:
    """Normalise a stored embedding to a plain list[float].

    pgvector's Vector type returns a numpy array on Postgres and a list (or a
    JSON-ish string) on SQLite. Returns None if the value can't be parsed.
    """
    if value is None:
        return None
    if hasattr(value, "tolist"):
        try:
            value = value.tolist()  # numpy.ndarray
        except Exception:  # noqa: BLE001
            pass
    if isinstance(value, (list, tuple)):
        try:
            return [float(x) for x in value]
        except Exception:  # noqa: BLE001
            return None
    if isinstance(value, str):
        cleaned = value.strip().lstrip("[").rstrip("]")
        if not cleaned:
            return None
        try:
            return [float(x) for x in cleaned.split(",")]
        except Exception:  # noqa: BLE001
            return None
    return None


def _cosine_distance(a: list[float], b: list[float]) -> float:
    """0 = identical, 2 = opposite. Mirrors pgvector's `<=>` operator."""
    dot = 0.0
    na = 0.0
    nb = 0.0
    for x, y in zip(a, b):
        dot += x * y
        na += x * x
        nb += y * y
    if na == 0 or nb == 0:
        return 2.0
    return 1.0 - dot / math.sqrt(na * nb)


@dataclass
class SearchHit:
    """A single search result — chunk + parent doc + similarity score."""

    chunk_id: uuid.UUID
    document_id: uuid.UUID
    document_title: str
    chunk_index: int
    chunk_text: str
    similarity: float  # 1.0 = identical, 0.0 = orthogonal


def visible_documents_filter(stmt: Select, user: User) -> Select:
    """Restrict a SELECT over `Document` to what `user` may read.

    Admins see everything; everyone else sees shared documents plus their own
    private ones. Keep in sync with `document.can_view_document`.
    """
    if user.role == UserRole.ADMIN:
        return stmt
    return stmt.where(or_(Document.owner_id.is_(None), Document.owner_id == user.id))


def search_chunks(
    db: Session,
    query: str,
    user: User,
    *,
    document_id: uuid.UUID | None = None,
    top_k: int = 5,
) -> list[SearchHit]:
    """Return the `top_k` chunks most semantically similar to `query`."""
    if not query.strip():
        return []

    query_vector = embeddings.embed_text(query)
    if not query_vector:
        logger.warning("vector_search: query embedding empty (model unavailable?)")
        return []

    base_stmt = (
        select(DocumentChunk, Document)
        .join(Document, DocumentChunk.document_id == Document.id)
        .where(DocumentChunk.embedding.isnot(None))
    )
    base_stmt = visible_documents_filter(base_stmt, user)
    if document_id is not None:
        base_stmt = base_stmt.where(Document.id == document_id)

    if _is_sqlite(db):
        scored: list[tuple[float, DocumentChunk, Document]] = []
        for chunk, document in db.execute(base_stmt).all():
            emb = _embedding_to_list(chunk.embedding)
            if emb is None or len(emb) != len(query_vector):
                continue
            scored.append((_cosine_distance(query_vector, emb), chunk, document))
        scored.sort(key=lambda x: x[0])
        rows = scored[:top_k]
    else:
        distance_expr = DocumentChunk.embedding.cosine_distance(query_vector)
        stmt = (
            base_stmt.add_columns(distance_expr.label("distance"))
            .order_by(distance_expr)
            .limit(top_k)
        )
        rows = [(float(d), c, doc) for c, doc, d in db.execute(stmt).all()]

    return [
        SearchHit(
            chunk_id=chunk.id,
            document_id=document.id,
            document_title=document.title,
            chunk_index=chunk.chunk_index,
            chunk_text=chunk.chunk_text,
            similarity=max(0.0, 1.0 - distance / 2.0),
        )
        for distance, chunk, document in rows
    ]
