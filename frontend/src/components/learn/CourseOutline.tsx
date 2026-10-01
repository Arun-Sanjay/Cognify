import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { clsx } from 'clsx'
import { CheckCircle2, ChevronDown, Circle, PlayCircle } from 'lucide-react'
import { formatDuration, LANGUAGE_LABEL } from './format'
import type { LanguagePreference } from '../../hooks/useLearnProgress'
import type { LearnUnitDetail } from '../../types'

export interface CourseOutlineProps {
  unit: LearnUnitDetail
  basePath: string
  activeLectureId?: string
  isDone: (lectureId: string) => boolean
  language: LanguagePreference
  onLanguageChange: (value: LanguagePreference) => void
}

const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'hinglish', label: 'Hinglish' },
  { value: 'english', label: 'English' },
  { value: 'both', label: 'Both' },
]

/** NPTEL-style left rail: topics as numbered "weeks", each listing its lectures. */
export default function CourseOutline({
  unit,
  basePath,
  activeLectureId,
  isDone,
  language,
  onLanguageChange,
}: CourseOutlineProps) {
  const topics = unit.topics.map((t) => ({
    ...t,
    lectures: language === 'both' ? t.lectures : t.lectures.filter((l) => l.language === language),
  }))
  const activeTopic = topics.find((t) => t.lectures.some((l) => l.id === activeLectureId))?.id
  const [open, setOpen] = useState<Set<string>>(() => new Set(activeTopic ? [activeTopic] : []))

  useEffect(() => {
    if (activeTopic) setOpen((prev) => (prev.has(activeTopic) ? prev : new Set(prev).add(activeTopic)))
  }, [activeTopic])

  const all = topics.flatMap((t) => t.lectures)
  const doneCount = all.filter((l) => isDone(l.id)).length
  const pct = all.length ? Math.round((doneCount / all.length) * 100) : 0

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <nav className="card p-0 overflow-hidden" aria-label="Course outline">
      <div className="px-4 pt-4 pb-3 border-b border-[var(--border-default)]">
        <Link to={basePath} className="block">
          <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
            {unit.subject.code} · Course outline
          </div>
          <div className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 hover:underline">{unit.name}</div>
        </Link>
        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
            <div className="h-full rounded-full bg-success transition-all" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-[11px] tabular-nums text-[var(--text-tertiary)]">
            {doneCount}/{all.length}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 rounded-lg border border-[var(--border-default)] p-0.5" role="radiogroup" aria-label="Lecture language">
          {LANGUAGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={language === opt.value}
              onClick={() => onLanguageChange(opt.value)}
              className={clsx(
                'rounded-md py-1 text-[11px] font-medium transition-colors',
                language === opt.value
                  ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="max-h-[calc(100dvh-260px)] overflow-y-auto scroll-touch py-1">
        {topics.map((topic) => {
          const expanded = open.has(topic.id)
          const topicDone = topic.lectures.length > 0 && topic.lectures.every((l) => isDone(l.id))
          return (
            <li key={topic.id}>
              <button
                type="button"
                onClick={() => toggle(topic.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-[var(--bg-tertiary)] transition-colors"
                aria-expanded={expanded}
              >
                <span
                  className={clsx(
                    'h-6 w-6 shrink-0 rounded-md text-[11px] font-semibold flex items-center justify-center tabular-nums border',
                    topicDone
                      ? 'border-success/40 bg-success/10 text-success'
                      : 'border-[var(--border-default)] text-[var(--text-secondary)]',
                  )}
                >
                  {topic.number}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13px] font-medium text-[var(--text-primary)] truncate">{topic.title}</span>
                  <span className="block text-[11px] text-[var(--text-tertiary)]">
                    {topic.lectures.length} lecture{topic.lectures.length === 1 ? '' : 's'}
                  </span>
                </span>
                <ChevronDown
                  className={clsx('h-4 w-4 text-[var(--text-tertiary)] transition-transform', expanded && 'rotate-180')}
                />
              </button>
              {expanded && (
                <ul className="pb-1.5">
                  {topic.lectures.map((lecture) => {
                    const active = lecture.id === activeLectureId
                    const done = isDone(lecture.id)
                    return (
                      <li key={lecture.id}>
                        <Link
                          to={`${basePath}/${lecture.id}`}
                          className={clsx(
                            'flex items-start gap-2.5 pl-[52px] pr-4 py-2 text-[12.5px] transition-colors',
                            active
                              ? 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
                          )}
                          aria-current={active ? 'page' : undefined}
                        >
                          {done ? (
                            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-success" />
                          ) : active ? (
                            <PlayCircle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--text-primary)]" />
                          ) : (
                            <Circle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-[var(--text-tertiary)]" />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block leading-snug line-clamp-2">{lecture.title}</span>
                            <span className="block mt-0.5 text-[11px] text-[var(--text-tertiary)]">
                              {LANGUAGE_LABEL[lecture.language]} · {lecture.channel} · {formatDuration(lecture.duration_sec)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
