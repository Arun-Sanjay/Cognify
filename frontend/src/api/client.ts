import { useAuthStore } from '../store/authStore'
import type {
  AdminStatsResponse,
  AdminUserListResponse,
  AdminUserRow,
  AdminUserUpdate,
  AssistantMode,
  ChatMessage,
  ChatSession,
  ChatSessionCreate,
  ChatSessionWithMessages,
  ChatType,
  Document,
  DocumentChunkPreview,
  LearnCatalog,
  LearnUnitDetail,
  LectureDetail,
  LoginRequest,
  NotificationStatsResponse,
  NotificationStatusResponse,
  QuizAnswerResult,
  QuizAnswerValue,
  QuizAttemptDetail,
  QuizAttemptSummary,
  QuizOverview,
  SemanticSearchResponse,
  SignupRequest,
  StartQuizRequest,
  TokenResponse,
  TutorMessage,
  User,
} from '../types'

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://localhost:8000/api/v1'

export class ApiError extends Error {
  status: number
  detail: unknown
  body: unknown

  constructor(status: number, detail: unknown, body: unknown) {
    super(typeof detail === 'string' ? detail : 'Request failed')
    this.status = status
    this.detail = detail
    this.body = body
    this.name = 'ApiError'
  }
}

const AUTH_EXEMPT_PATHS = ['/auth/login', '/auth/signup']

interface ApiRequestOptions extends Omit<RequestInit, 'body' | 'headers' | 'method'> {
  method?: string
  body?: unknown
  headers?: Record<string, string>
}

export async function apiRequest<T = unknown>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { body, headers = {}, method = 'GET', ...rest } = options

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const finalHeaders: Record<string, string> = { ...headers }

  // Only set JSON content-type when the body isn't FormData — letting the browser
  // set the multipart boundary automatically.
  if (!isFormData && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json'
  }

  const token = useAuthStore.getState().token
  if (token && !finalHeaders.Authorization) {
    finalHeaders.Authorization = `Bearer ${token}`
  }

  let finalBody: BodyInit | undefined
  if (body === undefined || body === null) {
    finalBody = undefined
  } else if (isFormData || typeof body === 'string') {
    finalBody = body as BodyInit
  } else {
    finalBody = JSON.stringify(body)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    method,
    headers: finalHeaders,
    body: finalBody,
  })

  // Parse response body (JSON preferred)
  let data: unknown = null
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try {
      data = await response.json()
    } catch {
      data = null
    }
  } else {
    try {
      data = await response.text()
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const isAuthPath = AUTH_EXEMPT_PATHS.some((p) => path.startsWith(p))
    if (response.status === 401 && !isAuthPath) {
      useAuthStore.getState().logout()
    }
    const detail =
      (typeof data === 'object' && data !== null && 'detail' in data
        ? (data as { detail: unknown }).detail
        : null) ??
      (typeof data === 'string' ? data : null) ??
      `HTTP ${response.status}`
    throw new ApiError(response.status, detail, data)
  }

  return data as T
}

// ── Typed helpers ──

export const api = {
  get: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
}

// ── Auth-specific API calls ──

export const authApi = {
  signup: (data: SignupRequest) => api.post<TokenResponse>('/auth/signup', data),
  // `identifier` may be an email or a username.
  login: (identifier: string, password: string) =>
    api.post<TokenResponse>('/auth/login', { identifier, password } satisfies LoginRequest),
  me: () => api.get<User>('/auth/me'),
}

// ── Knowledge base (RAG documents) ──

export interface UploadDocumentOptions {
  file: File
  title?: string
}

export const documentsApi = {
  list: () => api.get<Document[]>('/documents/'),
  get: (id: string) => api.get<Document>(`/documents/${id}`),
  upload: ({ file, title }: UploadDocumentOptions) => {
    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    return api.post<Document>('/documents/upload', formData)
  },
  search: (query: string, opts?: { documentId?: string; topK?: number }) =>
    api.post<SemanticSearchResponse>('/documents/search', {
      query,
      document_id: opts?.documentId,
      top_k: opts?.topK,
    }),
  chunks: (id: string) => api.get<DocumentChunkPreview[]>(`/documents/${id}/chunks`),
  reprocess: (id: string) => api.post<Document>(`/documents/${id}/reprocess`),
  delete: (id: string) => api.delete<void>(`/documents/${id}`),
  downloadUrl: (id: string) => `${API_BASE_URL}/documents/${id}/download`,
}

// ── Chat (streaming RAG assistant) ──

/**
 * POST a JSON body and deliver the plain-text streaming response to `onChunk`
 * as it arrives (raw fetch + ReadableStream). Resolves when the stream ends.
 */
async function streamPost(
  path: string,
  body: unknown,
  onChunk: (delta: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const token = useAuthStore.getState().token
  if (!token) throw new ApiError(401, 'Not authenticated', null)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    let detail: unknown = `HTTP ${response.status}`
    try {
      const errBody = await response.json()
      detail = errBody.detail ?? detail
    } catch {
      // ignore
    }
    if (response.status === 401) useAuthStore.getState().logout()
    throw new ApiError(response.status, detail, null)
  }

  if (!response.body) {
    throw new ApiError(500, 'No response body from server', null)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    if (text) onChunk(text)
  }
  const tail = decoder.decode()
  if (tail) onChunk(tail)
}

export interface StreamMessageOptions {
  sessionId: string
  content: string
  mode?: AssistantMode
  onChunk: (delta: string) => void
  signal?: AbortSignal
}

export const chatApi = {
  listSessions: (chatType: ChatType = 'assistant', documentId?: string) => {
    const params = new URLSearchParams({ chat_type: chatType })
    if (documentId) params.set('document_id', documentId)
    return api.get<ChatSession[]>(`/chat/sessions?${params.toString()}`)
  },
  createSession: (data: ChatSessionCreate = {}) => api.post<ChatSession>('/chat/sessions', data),
  getSession: (id: string) => api.get<ChatSessionWithMessages>(`/chat/sessions/${id}`),
  deleteSession: (id: string) => api.delete<void>(`/chat/sessions/${id}`),

  /**
   * Stream a new message into an existing session. The Promise resolves once
   * the server is done streaming. Each text delta is delivered to `onChunk`.
   */
  streamMessage: ({ sessionId, content, mode, onChunk, signal }: StreamMessageOptions): Promise<void> =>
    streamPost(`/chat/sessions/${sessionId}/messages`, { content, mode }, onChunk, signal),

  sendMessageBlocking: (sessionId: string, content: string, mode?: AssistantMode) =>
    api.post<ChatMessage>(`/chat/sessions/${sessionId}/messages/blocking`, { content, mode }),
}

// ── Speech (ElevenLabs / Whisper — degrade to browser APIs when unavailable) ──

export interface SpeechStatus {
  asr_available: boolean
  tts_available: boolean
  agent_available: boolean
}

export const speechApi = {
  status: () => api.get<SpeechStatus>('/speech/status'),
  /** Returns a server-relative `/audio/...` URL — resolve it against the API origin. */
  tts: (text: string, voiceId?: string) =>
    api.post<{ audio_url: string; voice_id: string }>('/speech/tts', { text, voice_id: voiceId }),
  transcribe: (audio: Blob, filename = 'audio.webm', language = 'en') => {
    const formData = new FormData()
    formData.append('file', audio, filename)
    formData.append('language', language)
    return api.post<{ text: string }>('/speech/transcribe', formData)
  },
  agentSignedUrl: () => api.get<{ signed_url: string }>('/speech/agent/signed-url'),
  /** Absolute URL for a server-relative audio path. */
  audioUrl: (path: string) => `${new URL(API_BASE_URL).origin}${path}`,
}

// ── Learn (curated video lectures) ──

export interface AskTutorOptions {
  lectureId: string
  messages: TutorMessage[]
  slideId?: string | null
  onChunk: (delta: string) => void
  signal?: AbortSignal
}

export const learnApi = {
  catalog: () => api.get<LearnCatalog>('/learn/catalog'),
  unit: (subjectId: string, unitId: string) =>
    api.get<LearnUnitDetail>(`/learn/subjects/${subjectId}/units/${unitId}`),
  lecture: (lectureId: string) => api.get<LectureDetail>(`/learn/lectures/${lectureId}`),
  /** Stream the lecture tutor's answer. `messages` is the whole conversation, ending with the question. */
  ask: ({ lectureId, messages, slideId, onChunk, signal }: AskTutorOptions): Promise<void> =>
    streamPost(`/learn/lectures/${lectureId}/ask`, { messages, slide_id: slideId ?? null }, onChunk, signal),
  /** Absolute URL for a server-relative `/learn-media/...` path. */
  mediaUrl: (path: string) => (path.startsWith('/') ? `${new URL(API_BASE_URL).origin}${path}` : path),
}

export interface AskQuestionOptions {
  attemptId: string
  questionId: string
  messages: TutorMessage[]
  onChunk: (delta: string) => void
  signal?: AbortSignal
}

export const quizApi = {
  overview: (subjectId: string, unitId: string) =>
    api.get<QuizOverview>(`/learn/quiz/units/${subjectId}/${unitId}`),
  attempts: (subjectId: string, unitId: string) =>
    api.get<QuizAttemptSummary[]>(`/learn/quiz/units/${subjectId}/${unitId}/attempts`),
  start: (subjectId: string, unitId: string, data: StartQuizRequest) =>
    api.post<QuizAttemptDetail>(`/learn/quiz/units/${subjectId}/${unitId}/attempts`, data),
  attempt: (attemptId: string) => api.get<QuizAttemptDetail>(`/learn/quiz/attempts/${attemptId}`),
  answer: (attemptId: string, data: { question_id: string; response: QuizAnswerValue; time_ms?: number }) =>
    api.post<QuizAnswerResult>(`/learn/quiz/attempts/${attemptId}/answer`, data),
  finish: (attemptId: string) => api.post<QuizAttemptDetail>(`/learn/quiz/attempts/${attemptId}/finish`),
  /** Stream the AI tutor's help on an answered question. */
  ask: ({ attemptId, questionId, messages, onChunk, signal }: AskQuestionOptions): Promise<void> =>
    streamPost(`/learn/quiz/attempts/${attemptId}/questions/${questionId}/ask`, { messages }, onChunk, signal),
}

// ── Admin ──

export const adminApi = {
  stats: () => api.get<AdminStatsResponse>('/admin/stats'),
  listUsers: (params?: {
    role?: 'student' | 'teacher' | 'admin' | 'all'
    search?: string
    limit?: number
    offset?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.role) qs.set('role', params.role)
    if (params?.search) qs.set('search', params.search)
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.offset != null) qs.set('offset', String(params.offset))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<AdminUserListResponse>(`/admin/users${query}`)
  },
  updateUser: (id: string, data: AdminUserUpdate) =>
    api.patch<AdminUserRow>(`/admin/users/${id}`, data),
  notificationStatus: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams()
    if (params?.limit != null) qs.set('limit', String(params.limit))
    if (params?.offset != null) qs.set('offset', String(params.offset))
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return api.get<NotificationStatusResponse>(`/admin/notifications/status${query}`)
  },
  notificationStats: () => api.get<NotificationStatsResponse>('/admin/notifications/stats'),
}

export { API_BASE_URL }
