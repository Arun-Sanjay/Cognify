import { useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { Captions, Search, X } from 'lucide-react'
import { formatTimestamp } from './format'
import type { TranscriptSegment } from '../../types'

export interface TranscriptViewProps {
  segments: TranscriptSegment[]
  source: string
  onSeek: (seconds: number) => void
  getCurrentTime: () => number
}

interface Paragraph {
  start: number
  end: number
  text: string
}

/** Merge caption fragments into ~30 s paragraphs, breaking early at sentence ends. */
function toParagraphs(segments: TranscriptSegment[], target = 30): Paragraph[] {
  const out: Paragraph[] = []
  let cur: Paragraph | null = null
  for (const seg of segments) {
    if (!cur) cur = { start: seg.start, end: seg.start + seg.dur, text: '' }
    cur.text = cur.text ? `${cur.text} ${seg.text}` : seg.text
    cur.end = seg.start + seg.dur
    const long = cur.end - cur.start >= target
    if ((long && /[.?!]["')\]]?$/.test(seg.text)) || cur.end - cur.start >= target * 1.6) {
      out.push(cur)
      cur = null
    }
  }
  if (cur) out.push(cur)
  return out
}

const SOURCE_LABEL: Record<string, string> = {
  'manual-en': 'Creator-uploaded English subtitles',
  'auto-en': 'YouTube auto-generated English captions',
}

function highlight(text: string, query: string) {
  if (!query) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="rounded bg-warning/25 text-[var(--text-primary)] px-0.5">
        {part}
      </mark>
    ) : (
      part
    ),
  )
}

export default function TranscriptView({ segments, source, onSeek, getCurrentTime }: TranscriptViewProps) {
  const paragraphs = useMemo(() => toParagraphs(segments), [segments])
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(0)
  const [follow, setFollow] = useState(true)
  const activeRef = useRef<HTMLButtonElement | null>(null)

  // Poll the player so the paragraph being spoken stays highlighted.
  useEffect(() => {
    const id = window.setInterval(() => setNow(getCurrentTime()), 1000)
    return () => window.clearInterval(id)
  }, [getCurrentTime])

  const activeIndex = paragraphs.findIndex((p) => now >= p.start && now < p.end)

  useEffect(() => {
    if (follow && !query && activeIndex >= 0) {
      activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [activeIndex, follow, query])

  const q = query.trim()
  const visible = q ? paragraphs.filter((p) => p.text.toLowerCase().includes(q.toLowerCase())) : paragraphs
  const sourceLabel =
    SOURCE_LABEL[source] ?? (source.includes('→en') ? 'YouTube captions, auto-translated to English' : source)

  if (paragraphs.length === 0) {
    return <div className="card p-4 text-sm text-[var(--text-tertiary)]">No transcript is available for this lecture.</div>
  }

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-[var(--border-default)]">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the transcript…"
            className="input-base w-full pl-8 pr-8 py-1.5 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] select-none">
          <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />
          Follow video
        </label>
      </div>

      <div className="max-h-[560px] overflow-y-auto scroll-touch px-2 py-2">
        {visible.length === 0 && (
          <p className="px-3 py-6 text-center text-sm text-[var(--text-tertiary)]">No matches for “{q}”.</p>
        )}
        {visible.map((p) => {
          const active = !q && paragraphs[activeIndex] === p
          return (
            <button
              key={p.start}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onSeek(p.start)}
              className={clsx(
                'w-full text-left flex gap-3 rounded-lg px-3 py-2.5 transition-colors',
                active ? 'bg-[var(--bg-tertiary)]' : 'hover:bg-[var(--bg-tertiary)]',
              )}
            >
              <span
                className={clsx(
                  'shrink-0 w-12 pt-0.5 text-xs font-medium tabular-nums',
                  active ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]',
                )}
              >
                {formatTimestamp(p.start)}
              </span>
              <span
                className={clsx(
                  'text-[14px] leading-relaxed',
                  active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]',
                )}
              >
                {highlight(p.text, q)}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-1.5 px-4 py-2 border-t border-[var(--border-default)] text-[11px] text-[var(--text-tertiary)]">
        <Captions className="h-3.5 w-3.5" /> {sourceLabel} · click any line to jump there
      </div>
    </div>
  )
}
