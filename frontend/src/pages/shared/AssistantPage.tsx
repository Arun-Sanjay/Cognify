import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Info, Loader2, Plus } from 'lucide-react'
import ChatLayout, { type ChatLayoutMessage } from '../../components/chat/ChatLayout'
import ModeSelector from '../../components/chat/ModeSelector'
import Button from '../../components/ui/Button'
import Card from '../../components/ui/Card'
import { ApiError, chatApi } from '../../api/client'
import type { AssistantMode, ChatMessage, ChatSession, SourceCitation } from '../../types'

const SUGGESTED_BY_MODE: Record<AssistantMode, string[]> = {
  explain: [
    'Explain the core concept in simple terms',
    'Walk me through the most important idea',
    'How does this connect to other topics?',
  ],
  diagram: [
    'Draw a flowchart for the main process',
    'Show me the relationships as a diagram',
  ],
  questions: [
    'Give me 2 solved + 1 practice problem on this topic',
    'Quiz me with 3 unsolved problems',
  ],
}

// Per-browser remembered mode so the picker stays where the user left it.
const MODE_STORAGE_KEY = 'cognify-assistant-mode'

function readStoredMode(): AssistantMode {
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY)
    if (raw === 'explain' || raw === 'diagram' || raw === 'questions') return raw
  } catch {
    /* storage unavailable */
  }
  return 'explain'
}

function citationLabel(c: SourceCitation): string {
  return `${c.document_title} · chunk ${c.chunk_index + 1}`
}

function backendMessageToLayout(m: ChatMessage): ChatLayoutMessage {
  return {
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
    sources: m.source_citations?.map(citationLabel),
    mode: m.mode ?? null,
  }
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && typeof err.detail === 'string' ? err.detail : fallback
}

/** Streaming RAG chat over the knowledge base — the reference AI surface. */
export default function AssistantPage() {
  const [session, setSession] = useState<ChatSession | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [messages, setMessages] = useState<ChatLayoutMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [mode, setModeState] = useState<AssistantMode>(() => readStoredMode())
  const abortRef = useRef<AbortController | null>(null)

  const setMode = (next: AssistantMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(MODE_STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
  }

  // ── Resume the latest session (or start one) on mount ──
  useEffect(() => {
    let cancelled = false
    void (async () => {
      setSessionLoading(true)
      setChatError(null)
      try {
        const existing = await chatApi.listSessions('assistant')
        const s = existing[0] ?? (await chatApi.createSession({ chat_type: 'assistant' }))
        if (cancelled) return
        setSession(s)
        const full = await chatApi.getSession(s.id)
        if (cancelled) return
        setMessages(full.messages.map(backendMessageToLayout))
      } catch (err) {
        if (!cancelled) setChatError(errorText(err, 'Could not load the assistant'))
      } finally {
        if (!cancelled) setSessionLoading(false)
      }
    })()
    return () => {
      cancelled = true
      abortRef.current?.abort()
    }
  }, [])

  const handleSend = async (text: string) => {
    if (!session || streaming) return
    setChatError(null)
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', isStreaming: true, mode },
    ])
    setStreaming(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      await chatApi.streamMessage({
        sessionId: session.id,
        content: text,
        mode,
        signal: controller.signal,
        onChunk: (delta) => {
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.role === 'assistant') {
              next[next.length - 1] = { ...last, content: last.content + delta }
            }
            return next
          })
        },
      })
      // Refresh from the server to pick up persisted citations.
      const refreshed = await chatApi.getSession(session.id)
      setMessages(refreshed.messages.map(backendMessageToLayout))
    } catch (err) {
      if ((err as Error).name === 'AbortError') return
      setChatError(errorText(err, 'Failed to send message'))
      setMessages((prev) => prev.filter((m) => !(m.role === 'assistant' && m.isStreaming)))
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const handleNewChat = async () => {
    if (sessionLoading) return
    setSessionLoading(true)
    setMessages([])
    setChatError(null)
    try {
      setSession(await chatApi.createSession({ chat_type: 'assistant' }))
    } catch (err) {
      setChatError(errorText(err, 'Could not start a new chat'))
    } finally {
      setSessionLoading(false)
    }
  }

  return (
    <div className="space-y-4 h-[calc(100dvh-8rem)] flex flex-col">
      <Card className="flex items-center justify-between gap-3 py-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Info className="h-4 w-4 text-info shrink-0" />
          <span className="text-sm text-[var(--text-secondary)] truncate">
            Answers are grounded in the Library, with sources for every reply
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={Plus}
          onClick={() => void handleNewChat()}
          disabled={streaming || sessionLoading}
        >
          New chat
        </Button>
      </Card>

      {chatError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger shrink-0">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{chatError}</span>
        </div>
      )}

      {sessionLoading && messages.length === 0 ? (
        <Card className="flex-1 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
        </Card>
      ) : (
        <div className="flex-1 min-h-0">
          <ChatLayout
            messages={messages}
            onSend={(text) => void handleSend(text)}
            placeholder="Ask anything about your study material..."
            suggestedQuestions={messages.length === 0 ? SUGGESTED_BY_MODE[mode] : undefined}
            disabled={!session || streaming || sessionLoading}
            inputAccessory={<ModeSelector value={mode} onChange={setMode} disabled={streaming} />}
            className="!h-full"
          />
        </div>
      )}
    </div>
  )
}
