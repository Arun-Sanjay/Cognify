import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { RotateCcw, Sparkles, X } from 'lucide-react'
import ChatMessage from '../chat/ChatMessage'
import ChatInput from '../chat/ChatInput'
import { ApiError, quizApi } from '../../api/client'
import type { TutorMessage } from '../../types'

export interface QuestionTutorProps {
  attemptId: string
  /** The question being discussed; null closes the drawer. */
  questionId: string | null
  questionLabel: string
  wasCorrect: boolean
  onClose: () => void
}

const SUGGESTIONS_WRONG = [
  'Why is my answer wrong?',
  'Explain the idea behind this from scratch',
  'Give me a similar question to try',
]
const SUGGESTIONS_RIGHT = [
  'Is there a faster way to solve this?',
  'What variations of this does GATE ask?',
  'Give me a harder version of this question',
]

/**
 * Slide-over AI tutor for one answered question. It sees the question, the
 * official solution and the student's answer; the chat isn't persisted.
 */
export default function QuestionTutor({ attemptId, questionId, questionLabel, wasCorrect, onClose }: QuestionTutorProps) {
  const open = questionId != null
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  // New question → fresh conversation.
  useEffect(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setStreaming(false)
  }, [questionId])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const send = async (text: string) => {
    if (!questionId || streaming || !text.trim()) return
    const history: TutorMessage[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await quizApi.ask({
        attemptId,
        questionId,
        messages: history,
        signal: controller.signal,
        onChunk: (delta) =>
          setMessages((prev) => {
            const next = [...prev]
            const last = next[next.length - 1]
            next[next.length - 1] = { ...last, content: last.content + delta }
            return next
          }),
      })
    } catch (e) {
      if (controller.signal.aborted) return
      setError(
        e instanceof ApiError && e.status === 429
          ? 'You are asking a little fast — wait a few seconds and try again.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong.',
      )
      setMessages(history)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setStreaming(false)
      }
    }
  }

  const reset = () => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setStreaming(false)
  }

  return createPortal(
    <>
      <div
        className={clsx(
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className={clsx(
          'fixed right-0 top-0 z-50 h-dvh w-full sm:w-[440px] flex flex-col',
          'bg-[var(--bg-secondary)] border-l border-[var(--border-default)] shadow-[var(--shadow-elevated)]',
          'transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        aria-hidden={!open}
      >
        <header className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)] pt-safe">
          <div className="h-8 w-8 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-default)] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[var(--text-primary)]" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-[var(--text-primary)]">AI tutor</div>
            <div className="text-xs text-[var(--text-tertiary)] truncate">{questionLabel}</div>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={reset}
              className="tap-target inline-flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              title="New conversation"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="tap-target inline-flex items-center justify-center rounded-lg text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            aria-label="Close tutor"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto scroll-touch px-4 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                The tutor knows this question, its worked solution and what you answered.
              </p>
              <div className="flex flex-col gap-2">
                {(wasCorrect ? SUGGESTIONS_RIGHT : SUGGESTIONS_WRONG).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="text-left rounded-lg border border-[var(--border-default)] px-3 py-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <ChatMessage
              key={i}
              role={m.role}
              content={m.content}
              isStreaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
            />
          ))}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div ref={endRef} />
        </div>

        <div className="px-4 py-3 border-t border-[var(--border-default)] pb-safe">
          <ChatInput onSend={(t) => void send(t)} disabled={streaming} placeholder="Ask about this question…" />
        </div>
      </aside>
    </>,
    document.body,
  )
}
