import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import { RotateCcw, Sparkles, X } from 'lucide-react'
import ChatMessage from '../chat/ChatMessage'
import ChatInput from '../chat/ChatInput'
import { ApiError, learnApi } from '../../api/client'
import { linkTimestamps } from './format'
import type { TutorMessage } from '../../types'

export interface TutorRequest {
  prompt: string
  slideId?: string
  /** Changes on every request so the same prompt can be sent twice. */
  nonce: number
}

export interface LectureTutorProps {
  lectureId: string
  lectureTitle: string
  open: boolean
  onClose: () => void
  /** A question pushed from elsewhere (e.g. a notes-slide action). */
  request: TutorRequest | null
  /** Jump the video to a timestamp the tutor cited. */
  onSeek: (seconds: number) => void
}


const SUGGESTIONS = [
  'Summarise this lecture in 5 bullet points',
  'What are the GATE traps in this topic?',
  'Give me a GATE-style numerical on this',
  'Draw a diagram of the main idea',
]

/**
 * Slide-over AI tutor grounded in the current lecture (notes + transcript).
 * The conversation lives in component state per lecture — it isn't persisted.
 */
export default function LectureTutor({ lectureId, lectureTitle, open, onClose, request, onSeek }: LectureTutorProps) {
  const [messages, setMessages] = useState<TutorMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const handled = useRef<number | null>(null)

  // New lecture → fresh conversation.
  useEffect(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
    setStreaming(false)
  }, [lectureId])

  useEffect(() => () => abortRef.current?.abort(), [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  const send = async (text: string, slideId?: string) => {
    if (streaming || !text.trim()) return
    const history: TutorMessage[] = [...messages, { role: 'user', content: text.trim() }]
    setMessages([...history, { role: 'assistant', content: '' }])
    setStreaming(true)
    setError(null)
    const controller = new AbortController()
    abortRef.current = controller
    try {
      await learnApi.ask({
        lectureId,
        messages: history,
        slideId,
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
      const message =
        e instanceof ApiError && e.status === 429
          ? 'You are asking a little fast — wait a few seconds and try again.'
          : e instanceof Error
            ? e.message
            : 'Something went wrong.'
      setError(message)
      setMessages(history) // drop the empty assistant bubble
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setStreaming(false)
      }
    }
  }

  // Questions pushed from the notes deck.
  useEffect(() => {
    if (!request || handled.current === request.nonce) return
    handled.current = request.nonce
    void send(request.prompt, request.slideId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request])

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
          'fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity xl:hidden',
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
            <div className="text-sm font-semibold text-[var(--text-primary)]">Lecture tutor</div>
            <div className="text-xs text-[var(--text-tertiary)] truncate">{lectureTitle}</div>
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

        <div
          className="flex-1 overflow-y-auto scroll-touch px-4 py-4 space-y-4"
          onClickCapture={(e) => {
            const link = (e.target as HTMLElement).closest('a[href^="#t="]')
            if (!link) return
            e.preventDefault()
            e.stopPropagation()
            onSeek(Number(link.getAttribute('href')!.slice(3)))
          }}
        >
          {messages.length === 0 && (
            <div className="space-y-4">
              <p className="text-sm text-[var(--text-secondary)]">
                Ask anything about this lecture. Answers are grounded in its notes and transcript, with
                timestamps you can jump to.
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTIONS.map((s) => (
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
              content={m.role === 'assistant' ? linkTimestamps(m.content) : m.content}
              isStreaming={streaming && i === messages.length - 1 && m.role === 'assistant'}
            />
          ))}
          {error && <p className="text-sm text-danger">{error}</p>}
          <div ref={endRef} />
        </div>

        <div className="px-4 py-3 border-t border-[var(--border-default)] pb-safe">
          <ChatInput onSend={(t) => void send(t)} disabled={streaming} placeholder="Ask about this lecture…" />
        </div>
      </aside>
    </>,
    document.body,
  )
}
