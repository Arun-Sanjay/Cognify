import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  ArrowLeft,
  Brain,
  Check,
  ChevronDown,
  ClipboardList,
  Clock,
  History,
  Info,
  LoaderCircle,
  Minus,
  RotateCcw,
  SlidersHorizontal,
  Target,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { quizApi } from '../../../api/client'
import { useAuthStore } from '../../../store/authStore'
import Button from '../../../components/ui/Button'
import Badge from '../../../components/ui/Badge'
import { MasteryBadge, ReadinessBar, SkillMeter } from '../../../components/quiz/ReadinessBar'
import {
  DIFFICULTY_HINT,
  DIFFICULTY_LABEL,
  TYPE_LABEL,
  formatClock,
  parseServerTime,
  poolSize,
} from '../../../components/quiz/quizFormat'
import type { AdaptiveTarget, QuestionType, QuizMode, QuizOverview, SubtopicOverview } from '../../../types'

const MODES: { id: QuizMode; title: string; Icon: LucideIcon; blurb: string }[] = [
  {
    id: 'adaptive',
    title: 'Adaptive practice',
    Icon: Brain,
    blurb: 'Difficulty follows your answers. Weak areas come up more and missed questions come back later.',
  },
  {
    id: 'practice',
    title: 'Custom practice',
    Icon: SlidersHorizontal,
    blurb: 'You choose the difficulty, question types and length. Full solution after every answer.',
  },
  {
    id: 'exam',
    title: 'Mock test',
    Icon: ClipboardList,
    blurb: 'GATE conditions: timer, negative marking, question palette. Solutions after you submit.',
  },
]

const TARGETS: { id: AdaptiveTarget; label: string; hint: string }[] = [
  { id: 'challenge', label: 'Challenge', hint: 'Aim for ~60% correct: harder questions, slower but deeper gains' },
  { id: 'balanced', label: 'Balanced', hint: 'Aim for ~70% correct: the research-backed sweet spot' },
  { id: 'confidence', label: 'Confidence', hint: 'Aim for ~80% correct: good for warming up or revising' },
]

const COUNTS: Record<QuizMode, number[]> = {
  adaptive: [10, 15, 20, 30],
  practice: [5, 10, 15, 20, 30],
  exam: [10, 15, 20, 30, 65],
}

const ALL_TYPES: QuestionType[] = ['mcq', 'msq', 'nat']

function Toggle({ active, onClick, children, title }: { active: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverted)]'
          : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]',
      )}
    >
      {children}
    </button>
  )
}

function Checkbox({ state }: { state: 'all' | 'some' | 'none' }) {
  return (
    <span
      className={clsx(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
        state === 'none' ? 'border-[var(--border-strong)]' : 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverted)]',
      )}
    >
      {state === 'all' && <Check className="h-3 w-3" />}
      {state === 'some' && <Minus className="h-3 w-3" />}
    </span>
  )
}

export default function QuizHomePage() {
  const { subjectId = '', unitId = '' } = useParams()
  const role = useAuthStore((s) => s.user?.role ?? 'student')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetTopic = searchParams.get('topic')
  const [overview, setOverview] = useState<QuizOverview | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<QuizMode>('adaptive')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [difficulties, setDifficulties] = useState<number[]>([])
  const [types, setTypes] = useState<QuestionType[]>([])
  const [count, setCount] = useState(10)
  const [target, setTarget] = useState<AdaptiveTarget>('balanced')
  const [starting, setStarting] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)

  const unitPath = `/${role}/learn/${subjectId}/${unitId}`

  useEffect(() => {
    let cancelled = false
    quizApi
      .overview(subjectId, unitId)
      .then((data) => {
        if (cancelled) return
        setOverview(data)
        const topic = data.topics.find((x) => x.id === presetTopic)
        if (topic) {
          setSelected(new Set(topic.subtopics.map((s) => s.id)))
          setExpanded(new Set([topic.id]))
        }
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load the question bank'))
    return () => {
      cancelled = true
    }
  }, [subjectId, unitId, presetTopic])

  const allSubtopics = useMemo(() => overview?.topics.flatMap((t) => t.subtopics) ?? [], [overview])
  const chosen = allSubtopics.filter((s) => selected.has(s.id))
  const available = mode === 'adaptive' ? poolSize(chosen, [], types) : poolSize(chosen, difficulties, types)
  const effectiveCount = Math.min(count, available)

  if (error) {
    return (
      <div className="space-y-4">
        <Link to={unitPath} className="inline-flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft className="h-4 w-4" /> Back to lectures
        </Link>
        <div className="card p-4 text-sm text-danger">{error}</div>
      </div>
    )
  }
  if (!overview) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Loading question bank…
      </div>
    )
  }

  const setMany = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)))
      return next
    })
  const toggleOne = (id: string) => setMany([id], !selected.has(id))
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const weakest = [...allSubtopics]
    .sort((a, b) => (a.skill.attempts ? a.skill.readiness : 101) - (b.skill.attempts ? b.skill.readiness : 101))
    .filter((s) => s.skill.attempts > 0 && s.skill.level !== 'mastered')
    .slice(0, 5)
  const withReviews = allSubtopics.filter((s) => s.reviews_due > 0)
  const accuracy = overview.answered_total ? Math.round((100 * overview.correct_total) / overview.answered_total) : null

  const start = async () => {
    setStarting(true)
    setStartError(null)
    try {
      const attempt = await quizApi.start(subjectId, unitId, {
        mode,
        subtopics: chosen.map((s) => s.id),
        difficulties: mode === 'adaptive' ? null : difficulties.length ? difficulties : null,
        types: types.length ? types : null,
        count: effectiveCount,
        target: mode === 'adaptive' ? target : undefined,
      })
      navigate(`${unitPath}/quiz/${attempt.id}`)
    } catch (e) {
      setStartError(e instanceof Error ? e.message : 'Could not start the quiz')
      setStarting(false)
    }
  }

  const subtopicRow = (s: SubtopicOverview) => (
    <li key={s.id}>
      <button
        type="button"
        onClick={() => toggleOne(s.id)}
        className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)_120px_auto] items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2 text-left hover:bg-[var(--bg-tertiary)]"
      >
        <Checkbox state={selected.has(s.id) ? 'all' : 'none'} />
        <span className="min-w-0">
          <span className="block text-[13px] text-[var(--text-primary)] truncate">{s.name}</span>
          <span className="block text-[11px] text-[var(--text-tertiary)]">
            {s.question_count} questions · {s.seen} attempted
            {s.reviews_due > 0 && <span className="text-info"> · {s.reviews_due} to review</span>}
          </span>
        </span>
        <SkillMeter skill={s.skill} className="hidden md:flex" />
        <MasteryBadge skill={s.skill} />
      </button>
    </li>
  )

  return (
    <div className="space-y-5">
      <Link to={unitPath} className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to lectures
      </Link>

      <div className="card p-5">
        <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)]">Practice · Question bank</div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)] mt-1">Operating System quizzes</h1>
        <p className="text-sm text-[var(--text-secondary)] mt-2 max-w-3xl">
          {overview.question_count} GATE-style questions, each tagged by subtopic and difficulty, with worked solutions.
          Every answer updates your readiness score, so practice gets more targeted over time.
        </p>
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Questions answered', value: overview.answered_total },
            { label: 'Accuracy', value: accuracy == null ? '—' : `${accuracy}%` },
            { label: 'Subtopics mastered', value: `${allSubtopics.filter((s) => s.skill.level === 'mastered').length} / ${allSubtopics.length}` },
            { label: 'Reviews due', value: overview.reviews_due },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2.5">
              <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{stat.value}</div>
              <div className="text-[11px] text-[var(--text-tertiary)]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] items-start">
        <div className="space-y-5 min-w-0">
          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map(({ id, title, Icon, blurb }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setMode(id)
                  setCount(COUNTS[id].includes(count) ? count : 10)
                }}
                className={clsx(
                  'card p-4 text-left transition-colors',
                  mode === id ? 'ring-2 ring-[var(--text-primary)]' : 'hover:border-[var(--border-strong)]',
                )}
                aria-pressed={mode === id}
              >
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <Icon className="h-4 w-4 text-[var(--text-primary)]" />
                  <span className="font-semibold text-sm text-[var(--text-primary)]">{title}</span>
                  {id === 'adaptive' && <Badge size="sm" variant="info">Recommended</Badge>}
                </div>
                <p className="text-[12.5px] text-[var(--text-secondary)] mt-1.5">{blurb}</p>
              </button>
            ))}
          </div>

          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <h2 className="font-semibold text-[var(--text-primary)] mr-auto">Choose what to practise</h2>
              <Button size="sm" variant="secondary" onClick={() => setSelected(new Set(allSubtopics.map((s) => s.id)))}>
                Everything
              </Button>
              {weakest.length > 0 && (
                <Button size="sm" variant="secondary" icon={Target} onClick={() => setSelected(new Set(weakest.map((s) => s.id)))}>
                  My weakest
                </Button>
              )}
              {withReviews.length > 0 && (
                <Button size="sm" variant="secondary" icon={RotateCcw} onClick={() => setSelected(new Set(withReviews.map((s) => s.id)))}>
                  Due reviews
                </Button>
              )}
              {selected.size > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
              )}
            </div>
            <ul className="divide-y divide-[var(--border-default)]">
              {overview.topics.map((topic, i) => {
                const ids = topic.subtopics.map((s) => s.id)
                const n = ids.filter((id) => selected.has(id)).length
                const state = n === 0 ? 'none' : n === ids.length ? 'all' : 'some'
                const open = expanded.has(topic.id)
                return (
                  <li key={topic.id} className="py-1">
                    <div className="flex items-center gap-3 px-2 py-2">
                      <button type="button" onClick={() => setMany(ids, state !== 'all')} aria-label={`Select all of ${topic.title}`}>
                        <Checkbox state={state} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setExpanded((prev) => {
                            const next = new Set(prev)
                            if (next.has(topic.id)) next.delete(topic.id)
                            else next.add(topic.id)
                            return next
                          })
                        }
                        className="flex flex-1 min-w-0 items-center gap-3 text-left"
                        aria-expanded={open}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-[var(--text-primary)] truncate">
                            <span className="text-[var(--text-tertiary)] mr-1.5">{i + 1}.</span>
                            {topic.title}
                          </span>
                          <span className="block text-[11px] text-[var(--text-tertiary)]">
                            {topic.subtopics.reduce((a, s) => a + s.question_count, 0)} questions · {n}/{ids.length} subtopics selected
                          </span>
                        </span>
                        {topic.readiness != null && (
                          <span className="hidden sm:flex w-28 items-center gap-2">
                            <ReadinessBar value={topic.readiness} className="flex-1" />
                            <span className="text-[11px] tabular-nums text-[var(--text-secondary)]">{Math.round(topic.readiness)}</span>
                          </span>
                        )}
                        <ChevronDown className={clsx('h-4 w-4 text-[var(--text-tertiary)] transition-transform', open && 'rotate-180')} />
                      </button>
                    </div>
                    {open && <ul className="ml-5 border-l border-[var(--border-default)] pl-2 pb-1">{topic.subtopics.map(subtopicRow)}</ul>}
                  </li>
                )
              })}
            </ul>
          </div>

          {chosen.length > 0 && (
            <div className="xl:hidden sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] md:bottom-4 z-10">
              <div className="card p-3 flex items-center gap-3 shadow-[var(--shadow-elevated)]">
                <div className="min-w-0 flex-1 text-[12px] text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">{chosen.length}</span> subtopics ·{' '}
                  <span className="font-semibold text-[var(--text-primary)]">{available}</span> questions
                </div>
                <Button size="sm" loading={starting} disabled={available < 3} onClick={() => void start()}>
                  Start {effectiveCount}
                </Button>
              </div>
            </div>
          )}
        </div>

        <aside className="xl:sticky xl:top-20 space-y-4">
          <div className="card p-4 space-y-4">
            <h2 className="font-semibold text-[var(--text-primary)]">{MODES.find((m) => m.id === mode)?.title}</h2>

            {mode === 'adaptive' ? (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Pace</div>
                <div className="flex flex-wrap gap-1.5">
                  {TARGETS.map((t) => (
                    <Toggle key={t.id} active={target === t.id} onClick={() => setTarget(t.id)} title={t.hint}>
                      {t.label}
                    </Toggle>
                  ))}
                </div>
                <p className="text-[11.5px] text-[var(--text-tertiary)]">{TARGETS.find((t) => t.id === target)?.hint}</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Difficulty</div>
                <div className="flex flex-wrap gap-1.5">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <Toggle key={d} active={difficulties.includes(d)} onClick={() => setDifficulties(toggleIn(difficulties, d))} title={DIFFICULTY_HINT[d]}>
                      {d} · {DIFFICULTY_LABEL[d]}
                    </Toggle>
                  ))}
                </div>
                <p className="text-[11.5px] text-[var(--text-tertiary)]">
                  {difficulties.length ? difficulties.map((d) => DIFFICULTY_HINT[d]).join(' · ') : 'All levels'}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Question types</div>
              <div className="flex flex-wrap gap-1.5">
                {ALL_TYPES.map((t) => (
                  <Toggle key={t} active={types.includes(t)} onClick={() => setTypes(toggleIn(types, t))}>
                    {TYPE_LABEL[t]}
                  </Toggle>
                ))}
              </div>
              {!types.length && <p className="text-[11.5px] text-[var(--text-tertiary)]">All types</p>}
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">Questions</div>
              <div className="flex flex-wrap gap-1.5">
                {COUNTS[mode].map((c) => (
                  <Toggle key={c} active={count === c} onClick={() => setCount(c)}>
                    {c}
                  </Toggle>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2.5 text-[12.5px] text-[var(--text-secondary)] space-y-0.5">
              <div>
                <span className="font-semibold text-[var(--text-primary)]">{chosen.length}</span> subtopics ·{' '}
                <span className="font-semibold text-[var(--text-primary)]">{available}</span> matching questions
              </div>
              {chosen.length > 0 && available < count && available > 0 && (
                <div className="text-warning">Only {available} match, so the quiz will have {available}.</div>
              )}
              {mode === 'exam' && effectiveCount > 0 && (
                <div className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> About {formatClock(effectiveCount * 1.4 * 108_000)} at GATE pace
                </div>
              )}
            </div>

            {startError && <p className="text-sm text-danger">{startError}</p>}
            <Button
              className="w-full"
              size="lg"
              loading={starting}
              disabled={!chosen.length || available < 3}
              onClick={() => void start()}
            >
              {chosen.length ? `Start ${effectiveCount}-question ${mode === 'exam' ? 'mock test' : 'quiz'}` : 'Pick some subtopics'}
            </Button>
            {mode === 'adaptive' && (
              <p className="flex gap-1.5 text-[11.5px] text-[var(--text-tertiary)]">
                <Info className="h-3.5 w-3.5 shrink-0 mt-px" />
                Each question is picked so you have about a {Math.round((target === 'challenge' ? 0.6 : target === 'confidence' ? 0.8 : 0.7) * 100)}%
                chance of getting it right, based on your skill and how hard the question has proved for others. Questions you miss
                come back later in the session and again after 1, 3 and 7 days.
              </p>
            )}
          </div>

          {overview.recent_attempts.length > 0 && (
            <div className="card p-4">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)] mb-2">
                <History className="h-4 w-4" /> Recent quizzes
              </h3>
              <ul className="space-y-1">
                {overview.recent_attempts.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`${unitPath}/quiz/${a.id}`}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12.5px] hover:bg-[var(--bg-tertiary)]"
                    >
                      <span className="text-[var(--text-primary)] capitalize">{a.mode === 'exam' ? 'Mock test' : a.mode}</span>
                      <span className="text-[var(--text-tertiary)]">{new Date(parseServerTime(a.started_at)).toLocaleDateString()}</span>
                      <span className="ml-auto tabular-nums text-[var(--text-secondary)]">
                        {a.status === 'active' ? (
                          <Badge size="sm" variant="warning">Resume</Badge>
                        ) : a.mode === 'exam' ? (
                          `${a.score} / ${a.max_score}`
                        ) : (
                          `${a.correct} / ${a.answered}`
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
