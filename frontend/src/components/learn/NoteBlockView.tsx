import { useState } from 'react'
import { clsx } from 'clsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlertTriangle, ChevronDown, Lightbulb, Sparkles, Target } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { baseMarkdownComponents } from '../chat/markdownComponents'
import MermaidDiagram from '../chat/cards/MermaidDiagram'
import type { NoteBlock } from '../../types'

export function Md({ children, className }: { children: string; className?: string }) {
  return (
    <div className={clsx('text-[14px] text-[var(--text-secondary)] [&>*:first-child]:mt-0 [&>*:last-child]:mb-0', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={baseMarkdownComponents}>
        {children}
      </ReactMarkdown>
    </div>
  )
}

const CALLOUTS: Record<
  'tip' | 'gate' | 'warning' | 'insight',
  { label: string; Icon: LucideIcon; box: string; icon: string }
> = {
  tip: { label: 'Tip', Icon: Lightbulb, box: 'border-success/30 bg-success/5', icon: 'text-success' },
  gate: { label: 'GATE focus', Icon: Target, box: 'border-info/30 bg-info/5', icon: 'text-info' },
  warning: { label: 'Common trap', Icon: AlertTriangle, box: 'border-warning/30 bg-warning/5', icon: 'text-warning' },
  insight: { label: 'Insight', Icon: Sparkles, box: 'border-[var(--border-strong)] bg-[var(--bg-tertiary)]', icon: 'text-[var(--gradient-accent)]' },
}

function ExampleBlock({ title, question, solution }: { title?: string; question: string; solution: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] overflow-hidden">
      <div className="px-4 pt-3 pb-2">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-info mb-1.5">
          {title ?? 'Worked example'}
        </div>
        <Md className="text-[var(--text-primary)]">{question}</Md>
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-t border-[var(--border-default)]"
      >
        <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        {open ? 'Hide solution' : 'Show solution'}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 fade-in">
          <Md>{solution}</Md>
        </div>
      )}
    </div>
  )
}

/** Renders one notes-deck block (see backend/content/learn/README.md). */
export default function NoteBlockView({ block }: { block: NoteBlock }) {
  switch (block.type) {
    case 'text':
      return <Md>{block.md}</Md>

    case 'bullets':
      return (
        <ul className="space-y-1.5">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--gradient-accent)]" />
              <Md className="flex-1">{item}</Md>
            </li>
          ))}
        </ul>
      )

    case 'steps':
      return (
        <div>
          {block.title && (
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2">
              {block.title}
            </div>
          )}
          <ol className="space-y-2">
            {block.items.map((item, i) => (
              <li key={i} className="flex gap-3">
                <span className="h-6 w-6 shrink-0 rounded-full border border-[var(--border-strong)] text-[11px] font-semibold flex items-center justify-center text-[var(--text-primary)]">
                  {i + 1}
                </span>
                <Md className="flex-1 pt-0.5">{item}</Md>
              </li>
            ))}
          </ol>
        </div>
      )

    case 'definition':
      return (
        <div className="rounded-xl border-l-[3px] border-[var(--gradient-accent)] bg-[var(--bg-tertiary)] px-4 py-3">
          <div className="text-sm font-semibold text-[var(--text-primary)] mb-1">{block.term}</div>
          <Md>{block.md}</Md>
        </div>
      )

    case 'formula':
      return (
        <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
          {block.label && (
            <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
              {block.label}
            </div>
          )}
          <div className="font-mono text-[15px] text-[var(--text-primary)] overflow-x-auto whitespace-pre-wrap">
            {block.expr}
          </div>
          {block.note && <Md className="mt-1.5 text-[13px]">{block.note}</Md>}
        </div>
      )

    case 'table':
      return (
        <div>
          <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
            <table className="w-full text-[13px]">
              <thead className="bg-[var(--bg-tertiary)]">
                <tr>
                  {block.headers.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-semibold text-[var(--text-primary)] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r} className="border-t border-[var(--border-default)]">
                    {row.map((cell, c) => (
                      <td key={c} className="px-3 py-2 align-top text-[var(--text-secondary)]">
                        <Md className="text-[13px]">{cell}</Md>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {block.caption && <p className="mt-1.5 text-xs text-[var(--text-tertiary)]">{block.caption}</p>}
        </div>
      )

    case 'compare':
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {[block.left, block.right].map((side, i) => (
            <div key={i} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
              <div className="text-sm font-semibold text-[var(--text-primary)] mb-2">{side.title}</div>
              <ul className="space-y-1.5">
                {side.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[var(--text-tertiary)]" />
                    <Md className="flex-1 text-[13px]">{item}</Md>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )

    case 'example':
      return <ExampleBlock title={block.title} question={block.question} solution={block.solution} />

    case 'callout': {
      const style = CALLOUTS[block.tone] ?? CALLOUTS.tip
      return (
        <div className={clsx('rounded-xl border px-4 py-3 flex gap-3', style.box)}>
          <style.Icon className={clsx('h-4 w-4 mt-0.5 shrink-0', style.icon)} />
          <div className="flex-1 min-w-0">
            <div className={clsx('text-xs font-semibold mb-0.5', style.icon)}>{block.title ?? style.label}</div>
            <Md className="text-[13.5px]">{block.md}</Md>
          </div>
        </div>
      )
    }

    case 'diagram':
      return (
        <figure>
          <MermaidDiagram source={block.mermaid} />
          {block.caption && (
            <figcaption className="mt-1.5 text-xs text-center text-[var(--text-tertiary)]">{block.caption}</figcaption>
          )}
        </figure>
      )

    case 'code':
      return (
        <pre className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3 overflow-x-auto text-[12.5px] font-mono text-[var(--text-primary)]">
          <code>{block.code}</code>
        </pre>
      )

    default:
      return null
  }
}
