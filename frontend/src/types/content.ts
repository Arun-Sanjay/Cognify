/**
 * Knowledge-base document types — mirror backend/app/schemas/document.py
 */

export type DocumentProcessingStatus = 'pending' | 'processing' | 'ready' | 'failed'

export interface Document {
  id: string
  uploaded_by_id: string
  /** `null` → shared with everyone; set → private to that user. */
  owner_id: string | null
  title: string
  file_name: string
  content_type: string | null
  file_size_bytes: number | null
  summary: string | null
  processing_status: DocumentProcessingStatus
  chunk_count: number
  created_at: string
}

export interface DocumentChunkPreview {
  id: string
  chunk_index: number
  chunk_text: string
  has_embedding: boolean
}

export interface SemanticSearchHit {
  chunk_id: string
  document_id: string
  document_title: string
  chunk_index: number
  chunk_text: string
  similarity: number
}

export interface SemanticSearchResponse {
  query: string
  hit_count: number
  hits: SemanticSearchHit[]
}
