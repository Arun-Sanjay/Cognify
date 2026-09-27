import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { baseMarkdownComponents } from '../markdownComponents'
import HintReveal from './HintReveal'

export interface UnsolvedCardProps {
  /** "Your turn 1"... falls back to "Your turn" if null. */
  index: number | null
  /** One-line problem statement, rendered as the card header. */
  problem: string
  /** Optional one-line hint hidden behind a "Show hint" button. */
  hint?: string | null
  /** Intro paragraphs + "Steps to try" markdown body. */
  body: string
}

/**
 * A practice-problem card (the "Your turn" variant from the Claude.ai
 * interactive solution UI). Amber border, problem statement header, body of
 * intro + steps-to-try, and a hideable hint at the bottom.
 */
export default function UnsolvedCard({ index, problem, hint, body }: UnsolvedCardProps) {
  const badge = index != null && index > 1 ? `Your turn ${index}` : 'Your turn'
  return (
    <section className="rounded-xl border border-warning/40 bg-warning/5 p-4 my-3 shadow-[var(--shadow-card)] min-w-0 max-w-full overflow-hidden">
      <header className="flex items-start gap-3 mb-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-warning/15 text-warning border border-warning/30 shrink-0 mt-0.5">
          {badge}
        </span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug m-0">
          {problem}
        </h3>
      </header>

      <div className="text-sm text-[var(--text-primary)] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseMarkdownComponents}>
          {body}
        </ReactMarkdown>
      </div>

      {hint && (
        <div className="mt-3">
          <HintReveal hint={hint} />
        </div>
      )}
    </section>
  )
}
