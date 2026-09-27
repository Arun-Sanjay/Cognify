import { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { baseMarkdownComponents } from '../markdownComponents'
import StepCard from './StepCard'
import AnswerBox from './AnswerBox'

export interface SolvedCardProps {
  /** "Solved 1", "Solved 2"... falls back to "Solved" if null. */
  index: number | null
  /** One-line problem statement, rendered as the card header. */
  problem: string
  /** The fence body (after metadata is stripped). Step / Answer headers
   *  inside this body are detected and rendered as `<StepCard>` / `<AnswerBox>`. */
  body: string
}

type Segment =
  | { kind: 'prose'; text: string }
  | { kind: 'step'; index: number; title: string; body: string }
  | { kind: 'answer'; body: string }

// Recognises "STEP 1 — TITLE", "STEP 1 - TITLE" (ASCII), "STEP 1 – TITLE" (en-dash).
const STEP_HEADER_RE = /^STEP\s+(\d+)\s*[—–-]\s*(.+?)\s*$/i
const ANSWER_HEADER_RE = /^ANSWER\s*$/i

function parseSolvedBody(body: string): Segment[] {
  const lines = body.split('\n')
  const out: Segment[] = []
  let cursor:
    | { kind: 'prose'; lines: string[] }
    | { kind: 'step'; index: number; title: string; lines: string[] }
    | { kind: 'answer'; lines: string[] }
    | null = null

  const flush = () => {
    if (!cursor) return
    const text = cursor.lines.join('\n').trim()
    if (cursor.kind === 'step') {
      out.push({ kind: 'step', index: cursor.index, title: cursor.title, body: text })
    } else if (cursor.kind === 'answer') {
      out.push({ kind: 'answer', body: text })
    } else if (text) {
      out.push({ kind: 'prose', text })
    }
    cursor = null
  }

  for (const line of lines) {
    const stepMatch = STEP_HEADER_RE.exec(line)
    const answerMatch = ANSWER_HEADER_RE.exec(line)
    if (stepMatch) {
      flush()
      cursor = {
        kind: 'step',
        index: parseInt(stepMatch[1]!, 10),
        title: stepMatch[2]!.trim(),
        lines: [],
      }
    } else if (answerMatch) {
      flush()
      cursor = { kind: 'answer', lines: [] }
    } else {
      if (!cursor) cursor = { kind: 'prose', lines: [] }
      cursor.lines.push(line)
    }
  }
  flush()
  return out
}

function renderProse(text: string) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseMarkdownComponents}>
      {text}
    </ReactMarkdown>
  )
}

/**
 * A worked-example card. Mirrors the "Solved 1" pattern from Claude.ai's
 * interactive solution UI: small badge top-left, problem statement header,
 * stacked step boxes, final boxed answer.
 */
export default function SolvedCard({ index, problem, body }: SolvedCardProps) {
  const segments = useMemo(() => parseSolvedBody(body), [body])
  const badge = index != null ? `Solved ${index}` : 'Solved'

  return (
    <section className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-4 my-3 shadow-[var(--shadow-card)] min-w-0 max-w-full overflow-hidden">
      <header className="flex items-start gap-3 mb-3">
        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold uppercase tracking-wider bg-success/10 text-success border border-success/20 shrink-0 mt-0.5">
          {badge}
        </span>
        <h3 className="text-sm font-semibold text-[var(--text-primary)] leading-snug m-0">
          {problem}
        </h3>
      </header>

      <div className="space-y-1">
        {segments.map((seg, i) => {
          if (seg.kind === 'step') {
            return (
              <StepCard
                key={i}
                index={seg.index}
                title={seg.title}
                body={renderProse(seg.body)}
              />
            )
          }
          if (seg.kind === 'answer') {
            return <AnswerBox key={i} body={renderProse(seg.body)} />
          }
          return (
            <div key={i} className="text-sm text-[var(--text-primary)] leading-relaxed">
              {renderProse(seg.text)}
            </div>
          )
        })}
      </div>
    </section>
  )
}
