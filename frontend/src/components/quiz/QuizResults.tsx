import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { ArrowRight, Brain, CheckCircle2, Clock, PlayCircle, RotateCcw, Sparkles, Target, XCircle } from 'lucide-react'
import { quizApi } from '../../api/client'
import Button from '../ui/Button'
import QuestionCard from './QuestionCard'
import QuestionTutor from './QuestionTutor'
import { MasteryBadge, SkillMeter } from './ReadinessBar'
import { DIFFICULTY_LABEL, formatClock } from './quizFormat'
import type { QuizAttemptDetail, QuizResponseView } from '../../types'

export interface QuizResultsProps {
  attempt: QuizAttemptDetail
  subtopicName: (id: string) => string
  /** Base path of the unit (`/student/learn/cs/os`). */
  unitPath: string
}

type Filter = 'all' | 'wrong' | 'unanswered'

export default function QuizResults({ attempt, subtopicName, unitPath }: QuizResultsProps) {
  const navigate = useNavigate()
  const summary = attempt.summary
  const [filter, setFilter] = useState<Filter>('all')
  const [tutorFor, setTutorFor] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)

  // Last response per question (adaptive mode can re-ask a missed one).
  const lastResponse = useMemo(() => {
    const m = new Map<string, QuizResponseView>()
    for (const r of attempt.responses) m.set(r.question_id, r)
    return m
  }, [attempt.responses])

  if (!summary) return null
  const exam = attempt.mode === 'exam'
  const accuracy = attempt.answered ? Math.round((100 * attempt.correct) / attempt.answered) : 0
  const focus = summary.subtopics.filter((s) => summary.focus_next.includes(s.id))

  const practiseFocus = async () => {
    setStarting(true)
    try {
      const next = await quizApi.start(attempt.subject_id, attempt.unit_id, {
        mode: 'adaptive',
        subtopics: summary.focus_next,
        count: 10,
        target: 'balanced',
      })
      navigate(`${unitPath}/quiz/${next.id}`)
    } catch {
      setStarting(false)
    }
  }

  const reviewed = attempt.questions.filter((q) => {
    const r = lastResponse.get(q.id)
    if (filter === 'wrong') return r && r.response != null && !r.is_correct
    if (filter === 'unanswered') return !r || r.response == null
    return true
  })

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
          {exam ? 'Mock test' : attempt.mode === 'adaptive' ? 'Adaptive practice' : 'Practice'} · results
        </div>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-3">
            <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {exam ? `${attempt.score}` : `${attempt.correct}/${attempt.answered}`}
              {exam && <span className="text-sm font-medium text-[var(--text-tertiary)]"> / {attempt.max_score}</span>}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">{exam ? 'Marks (GATE rules)' : 'Correct'}</div>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-3">
            <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">{accuracy}%</div>
            <div className="text-[11px] text-[var(--text-tertiary)]">Accuracy</div>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-3">
            <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums inline-flex items-center gap-1.5">
              <Clock className="h-5 w-5 text-[var(--text-tertiary)]" />
              {formatClock(summary.total_time_ms)}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">Time spent</div>
          </div>
          <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-3">
            <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {exam ? summary.unanswered : summary.reviews}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)]">{exam ? 'Left unanswered' : 'Reviews of earlier misses'}</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((d) => {
            const s = summary.by_difficulty[String(d)]
            const pct = s.answered ? (100 * s.correct) / s.answered : 0
            return (
              <div key={d} className="text-center">
                <div className="h-16 rounded-lg bg-[var(--bg-tertiary)] flex items-end overflow-hidden">
                  <div
                    className={clsx('w-full transition-all', s.answered ? (pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger') : '')}
                    style={{ height: `${s.answered ? Math.max(6, pct) : 0}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-secondary)]">{DIFFICULTY_LABEL[d]}</div>
                <div className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                  {s.answered ? `${s.correct}/${s.answered}` : '—'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="card p-4">
        <h2 className="font-semibold text-[var(--text-primary)] mb-3">Readiness by subtopic</h2>
        <ul className="space-y-3">
          {summary.subtopics.map((s) => {
            const delta = s.readiness_start != null ? s.skill.readiness - s.readiness_start : null
            return (
              <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_160px_auto] items-center gap-x-4 gap-y-1">
                <div className="min-w-0">
                  <div className="text-[13px] text-[var(--text-primary)] truncate">{s.name}</div>
                  <div className="text-[11px] text-[var(--text-tertiary)]">
                    {s.topic_title} · {s.correct}/{s.answered} correct
                    {delta != null && Math.abs(delta) >= 0.5 && (
                      <span className={delta > 0 ? 'text-success' : 'text-danger'}>
                        {' '}· readiness {Math.round(s.readiness_start ?? 0)} → {Math.round(s.skill.readiness)}
                      </span>
                    )}
                  </div>
                </div>
                <SkillMeter skill={s.skill} className="hidden sm:flex" />
                <MasteryBadge skill={s.skill} />
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[11px] text-[var(--text-tertiary)]">
          Readiness is the predicted chance of solving a typical GATE 2-mark numerical. Faded bars still have little evidence
          behind them. Mastery also needs a correct answer on a later day, so it can't be reached in a single session.
        </p>
      </div>

      {focus.length > 0 && (
        <div className="card p-4">
          <h2 className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
            <Target className="h-4 w-4" /> Focus next
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Your weakest areas in this quiz: {focus.map((s) => s.name).join(', ')}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button icon={Brain} loading={starting} onClick={() => void practiseFocus()}>
              Adaptive practice on these
            </Button>
            <Link
              to={unitPath}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-default)] px-4 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]"
            >
              <PlayCircle className="h-4 w-4" /> Rewatch the lectures
            </Link>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-[var(--text-primary)] mr-auto">Review answers</h2>
          {(['all', 'wrong', 'unanswered'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={clsx(
                'rounded-lg border px-2.5 py-1 text-xs',
                filter === f
                  ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverted)]'
                  : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]',
              )}
            >
              {f === 'all' ? 'All' : f === 'wrong' ? 'Incorrect' : 'Unanswered'}
            </button>
          ))}
        </div>
        {reviewed.length === 0 && <p className="text-sm text-[var(--text-tertiary)]">Nothing here.</p>}
        {reviewed.map((q) => {
          const r = lastResponse.get(q.id)
          const n = attempt.questions.indexOf(q) + 1
          return (
            <div key={q.id} className="space-y-2">
              <QuestionCard
                question={q}
                label={`Q${n}`}
                value={r?.response ?? null}
                result={{ isCorrect: !!r?.is_correct, marks: exam ? r?.marks_awarded ?? 0 : null, response: r?.response ?? null }}
                isReview={!!r?.is_review}
                collapsibleSolution
              />
              <div className="flex items-center gap-3 px-1">
                <span className="text-[11px] text-[var(--text-tertiary)] inline-flex items-center gap-1">
                  {r?.is_correct ? <CheckCircle2 className="h-3 w-3 text-success" /> : <XCircle className="h-3 w-3 text-danger" />}
                  {subtopicName(q.subtopic)}
                </span>
                {r && (
                  <button
                    type="button"
                    onClick={() => setTutorFor(q.id)}
                    className="ml-auto inline-flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <Sparkles className="h-3.5 w-3.5" /> Ask AI
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-2 pb-4">
        <Link
          to={`${unitPath}/quiz`}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-[var(--text-inverted)] hover:opacity-90"
        >
          <RotateCcw className="h-4 w-4" /> New quiz <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <QuestionTutor
        attemptId={attempt.id}
        questionId={tutorFor}
        questionLabel={tutorFor ? subtopicName(attempt.questions.find((q) => q.id === tutorFor)?.subtopic ?? '') : ''}
        wasCorrect={!!(tutorFor && lastResponse.get(tutorFor)?.is_correct)}
        onClose={() => setTutorFor(null)}
      />
    </div>
  )
}
