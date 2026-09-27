"""Knowledge-base document service: upload, list, retrieve, delete."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.content import Document, DocumentChunk, DocumentStatus
from app.models.user import User, UserRole
from app.schemas.document import DocumentChunkPreview, DocumentResponse
from app.services.vector_search import visible_documents_filter

# Uploads are stored at backend/uploads/documents/{file_uuid}_{filename}.
_BACKEND_ROOT = Path(__file__).resolve().parents[2]  # backend/
UPLOAD_ROOT = _BACKEND_ROOT / "uploads" / "documents"
ALLOWED_CONTENT_TYPES: set[str] = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",  # .pptx
    "application/vnd.ms-powerpoint",  # .ppt
    "text/plain",
    "text/markdown",
}
ALLOWED_EXTENSIONS: set[str] = {".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt", ".md"}
MAX_UPLOAD_BYTES = 25 * 1024 * 1024  # 25 MB


def can_view_document(document: Document, user: User) -> bool:
    """Admins see everything; others see shared docs + their own private ones."""
    if user.role == UserRole.ADMIN:
        return True
    return document.owner_id is None or document.owner_id == user.id


def can_modify_document(document: Document, user: User) -> bool:
    """Admins, the uploader, or the private owner may reprocess/delete."""
    if user.role == UserRole.ADMIN:
        return True
    return user.id in (document.uploaded_by_id, document.owner_id)


def _chunk_counts(db: Session, document_ids: list[uuid.UUID]) -> dict[uuid.UUID, int]:
    if not document_ids:
        return {}
    rows = db.execute(
        select(DocumentChunk.document_id, func.count(DocumentChunk.id))
        .where(DocumentChunk.document_id.in_(document_ids))
        .group_by(DocumentChunk.document_id)
    ).all()
    return {doc_id: int(count) for doc_id, count in rows}


def to_response(document: Document, chunk_count: int = 0) -> DocumentResponse:
    return DocumentResponse(
        id=document.id,
        uploaded_by_id=document.uploaded_by_id,
        owner_id=document.owner_id,
        title=document.title,
        file_name=document.file_name,
        content_type=document.content_type,
        file_size_bytes=document.file_size_bytes,
        summary=document.summary,
        processing_status=document.processing_status.value,
        chunk_count=chunk_count,
        created_at=document.created_at,
    )


def document_response(db: Session, document: Document) -> DocumentResponse:
    return to_response(document, _chunk_counts(db, [document.id]).get(document.id, 0))


def list_documents(db: Session, user: User) -> list[DocumentResponse]:
    stmt = visible_documents_filter(select(Document), user).order_by(Document.created_at.desc())
    documents = list(db.scalars(stmt).all())
    counts = _chunk_counts(db, [d.id for d in documents])
    return [to_response(d, counts.get(d.id, 0)) for d in documents]


def get_document(db: Session, document_id: uuid.UUID, user: User) -> Document:
    document = db.get(Document, document_id)
    # 404 (not 403) for invisible docs so private IDs don't leak.
    if document is None or not can_view_document(document, user):
        raise HTTPException(status_code=404, detail="Document not found")
    return document


def get_modifiable_document(db: Session, document_id: uuid.UUID, user: User) -> Document:
    document = get_document(db, document_id, user)
    if not can_modify_document(document, user):
        raise HTTPException(status_code=403, detail="You can't modify this document")
    return document


def list_chunks(db: Session, document_id: uuid.UUID, user: User) -> list[DocumentChunkPreview]:
    document = get_document(db, document_id, user)
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.document_id == document.id)
        .order_by(DocumentChunk.chunk_index)
        .all()
    )
    return [
        DocumentChunkPreview(
            id=c.id,
            chunk_index=c.chunk_index,
            chunk_text=c.chunk_text,
            has_embedding=c.embedding is not None,
        )
        for c in chunks
    ]


def upload_document(
    db: Session,
    file: UploadFile,
    user: User,
    *,
    title: str | None = None,
) -> DocumentResponse:
    """Validate + save a file to disk, then create a pending Document row.

    Teacher/admin uploads are shared with everyone; student uploads are private.
    """
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)

    original_name = file.filename or "untitled"
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"File extension '{ext}' not allowed. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )
    if file.content_type and file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Content type '{file.content_type}' not allowed.",
        )

    safe_name = Path(original_name).name  # strip any path components
    storage_path = UPLOAD_ROOT / f"{uuid.uuid4()}_{safe_name}"

    bytes_written = 0
    try:
        with storage_path.open("wb") as out:
            while chunk := file.file.read(1024 * 1024):
                bytes_written += len(chunk)
                if bytes_written > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File exceeds the {MAX_UPLOAD_BYTES // (1024 * 1024)} MB limit.",
                    )
                out.write(chunk)
    except HTTPException:
        storage_path.unlink(missing_ok=True)
        raise
    except Exception as e:  # noqa: BLE001
        storage_path.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {e}") from e
    finally:
        try:
            file.file.close()
        except Exception:  # noqa: BLE001
            pass

    document = Document(
        uploaded_by_id=user.id,
        owner_id=user.id if user.role == UserRole.STUDENT else None,
        title=(title or safe_name).strip(),
        file_name=safe_name,
        storage_path=str(storage_path.resolve()),
        content_type=file.content_type,
        file_size_bytes=bytes_written,
        processing_status=DocumentStatus.PENDING,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    return to_response(document)


def delete_document(db: Session, document_id: uuid.UUID, user: User) -> None:
    document = get_modifiable_document(db, document_id, user)
    try:
        Path(document.storage_path).unlink(missing_ok=True)
    except Exception:  # noqa: BLE001
        pass
    db.delete(document)
    db.commit()
