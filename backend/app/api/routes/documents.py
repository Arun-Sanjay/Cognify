"""Knowledge-base endpoints: upload, list, get, download, chunks, search, reprocess, delete."""
from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, DbSession
from app.schemas.document import (
    DocumentChunkPreview,
    DocumentResponse,
    SemanticSearchHit,
    SemanticSearchRequest,
    SemanticSearchResponse,
)
from app.services import document as document_service
from app.services import vector_search
from app.services.document_processor import backfill_embeddings, process_document

router = APIRouter()


@router.get("/", response_model=list[DocumentResponse], summary="List visible documents")
def list_documents(db: DbSession, current_user: CurrentUser) -> list[DocumentResponse]:
    return document_service.list_documents(db, current_user)


@router.post(
    "/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload a document and trigger background ingestion (extract → chunk → embed → summarize)",
)
def upload_document(
    db: DbSession,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str | None = Form(None),
) -> DocumentResponse:
    response = document_service.upload_document(db, file=file, user=current_user, title=title)
    background_tasks.add_task(process_document, response.id)
    return response


@router.post(
    "/search",
    response_model=SemanticSearchResponse,
    summary="Semantic search over the knowledge base",
)
def semantic_search(
    request: SemanticSearchRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> SemanticSearchResponse:
    hits = vector_search.search_chunks(
        db,
        query=request.query,
        user=current_user,
        document_id=request.document_id,
        top_k=request.top_k,
    )
    return SemanticSearchResponse(
        query=request.query,
        hit_count=len(hits),
        hits=[
            SemanticSearchHit(
                chunk_id=h.chunk_id,
                document_id=h.document_id,
                document_title=h.document_title,
                chunk_index=h.chunk_index,
                chunk_text=h.chunk_text,
                similarity=h.similarity,
            )
            for h in hits
        ],
    )


@router.get("/{document_id}", response_model=DocumentResponse, summary="Get document metadata")
def get_document(document_id: uuid.UUID, db: DbSession, current_user: CurrentUser) -> DocumentResponse:
    document = document_service.get_document(db, document_id, current_user)
    return document_service.document_response(db, document)


@router.get(
    "/{document_id}/chunks",
    response_model=list[DocumentChunkPreview],
    summary="List a document's text chunks",
)
def list_document_chunks(
    document_id: uuid.UUID, db: DbSession, current_user: CurrentUser
) -> list[DocumentChunkPreview]:
    return document_service.list_chunks(db, document_id, current_user)


@router.post(
    "/{document_id}/reprocess",
    response_model=DocumentResponse,
    summary="Re-run the ingestion pipeline",
)
def reprocess_document(
    document_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
) -> DocumentResponse:
    document = document_service.get_modifiable_document(db, document_id, current_user)
    background_tasks.add_task(process_document, document.id)
    return document_service.document_response(db, document)


@router.post(
    "/{document_id}/embed-backfill",
    summary="Generate embeddings for chunks that don't have them yet",
)
def embed_backfill(
    document_id: uuid.UUID,
    db: DbSession,
    current_user: CurrentUser,
    background_tasks: BackgroundTasks,
) -> dict:
    document_service.get_modifiable_document(db, document_id, current_user)
    background_tasks.add_task(backfill_embeddings, document_id)
    return {"status": "scheduled", "document_id": str(document_id)}


@router.get("/{document_id}/download", summary="Download the raw file")
def download_document(document_id: uuid.UUID, db: DbSession, current_user: CurrentUser) -> FileResponse:
    document = document_service.get_document(db, document_id, current_user)
    storage_path = Path(document.storage_path)
    if not storage_path.exists():
        raise HTTPException(status_code=410, detail="File no longer exists on disk")
    return FileResponse(
        path=str(storage_path),
        media_type=document.content_type or "application/octet-stream",
        filename=document.file_name,
    )


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a document (file + chunks)",
)
def delete_document(document_id: uuid.UUID, db: DbSession, current_user: CurrentUser) -> None:
    document_service.delete_document(db, document_id, current_user)
