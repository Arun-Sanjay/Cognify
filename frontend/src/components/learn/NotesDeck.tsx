import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GalleryHorizontal,
  ListChecks,
  PlayCircle,
  Rows3,
  Sparkles,
  Target,
  Wand2,
} from 'lucide-react'
import { ImageZoomModal } from '../ui'
import { learnApi } from '../../api/client'
import NoteBlockView, { Md } from './NoteBlockView'
import { formatTimestamp } from './format'
import type { NoteSlide, NotesDeck as NotesDeckData, PracticeQuestion } from '../../types'

export interface NotesDeckProps {
  notes: NotesDeckData
  onSeek: (seconds: number) => void
  /** Hand a question to the lecture tutor, optionally focused on a slide. */
  onAsk: (prompt: string, slideId?: string) => void
}

const SLIDE_ACTIONS: { label: string; prompt: (title: string) => string }[] = [
  { label: 'Explain simpler', prompt: (t) => `Explain "${t}" more simply, like I'm seeing it for the first time.` },
  { label: 'Give an example', prompt: (t) => `Give me a fresh worked example for "${t}", GATE-style, solved step by step.` },
  { label: 'Quiz me', prompt: (t) => `Quiz me on "${t}": ask 3 GATE-style questions one at a time and wait for my answer.` },
]

function SlideCard({
  slide,
  index,
  total,
  onSeek,
  onAsk,
}: {
  slide: NoteSlide
  index: number
  total: number
  onSeek: (s: number) => void
  onAsk: NotesDeckProps['onAsk']
}) {
  const [zoom, setZoom] = useState(false)
  const image = slide.image ? learnApi.mediaUrl(slide.image) : null

  return (
    <article className="card p-0 overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-[var(--border-default)]">
        <div className="min-w-0">
          <div className="text-[11px] font-medium text-[var(--text-tertiary)] tabular-nums">
            {String(index + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
          </div>
          <h3 className="text-[17px] font-semibold text-[var(--text-primary)] leading-snug mt-0.5">{slide.title}</h3>
        </div>
        {slide.timestamp != null && (
          <button
            type="button"
            onClick={() => onSeek(slide.timestamp ?? 0)}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--border-default)] px-2.5 py-1 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
            title="Jump to this moment in the video"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            {formatTimestamp(slide.timestamp)}
          </button>
        )}
      </header>

      <div className={clsx('px-5 py-4 grid gap-5', image && 'lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]')}>
        <div className="space-y-3.5 min-w-0">
          {slide.blocks.map((block, i) => (
            <NoteBlockView key={i} block={block} />
          ))}
        </div>
        {image && (
          <figure className="min-w-0">
            <button
              type="button"
              onClick={() => setZoom(true)}
              className="block w-full overflow-hidden rounded-xl border border-[var(--border-default)] cursor-zoom-in"
            >
              <img src={image} alt={slide.image_caption ?? slide.title} loading="lazy" className="w-full h-auto" />
            </button>
            {slide.image_caption && (
              <figcaption className="mt-1.5 text-xs text-[var(--text-tertiary)]">{slide.image_caption}</figcaption>
            )}
            <ImageZoomModal isOpen={zoom} onClose={() => setZoom(false)}>
              <img src={image} alt={slide.image_caption ?? slide.title} className="max-h-[90vh] max-w-[95vw] object-contain" />
            </ImageZoomModal>
          </figure>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-1.5 px-5 py-3 border-t border-[var(--border-default)] bg-[var(--bg-secondary)]">
        <Sparkles className="h-3.5 w-3.5 text-[var(--text-tertiary)] mr-0.5" />
        {SLIDE_ACTIONS.map((action) => (
          <button
            key={action.label}
            type="button"
            onClick={() => onAsk(action.prompt(slide.title), slide.id)}
            className="rounded-full border border-[var(--border-default)] px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
          >
            {action.label}
          </button>
        ))}
      </footer>
    </article>
  )
}

function PracticeCard({ q, index }: { q: PracticeQuestion; index: number }) {
  const [picked, setPicked] = useState<number[]>([])
  const [revealed, setRevealed] = useState(false)
  const multi = q.type === 'msq'

  const toggle = (i: number) =>
    setPicked((prev) => (multi ? (prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]) : [i]))

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-info">
          Q{index + 1} · {q.type.toUpperCase()}
        </span>
      </div>
      <Md className="text-[var(--text-primary)]">{q.question}</Md>
      {q.options && q.options.length > 0 && (
        <div className="mt-3 grid gap-2">
          {q.options.map((opt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => toggle(i)}
              className={clsx(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                picked.includes(i)
                  ? 'border-[var(--border-strong)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)]',
              )}
            >
              <span className="font-semibold tabular-nums">{String.fromCharCode(65 + i)}.</span>
              <Md className="flex-1">{opt}</Md>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        className="mt-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        {revealed ? 'Hide answer' : 'Reveal answer'}
      </button>
      {revealed && (
        <div className="mt-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 fade-in">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-success mb-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Answer
          </div>
          <Md className="text-[var(--text-primary)]">{q.answer}</Md>
          {q.explanation && <Md className="mt-1.5 text-[13px]">{q.explanation}</Md>}
        </div>
      )}
    </div>
  )
}

export default function NotesDeck({ notes, onSeek, onAsk }: NotesDeckProps) {
  const [mode, setMode] = useState<'slides' | 'scroll'>('slides')
  const [index, setIndex] = useState(0)
  const slides = notes.slides ?? []
  const total = slides.length

  useEffect(() => setIndex(0), [notes])

  useEffect(() => {
    if (mode !== 'slides') return
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(total - 1, i + 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [mode, total])

  return (
    <div className="space-y-5">
      {/* Overview */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--text-tertiary)] mb-2">
          <span className="inline-flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" /> {total} slides
          </span>
          {notes.read_minutes != null && (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> {notes.read_minutes} min read
            </span>
          )}
          {notes.practice && notes.practice.length > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> {notes.practice.length} practice questions
            </span>
          )}
        </div>
        {notes.headline && (
          <h2 className="text-xl font-bold text-[var(--text-primary)] leading-snug">{notes.headline}</h2>
        )}
        {notes.summary && <Md className="mt-2">{notes.summary}</Md>}

        {((notes.key_takeaways?.length ?? 0) > 0 || (notes.gate_focus?.length ?? 0) > 0) && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {notes.key_takeaways && notes.key_takeaways.length > 0 && (
              <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)] mb-2">
                  <Wand2 className="h-3.5 w-3.5" /> Key takeaways
                </div>
                <ul className="space-y-1.5">
                  {notes.key_takeaways.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 mt-[3px] shrink-0 text-success" />
                      <Md className="flex-1 text-[13px]">{t}</Md>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {notes.gate_focus && notes.gate_focus.length > 0 && (
              <div className="rounded-xl border border-info/30 bg-info/5 px-4 py-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-info mb-2">
                  <Target className="h-3.5 w-3.5" /> What GATE asks
                </div>
                <ul className="space-y-1.5">
                  {notes.gate_focus.map((t, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
                      <Md className="flex-1 text-[13px]">{t}</Md>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Deck controls */}
      {total > 0 && (
        <div className="flex items-center justify-between gap-3">
          <div className="inline-flex rounded-lg border border-[var(--border-default)] p-0.5">
            {(
              [
                ['slides', 'Slides', GalleryHorizontal],
                ['scroll', 'All notes', Rows3],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  mode === value
                    ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
          {mode === 'slides' && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
                className="tap-target inline-flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                aria-label="Previous slide"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-xs tabular-nums text-[var(--text-tertiary)]">
                {index + 1} / {total}
              </span>
              <button
                type="button"
                onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
                disabled={index === total - 1}
                className="tap-target inline-flex items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                aria-label="Next slide"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {mode === 'slides' && total > 0 && (
        <>
          {/* Filmstrip of slide titles */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scroll-touch">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                className={clsx(
                  'shrink-0 max-w-[180px] truncate rounded-full border px-3 py-1 text-xs transition-colors',
                  i === index
                    ? 'border-[var(--border-strong)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                    : 'border-[var(--border-default)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                )}
                title={s.title}
              >
                {i + 1}. {s.title}
              </button>
            ))}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={slides[index].id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.18 }}
            >
              <SlideCard slide={slides[index]} index={index} total={total} onSeek={onSeek} onAsk={onAsk} />
            </motion.div>
          </AnimatePresence>
        </>
      )}

      {mode === 'scroll' && (
        <div className="space-y-4">
          {slides.map((s, i) => (
            <SlideCard key={s.id} slide={s} index={i} total={total} onSeek={onSeek} onAsk={onAsk} />
          ))}
        </div>
      )}

      {notes.practice && notes.practice.length > 0 && (
        <section>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)] mb-3">
            <ListChecks className="h-4 w-4" /> Practice
          </h3>
          <div className="grid gap-3">
            {notes.practice.map((q, i) => (
              <PracticeCard key={i} q={q} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
