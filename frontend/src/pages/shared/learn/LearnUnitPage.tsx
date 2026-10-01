import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Layers, ListChecks, LoaderCircle, PlayCircle, Timer } from 'lucide-react'
import { learnApi } from '../../../api/client'
import { useAuthStore } from '../../../store/authStore'
import { useLearnLanguage, useLearnProgress } from '../../../hooks/useLearnProgress'
import CourseOutline from '../../../components/learn/CourseOutline'
import LectureView from '../../../components/learn/LectureView'
import { formatDuration, LANGUAGE_LABEL } from '../../../components/learn/format'
import type { LearnUnitDetail } from '../../../types'

/**
 * A unit, NPTEL-style: the course outline on the left; on the right either the
 * course overview (no lecture selected) or the selected lecture.
 */
export default function LearnUnitPage() {
  const { subjectId = '', unitId = '', lectureId } = useParams()
  const role = useAuthStore((s) => s.user?.role ?? 'student')
  const { isDone, toggle } = useLearnProgress()
  const { language, setLanguage } = useLearnLanguage()
  const [unit, setUnit] = useState<LearnUnitDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  const learnPath = `/${role}/learn`
  const basePath = `${learnPath}/${subjectId}/${unitId}`

  useEffect(() => {
    let cancelled = false
    setUnit(null)
    setError(null)
    learnApi
      .unit(subjectId, unitId)
      .then((data) => !cancelled && setUnit(data))
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load unit'))
    return () => {
      cancelled = true
    }
  }, [subjectId, unitId])

  if (error) {
    return (
      <div className="space-y-4">
        <Link to={learnPath} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" /> All units
        </Link>
        <div className="card p-4 text-sm text-danger">{error}</div>
      </div>
    )
  }

  if (!unit) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading unit…
      </div>
    )
  }

  const lectures = unit.topics.flatMap((t) => t.lectures)
  const totalSeconds = lectures.reduce((sum, l) => sum + l.duration_sec, 0)
  const preferred = lectures.filter((l) => language === 'both' || l.language === language)
  const resume = preferred.find((l) => !isDone(l.id)) ?? preferred[0] ?? lectures[0]

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)] items-start">
      <aside className="lg:sticky lg:top-20 space-y-3 order-2 lg:order-1">
        <Link to={learnPath} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-3.5 w-3.5" /> All units
        </Link>
        <CourseOutline
          unit={unit}
          basePath={basePath}
          activeLectureId={lectureId}
          isDone={isDone}
          language={language}
          onLanguageChange={setLanguage}
        />
      </aside>

      <section className="order-1 lg:order-2 min-w-0">
        {lectureId ? (
          <LectureView
            key={lectureId}
            lectureId={lectureId}
            unit={unit}
            basePath={basePath}
            isDone={isDone}
            toggleDone={toggle}
            language={language}
          />
        ) : (
          <div className="space-y-5">
            <div className="card p-5">
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                {unit.subject.code} · {unit.subject.name}
              </div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">{unit.name}</h1>
              {unit.description && <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-3xl">{unit.description}</p>}
              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[var(--text-secondary)]">
                <span className="inline-flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> {unit.topics.length} topics</span>
                <span className="inline-flex items-center gap-1.5"><PlayCircle className="h-3.5 w-3.5" /> {lectures.length} lectures</span>
                <span className="inline-flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" /> {formatDuration(totalSeconds)} of video</span>
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> {lectures.filter((l) => isDone(l.id)).length} completed
                </span>
              </div>
              {unit.syllabus && (
                <div className="mt-4 rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                    Official GATE 2027 syllabus
                  </div>
                  <p className="text-[13px] text-[var(--text-secondary)]">{unit.syllabus}</p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {resume && (
                  <Link
                    to={`${basePath}/${resume.id}`}
                    className="inline-flex items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {lectures.some((l) => isDone(l.id)) ? 'Continue learning' : 'Start learning'}
                  </Link>
                )}
                {unit.has_quiz && (
                  <Link
                    to={`${basePath}/quiz`}
                    className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                  >
                    <ListChecks className="h-4 w-4" /> Practice quizzes
                  </Link>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {unit.topics.map((topic) => (
                <div key={topic.id} className="card p-4 flex flex-col">
                  <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
                    Topic {topic.number}
                  </div>
                  <div className="flex items-start gap-2 mt-0.5">
                    <h3 className="font-semibold text-[var(--text-primary)] flex-1">{topic.title}</h3>
                    {unit.has_quiz && (
                      <Link
                        to={`${basePath}/quiz?topic=${topic.id}`}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-[var(--border-default)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
                      >
                        <ListChecks className="h-3 w-3" /> Practice
                      </Link>
                    )}
                  </div>
                  {topic.summary && <p className="text-[13px] text-[var(--text-secondary)] mt-1">{topic.summary}</p>}
                  {topic.syllabus_points.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {topic.syllabus_points.map((p) => (
                        <span key={p} className="rounded-full border border-[var(--border-default)] px-2 py-0.5 text-[11px] text-[var(--text-tertiary)]">
                          {p}
                        </span>
                      ))}
                    </div>
                  )}
                  <ul className="mt-3 space-y-1 border-t border-[var(--border-default)] pt-2">
                    {topic.lectures.map((l) => (
                      <li key={l.id}>
                        <Link
                          to={`${basePath}/${l.id}`}
                          className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
                        >
                          {isDone(l.id) ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                          ) : (
                            <PlayCircle className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                          )}
                          <span className="truncate flex-1">{l.title}</span>
                          <span className="shrink-0 text-[11px] text-[var(--text-tertiary)]">
                            {LANGUAGE_LABEL[l.language]} · {formatDuration(l.duration_sec)}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
