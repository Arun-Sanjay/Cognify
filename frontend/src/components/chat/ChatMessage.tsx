import { useMemo } from 'react'
import { clsx } from 'clsx'
import { Bot, BookOpen, Network, ListChecks } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'
import Avatar from '../ui/Avatar'
import { baseMarkdownComponents } from './markdownComponents'
import FenceDispatcher from './cards/FenceDispatcher'
import type { AssistantMode } from '../../types'

export interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  isStreaming?: boolean
  /** Mode the response was rendered in. Shows a small pill above the bubble
   *  on assistant messages. Only meaningful for Note Assistant chats. */
  mode?: AssistantMode | null
}

const MODE_PILL: Record<AssistantMode, { label: string; Icon: LucideIcon }> = {
  explain: { label: 'Explain', Icon: BookOpen },
  diagram: { label: 'Diagram', Icon: Network },
  questions: { label: 'Questions', Icon: ListChecks },
}

// Languages we route into card components instead of rendering as plain code.
const CARD_LANGUAGES = new Set(['solved', 'unsolved', 'mermaid'])

/**
 * Append a synthetic closing fence if the streaming text ended mid-fence
 * (e.g. Claude hit max_tokens before producing the trailing ```). Otherwise
 * react-markdown swallows the entire tail as one runaway code block.
 */
function balanceFences(content: string, isStreaming: boolean): string {
  if (isStreaming) return content
  const matches = content.match(/```/g)
  const count = matches ? matches.length : 0
  if (count % 2 === 1) return content + '\n```'
  return content
}

// Build the assistant-side markdown components: shared base + a code override
// that dispatches recognised fence languages to the FenceDispatcher.
function buildAssistantComponents(isStreaming: boolean): Components {
  return {
    ...baseMarkdownComponents,
    code: ({ node, className, children, ...props }) => {
      const lang = (className ?? '').replace(/^language-/, '')
      if (lang && CARD_LANGUAGES.has(lang)) {
        const body = String(children ?? '').replace(/\n$/, '')
        // react-markdown exposes the post-language info-string at node.data.meta.
        const meta =
          (node as unknown as { data?: { meta?: string } } | undefined)?.data?.meta ??
          undefined
        const dispatched = (
          <FenceDispatcher
            language={lang}
            meta={meta}
            body={body}
            isStreaming={isStreaming}
          />
        )
        if (dispatched) return dispatched
      }
      // Fall through to ordinary code rendering (mirrors baseMarkdownComponents.code).
      const isBlock = (className ?? '').startsWith('language-')
      if (isBlock) {
        return (
          <code
            className={clsx(
              'block whitespace-pre overflow-x-auto rounded-md px-3 py-2 my-2 text-[12.5px] font-mono',
              'bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)]',
            )}
            {...props}
          >
            {children}
          </code>
        )
      }
      return (
        <code
          className="px-1 py-0.5 rounded text-[12.5px] font-mono bg-[var(--bg-tertiary)] border border-[var(--border-default)] text-[var(--text-primary)]"
          {...props}
        >
          {children}
        </code>
      )
    },
  }
}

export default function ChatMessage({ role, content, sources, isStreaming, mode }: ChatMessageProps) {
  const isUser = role === 'user'
  const pill = !isUser && mode && MODE_PILL[mode] ? MODE_PILL[mode] : null
  const assistantComponents = useMemo(
    () => buildAssistantComponents(Boolean(isStreaming)),
    [isStreaming],
  )
  const balanced = useMemo(
    () => balanceFences(content, Boolean(isStreaming)),
    [content, isStreaming],
  )

  return (
    <div className={clsx('flex gap-3', isUser && 'flex-row-reverse')}>
      {isUser ? (
        <Avatar name="You" size="sm" className="shrink-0 mt-1" />
      ) : (
        <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center shrink-0 mt-1">
          <Bot className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}

      <div
        className={clsx(
          'space-y-2 min-w-0',
          // Assistant bubbles need more horizontal room than user bubbles —
          // the mode-rendered Solved / Unsolved / Diagram cards look cramped
          // at the original 75% cap and were overflowing the viewport on
          // long step bodies. `min-w-0` lets the flex parent actually enforce
          // the cap.
          isUser ? 'max-w-[75%] items-end' : 'max-w-[88%]',
        )}
      >
        {pill && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] uppercase tracking-wider rounded bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
            <pill.Icon className="h-3 w-3" />
            {pill.label}
          </span>
        )}
        <div
          className={clsx(
            'rounded-2xl px-4 py-2.5 text-sm leading-relaxed min-w-0 overflow-hidden',
            isUser
              ? 'bg-primary text-primary-foreground rounded-tr-md whitespace-pre-wrap'
              : 'card rounded-tl-md text-[var(--text-primary)] chat-markdown',
          )}
        >
          {isUser ? (
            content
          ) : (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={assistantComponents}>
                {balanced}
              </ReactMarkdown>
              {/* Trim the awkward extra margin react-markdown leaves on the
                  very first/last children inside the bubble. */}
              <style>{`
                .chat-markdown > :first-child { margin-top: 0 !important; }
                .chat-markdown > :last-child { margin-bottom: 0 !important; }
              `}</style>
            </>
          )}
          {isStreaming && (
            <span className="inline-flex gap-1 ml-1 align-middle">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--text-tertiary)] animate-bounce" />
            </span>
          )}
        </div>

        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sources.map((src, i) => (
              <button
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] rounded-md
                           card text-[var(--text-secondary)]
                           hover:text-[var(--text-primary)] transition-colors"
              >
                <span>📄</span>
                <span>{src}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
