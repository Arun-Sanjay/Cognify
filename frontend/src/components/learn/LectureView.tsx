import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  ExternalLink,
  Eye,
  FileText,
  Info,
  LoaderCircle,
  MessageSquare,
  NotebookPen,
  Quote,
  Sparkles,
  ThumbsUp,
  Timer,
} from 'lucide-react'
import { learnApi } from '../../api/client'
import { useYouTubePlayer } from '../../hooks/useYouTubePlayer'
import NotesDeck from './NotesDeck'
import TranscriptView from './TranscriptView'
import LectureTutor from './LectureTutor'
import type { TutorRequest } from './LectureTutor'
import { formatCount, formatDuration, LANGUAGE_LABEL } from './format'
import type { LanguagePreference } from '../../hooks/useLearnProgress'
import type { LearnUnitDetail, LectureDetail, LectureSummary } from '../../types'

export interface LectureViewProps {
  lectureId: string
  unit: LearnUnitDetail
  basePath: string
  isDone: (id: string) => boolean
  toggleDone: (id: string, value?: boolean) => void
  /** Prev/next walk only this language's lectures (plus the current one). */
  language: LanguagePreference
}

type Tab = 'notes' | 'transcript'

function uploadYear(date: string | null): string | null {
  return date && date.length >= 4 ? date.slice(0, 4) : null
}

export default function LectureView({ lectureId, unit, basePath, isDone, toggleDone, language }: LectureViewProps) {
  const [lecture, setLecture] = useState<LectureDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('notes')
  const [whyOpen, setWhyOpen] = useState(false)
  const [tutorOpen, setTutorOpen] = useState(false)
  const [tutorRequest, setTutorRequest] = useState<TutorRequest | null>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const player = useYouTubePlayer(hostRef, lecture?.youtube_id ?? '')

  useEffect(() => {
    let cancelled = false
    setLecture(null)
    setError(null)
    setWhyOpen(false)
    learnApi
      .lecture(lectureId)
      .then((data) => {
        if (cancelled) return
        setLecture(data)
        setTab(data.notes?.slides?.length ? 'notes' : 'transcript')
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load lecture'))
    return () => {
      cancelled = true
    }
  }, [lectureId])

  // Order + siblings come from the unit outline, so they render before the lecture loads.
  const flat: LectureSummary[] = unit.topics
    .flatMap((t) => t.lectures)
    .filter((l) => language === 'both' || l.language === language || l.id === lectureId)
  const position = flat.findIndex((l) => l.id === lectureId)
  const prev = position > 0 ? flat[position - 1] : null
  const next = position >= 0 && position < flat.length - 1 ? flat[position + 1] : null
  const topic = unit.topics.find((t) => t.lectures.some((l) => l.id === lectureId))
  const done = isDone(lectureId)

  const seek = (seconds: number) => {
    player.seekTo(seconds)
    hostRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const ask = (prompt: string, slideId?: string) => {
    setTutorOpen(true)
    setTutorRequest({ prompt, slideId, nonce: Date.now() })
  }

  if (error) {
    return <div className="card p-4 text-sm text-danger">{error}</div>
  }

  return (
    <div className="space-y-5 min-w-0">
      {/* Topic header + language/part tabs */}
      {topic && (
        <div>
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            Topic {topic.number} · {topic.title}
          </div>
          {topic.lectures.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5" role="tablist" aria-label="Lectures in this topic">
              {topic.lectures.map((l) => {
                const sameLang = topic.lectures.filter((x) => x.language === l.language)
                const part = sameLang.length > 1 ? ` · Part ${sameLang.indexOf(l) + 1}` : ''
                return (
                  <Link
                    key={l.id}
                    to={`${basePath}/${l.id}`}
                    role="tab"
                    aria-selected={l.id === lectureId}
                    className={clsx(
                      'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                      l.id === lectureId
                        ? 'border-[var(--border-strong)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                        : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                    )}
                  >
                    {isDone(l.id) && <CheckCircle2 className="h-3 w-3 text-success" />}
                    {LANGUAGE_LABEL[l.language]}
                    {part}
                    <span className="text-[var(--text-tertiary)] font-normal">· {l.channel}</span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Player */}
      <div className="overflow-hidden rounded-card border border-[var(--border-default)] bg-black aspect-video">
        <div ref={hostRef} className="h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      </div>

      {!lecture ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading lecture…
        </div>
      ) : (
        <>
          {/* Title + meta */}
          <div className="space-y-3">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--text-primary)] leading-snug">{lecture.title}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-secondary)]">
              <a
                href={lecture.channel_url ?? `https://www.youtube.com/watch?v=${lecture.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--text-primary)] hover:underline"
              >
                {lecture.channel}
              </a>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" /> {formatCount(lecture.views)} views
              </span>
              <span className="inline-flex items-center gap-1">
                <ThumbsUp className="h-3.5 w-3.5" /> {formatCount(lecture.likes)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" /> {formatCount(lecture.comments)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Timer className="h-3.5 w-3.5" /> {formatDuration(lecture.duration_sec)}
              </span>
              <span className="rounded-full border border-[var(--border-default)] px-2 py-0.5">
                {LANGUAGE_LABEL[lecture.language]}
              </span>
              {uploadYear(lecture.upload_date) && <span>{uploadYear(lecture.upload_date)}</span>}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => toggleDone(lectureId)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                  done
                    ? 'border-success/40 bg-success/10 text-success'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
                )}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                {done ? 'Completed' : 'Mark as complete'}
              </button>
              <button
                type="button"
                onClick={() => setTutorOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-tertiary)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] hover:opacity-90"
              >
                <Sparkles className="h-3.5 w-3.5" /> Ask AI tutor
              </button>
              {lecture.why && (
                <button
                  type="button"
                  onClick={() => setWhyOpen((o) => !o)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  aria-expanded={whyOpen}
                >
                  <Info className="h-3.5 w-3.5" /> Why this video?
                </button>
              )}
              <a
                href={`https://www.youtube.com/watch?v=${lecture.youtube_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                <ExternalLink className="h-3.5 w-3.5" /> YouTube
              </a>
            </div>

            {whyOpen && (
              <div className="card p-4 fade-in space-y-3">
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{lecture.why}</p>
                {lecture.comment_highlights.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      What viewers say
                    </div>
                    {lecture.comment_highlights.map((c, i) => (
                      <div key={i} className="flex gap-2 text-[13px] text-[var(--text-secondary)]">
                        <Quote className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
                        <span className="italic">{c}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes / Transcript tabs */}
          <div className="border-b border-[var(--border-default)] flex gap-1" role="tablist">
            {(
              [
                ['notes', 'AI Notes', NotebookPen],
                ['transcript', 'Transcript', FileText],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={clsx(
                  '-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                  tab === value
                    ? 'border-[var(--gradient-accent)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
                )}
              >
                <Icon className="h-4 w-4" /> {label}
              </button>
            ))}
          </div>

          {tab === 'notes' &&
            (lecture.notes?.slides?.length ? (
              <NotesDeck notes={lecture.notes} onSeek={seek} onAsk={ask} />
            ) : (
              <div className="card p-4 text-sm text-[var(--text-tertiary)]">Notes for this lecture are being prepared.</div>
            ))}
          {tab === 'transcript' && (
            <TranscriptView
              segments={lecture.transcript.segments}
              source={lecture.transcript.source}
              onSeek={seek}
              getCurrentTime={player.getCurrentTime}
            />
          )}

          {/* Prev / next */}
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            {prev ? (
              <Link to={`${basePath}/${prev.id}`} className="card-hover p-4 flex items-center gap-3">
                <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                <span className="min-w-0">
                  <span className="block text-[11px] text-[var(--text-tertiary)]">Previous</span>
                  <span className="block text-sm text-[var(--text-primary)] truncate">{prev.title}</span>
                </span>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                to={`${basePath}/${next.id}`}
                onClick={() => toggleDone(lectureId, true)}
                className="card-hover p-4 flex items-center gap-3 sm:text-right sm:flex-row-reverse"
              >
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] text-[var(--text-tertiary)]">Next · marks this one complete</span>
                  <span className="block text-sm text-[var(--text-primary)] truncate">{next.title}</span>
                </span>
              </Link>
            )}
          </div>

          <LectureTutor
            lectureId={lecture.id}
            lectureTitle={lecture.title}
            open={tutorOpen}
            onClose={() => setTutorOpen(false)}
            request={tutorRequest}
            onSeek={seek}
          />
        </>
      )}
    </div>
  )
}
