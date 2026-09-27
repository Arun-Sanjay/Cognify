/**
 * Chat types — mirror backend Pydantic schemas in backend/app/schemas/chat.py
 */

/** One value per chat surface; extend alongside the backend `ChatType` enum. */
export type ChatType = 'assistant'

export type MessageRole = 'user' | 'assistant' | 'system'

/**
 * Assistant response modes — picked per message.
 * - explain   — concept explanation in plain markdown (default)
 * - diagram   — Mermaid diagram followed by an explanation
 * - questions — solved / unsolved practice problems in fenced cards
 */
export type AssistantMode = 'explain' | 'diagram' | 'questions'

export interface SourceCitation {
  document_id: string
  document_title: string
  chunk_index: number
  similarity: number
}

export interface ChatMessage {
  id: string
  session_id: string
  role: MessageRole
  content: string
  source_citations: SourceCitation[] | null
  mode?: AssistantMode | null
  created_at: string
}

export interface ChatSession {
  id: string
  user_id: string
  chat_type: ChatType
  /** Optional: retrieval scoped to one document. */
  document_id: string | null
  title: string | null
  created_at: string
  last_message_at: string
}

export interface ChatSessionWithMessages extends ChatSession {
  messages: ChatMessage[]
}

export interface ChatSessionCreate {
  chat_type?: ChatType
  document_id?: string
  title?: string
}

export interface ChatMessageRequest {
  content: string
  mode?: AssistantMode
}
