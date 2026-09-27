import { useRef, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import Modal from '../ui/Modal'
import type { AssistantMode } from '../../types'

export interface ChatLayoutMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  isStreaming?: boolean
  /** Optional content rendered directly below the message bubble — used by
   *  the Knowledge Editor chat to render an inline edit-proposal card. */
  footer?: ReactNode
  /** Note Assistant mode the response was generated in (assistant rows only). */
  mode?: AssistantMode | null
}

export interface ChatLayoutProps {
  messages?: ChatLayoutMessage[]
  onSend: (text: string) => void
  placeholder?: string
  disabled?: boolean
  leftPanel?: ReactNode
  rightPanel?: ReactNode
  /** Mobile labels for the side panels (shown as chips that open a sheet). */
  leftPanelLabel?: string
  rightPanelLabel?: string
  suggestedQuestions?: string[]
  className?: string
  /** Rendered above the input (e.g. a mode selector). */
  inputAccessory?: ReactNode
}

export default function ChatLayout({
  messages = [],
  onSend,
  placeholder,
  disabled = false,
  leftPanel,
  rightPanel,
  leftPanelLabel = 'Menu',
  rightPanelLabel = 'Details',
  suggestedQuestions,
  className,
  inputAccessory,
}: ChatLayoutProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [mobilePanel, setMobilePanel] = useState<null | 'left' | 'right'>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const chip =
    'px-3 py-1.5 text-xs rounded-full border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors'

  return (
    <div className={clsx('flex gap-4 h-[calc(100dvh-8rem)]', className)}>
      {/* Desktop: docked left panel */}
      {leftPanel && (
        <div className="hidden md:block w-56 shrink-0 overflow-y-auto scroll-touch">{leftPanel}</div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile: open the side panels as bottom sheets */}
        {(leftPanel || rightPanel) && (
          <div className="md:hidden flex gap-2 pb-2 shrink-0">
            {leftPanel && (
              <button type="button" onClick={() => setMobilePanel('left')} className={chip}>{leftPanelLabel}</button>
            )}
            {rightPanel && (
              <button type="button" onClick={() => setMobilePanel('right')} className={chip}>{rightPanelLabel}</button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto scroll-touch space-y-4 pb-4">
          {messages.length === 0 && suggestedQuestions && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <p className="text-[var(--text-tertiary)] text-sm">Ask anything about your course materials</p>
              <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                {suggestedQuestions.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => onSend(q)}
                    className="px-3 py-1.5 text-xs rounded-full border border-[var(--border-default)]
                               text-[var(--text-secondary)] hover:text-[var(--text-primary)]
                               hover:border-[var(--border-strong)] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className="space-y-2">
              <ChatMessage role={msg.role} content={msg.content} sources={msg.sources} isStreaming={msg.isStreaming} />
              {msg.footer}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-[var(--border-default)] pt-3 pb-safe shrink-0">
          <ChatInput
            onSend={onSend}
            placeholder={placeholder}
            disabled={disabled}
            topAccessory={inputAccessory}
          />
        </div>
      </div>

      {/* Desktop: docked right panel */}
      {rightPanel && (
        <div className="hidden md:block w-64 shrink-0 overflow-y-auto scroll-touch">{rightPanel}</div>
      )}

      {/* Mobile: side panels as bottom sheets */}
      {leftPanel && (
        <Modal isOpen={mobilePanel === 'left'} onClose={() => setMobilePanel(null)} title={leftPanelLabel}>
          {leftPanel}
        </Modal>
      )}
      {rightPanel && (
        <Modal isOpen={mobilePanel === 'right'} onClose={() => setMobilePanel(null)} title={rightPanelLabel}>
          {rightPanel}
        </Modal>
      )}
    </div>
  )
}
