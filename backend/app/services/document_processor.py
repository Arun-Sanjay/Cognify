"""Knowledge-base ingestion pipeline.

    1. Extract plaintext from the uploaded file (PyMuPDF / python-docx / text)
    2. Split into ~500-word chunks
    3. Embed all chunks in one batch (Sentence Transformers)
    4. Store DocumentChunk rows
    5. Generate an AI summary via Claude (optional, skipped if no API key)
    6. Mark the document 'ready' (or 'failed')

Runs in a FastAPI BackgroundTask so the upload endpoint returns immediately.
"""
from __future__ import annotations

import logging
import uuid

from sqlalchemy.orm import Session

from app.models.content import Document, DocumentChunk, DocumentStatus
from app.services import chunking, claude_client, embeddings, text_extraction

logger = logging.getLogger(__name__)


def process_document(document_id: uuid.UUID) -> None:
    """Run the full pipeline for a document in its own DB session."""
    # Imported here so the test suite's repointed SessionLocal is used.
    from app.core.database import SessionLocal

    with SessionLocal() as db:
        document = db.get(Document, document_id)
        if document is None:
            logger.error("process_document: document %s not found", document_id)
            return
        try:
            _run_pipeline(db, document)
        except Exception as e:  # noqa: BLE001
            logger.exception("Document processing failed for %s: %s", document_id, e)
            document.processing_status = DocumentStatus.FAILED
            db.commit()


def _fail(db: Session, document: Document) -> None:
    document.processing_status = DocumentStatus.FAILED
    db.commit()


def _run_pipeline(db: Session, document: Document) -> None:
    document.processing_status = DocumentStatus.PROCESSING
    db.commit()
    logger.info("Processing document %s (%s)", document.id, document.file_name)

    # ── 1. Extract text ──
    try:
        text = text_extraction.extract_text(document.storage_path)
    except text_extraction.UnsupportedFormat as e:
        logger.warning("Unsupported format for %s: %s", document.id, e)
        return _fail(db, document)
    except Exception:  # noqa: BLE001
        logger.exception("Text extraction failed for %s", document.id)
        return _fail(db, document)

    if not text.strip():
        logger.warning("Document %s extracted empty text", document.id)
        return _fail(db, document)

    # ── 2. Chunk ──
    chunks = chunking.split_into_chunks(text)
    if not chunks:
        return _fail(db, document)
    logger.info("Split %s into %d chunks", document.file_name, len(chunks))

    # Clear existing chunks (reprocessing)
    db.query(DocumentChunk).filter(DocumentChunk.document_id == document.id).delete()
    db.flush()

    # ── 3. Embed (batched) ──
    chunk_texts = [c.text for c in chunks]
    if embeddings.is_available():
        try:
            vectors = embeddings.embed_batch(chunk_texts)
        except Exception as e:  # noqa: BLE001
            logger.warning("Embedding batch failed for %s: %s", document.id, e)
            vectors = [[] for _ in chunks]
    else:
        logger.info("Embeddings unavailable — chunks will not be searchable")
        vectors = [[] for _ in chunks]

    # ── 4. Persist ──
    for chunk, vec in zip(chunks, vectors):
        db.add(
            DocumentChunk(
                document_id=document.id,
                chunk_index=chunk.index,
                chunk_text=chunk.text,
                embedding=vec if vec else None,
            )
        )
    db.flush()

    # ── 5. AI summary (best-effort) ──
    if claude_client.is_available():
        try:
            summary = claude_client.summarize_document(text)
            if summary:
                document.summary = summary
        except Exception as e:  # noqa: BLE001
            logger.warning("Summary generation failed for %s: %s", document.id, e)

    # ── 6. Ready ──
    document.processing_status = DocumentStatus.READY
    db.commit()
    logger.info("Document %s ready", document.id)


def backfill_embeddings(document_id: uuid.UUID) -> int:
    """Embed any chunks of `document_id` that are missing embeddings."""
    from app.core.database import SessionLocal

    if not embeddings.is_available():
        logger.warning("backfill_embeddings: embeddings not available")
        return 0

    with SessionLocal() as db:
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.document_id == document_id)
            .filter(DocumentChunk.embedding.is_(None))
            .order_by(DocumentChunk.chunk_index)
            .all()
        )
        if not chunks:
            return 0
        try:
            vectors = embeddings.embed_batch([c.chunk_text for c in chunks])
        except Exception as e:  # noqa: BLE001
            logger.exception("backfill_embeddings failed: %s", e)
            return 0

        updated = 0
        for chunk, vec in zip(chunks, vectors):
            if vec:
                chunk.embedding = vec
                updated += 1
        db.commit()
        return updated
