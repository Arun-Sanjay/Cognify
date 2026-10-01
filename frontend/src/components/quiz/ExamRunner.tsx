import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { BookmarkCheck, ChevronLeft, ChevronRight, Clock, Eraser, Send } from 'lucide-react'
import { quizApi } from '../../api/client'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import QuestionCard from './QuestionCard'
import { formatClock, parseNat, parseServerTime } from './quizFormat'
import type { QuizAnswerValue, QuizAttemptDetail } from '../../types'

export interface ExamRunnerProps {
  attempt: QuizAttemptDetail
  subtopicName: (id: string) => string
  onFinished: (attempt: QuizAttemptDetail) => void
}

type Status = 'not-visited' | 'not-answered' | 'answered' | 'marked' | 'answered-marked'

const STATUS_STYLE: Record<Status, string> = {
  'not-visited': 'border-[var(--border-default)] text-[var(--text-secondary)]',
  'not-answered': 'border-danger text-danger',
  answered: 'border-success bg-success text-white',
  marked: 'border-info bg-info text-white',
  'answered-marked': 'border-info bg-success text-white ring-2 ring-info ring-offset-1 ring-offset-[var(--bg-secondary)]',
}

const STATUS_LABEL: Record<Status, string> = {
  'not-visited': 'Not visited',
  'not-answered': 'Not answered',
  answered: 'Answered',
  marked: 'Marked for review',
  'answered-marked': 'Answered & marked',
}

/** Mock test in GATE conditions: palette, countdown, mark-for-review, submit at the end. */
export default function ExamRunner({ attempt, subtopicName, onFinished }: ExamRunnerProps) {
  const questions = attempt.questions
  const restored = useMemo(() => {
    const m: Record<string, QuizAnswerValue> = {}
    for (const r of attempt.responses) m[r.question_id] = r.response
    return m
  }, [attempt.responses])

  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, QuizAnswerValue>>(restored)
  const [natText, setNatText] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(restored).filter(([, v]) => typeof v === 'number').map(([k, v]) => [k, String(v)])),
  )
  // What the server has for each question (to avoid re-sending unchanged answers).
  const saved = useRef<Record<string, QuizAnswerValue>>({ ...restored })
  const [marked, setMarked] = useState<Set<string>>(new Set())
  const [visited, setVisited] = useState<Set<string>>(() => new Set([questions[0]?.id, ...Object.keys(restored)]))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enteredAt = useRef(Date.now())

  const deadline = useMemo(() => {
    const limit = attempt.config.time_limit_sec ?? questions.length * 180
    return parseServerTime(attempt.started_at) + limit * 1000
  }, [attempt.config.time_limit_sec, attempt.started_at, questions.length])
  const [now, setNow] = useState(Date.now())
  const remaining = deadline - now

  const q = questions[index]
  const current = q ? answers[q.id] ?? null : null

  const persist = useCallback(
    async (qid: string) => {
      const question = questions.find((x) => x.id === qid)
      if (!question) return
      const value = question.type === 'nat' ? parseNat(natText[qid] ?? '') : answers[qid] ?? null
      const before = saved.current[qid]
      if (JSON.stringify(value ?? null) === JSON.stringify(before ?? null)) return
      // Never record an untouched question: a null first answer would count as a miss.
      if (value == null && before === undefined) return
      await quizApi.answer(attempt.id, { question_id: qid, response: value, time_ms: Date.now() - enteredAt.current })
      saved.current[qid] = value
    },
    [answers, natText, questions, attempt.id],
  )

  const submit = useCallback(async () => {
    setSubmitting(true)
    setError(null)
    try {
      if (q) await persist(q.id)
      onFinished(await quizApi.finish(attempt.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit')
      setSubmitting(false)
    }
  }, [attempt.id, onFinished, persist, q])

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const autoSubmitted = useRef(false)
  useEffect(() => {
    if (remaining <= 0 && !autoSubmitted.current) {
      autoSubmitted.current = true
      void submit()
    }
  }, [remaining, submit])

  const goTo = async (i: number) => {
    if (!q || i === index || i < 0 || i >= questions.length) return
    try {
      await persist(q.id)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the answer')
    }
    setIndex(i)
    setVisited((prev) => new Set(prev).add(questions[i].id))
    enteredAt.current = Date.now()
  }

  const statusOf = (qid: string): Status => {
    const question = questions.find((x) => x.id === qid)
    const has = question?.type === 'nat' ? parseNat(natText[qid] ?? '') != null : answers[qid] != null
    if (marked.has(qid)) return has ? 'answered-marked' : 'marked'
    if (has) return 'answered'
    return visited.has(qid) ? 'not-answered' : 'not-visited'
  }

  const counts = questions.reduce<Record<Status, number>>(
    (acc, x) => {
      acc[statusOf(x.id)] += 1
      return acc
    },
    { 'not-visited': 0, 'not-answered': 0, answered: 0, marked: 0, 'answered-marked': 0 },
  )

  if (!q) return null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px] items-start">
      <div className="space-y-4 min-w-0">
        <QuestionCard
          key={q.id}
          question={q}
          label={`Question ${index + 1} of ${questions.length}`}
          value={current}
          onChange={(v) => setAnswers((prev) => ({ ...prev, [q.id]: v }))}
          natText={natText[q.id] ?? ''}
          onNatTextChange={(t) => setNatText((prev) => ({ ...prev, [q.id]: t }))}
        />
        <p className="text-[11px] text-[var(--text-tertiary)] -mt-2 px-1">{subtopicName(q.subtopic)}</p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" icon={ChevronLeft} disabled={index === 0} onClick={() => void goTo(index - 1)}>
            Previous
          </Button>
          <Button
            variant="secondary"
            icon={BookmarkCheck}
            onClick={() => {
              setMarked((prev) => {
                const next = new Set(prev)
                if (next.has(q.id)) next.delete(q.id)
                else next.add(q.id)
                return next
              })
            }}
          >
            {marked.has(q.id) ? 'Unmark' : 'Mark for review'}
          </Button>
          <Button
            variant="ghost"
            icon={Eraser}
            onClick={() => {
              setAnswers((prev) => ({ ...prev, [q.id]: null }))
              setNatText((prev) => ({ ...prev, [q.id]: '' }))
            }}
          >
            Clear response
          </Button>
          {index < questions.length - 1 ? (
            <Button className="ml-auto" iconRight={ChevronRight} onClick={() => void goTo(index + 1)}>
              Save &amp; next
            </Button>
          ) : (
            <Button className="ml-auto" icon={Send} onClick={() => setConfirmOpen(true)}>
              Submit test
            </Button>
          )}
        </div>
      </div>

      <aside className="lg:sticky lg:top-20 space-y-3 order-first lg:order-none">
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Clock className={clsx('h-4 w-4', remaining < 5 * 60_000 ? 'text-danger' : 'text-[var(--text-secondary)]')} />
            <span className="text-xs text-[var(--text-secondary)]">Time left</span>
            <span
              className={clsx(
                'ml-auto font-mono text-lg font-semibold tabular-nums',
                remaining < 5 * 60_000 ? 'text-danger' : 'text-[var(--text-primary)]',
              )}
            >
              {formatClock(Math.max(0, remaining))}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[var(--text-tertiary)]">
            {attempt.max_score} marks · wrong MCQ costs ⅓ of its marks
          </div>
        </div>

        <div className="card p-4">
          <div className="grid grid-cols-6 sm:grid-cols-8 lg:grid-cols-5 gap-1.5">
            {questions.map((x, i) => (
              <button
                key={x.id}
                type="button"
                onClick={() => void goTo(i)}
                className={clsx(
                  'h-9 rounded-lg border text-xs font-semibold tabular-nums transition-colors',
                  STATUS_STYLE[statusOf(x.id)],
                  i === index && 'outline outline-2 outline-offset-2 outline-[var(--text-primary)]',
                )}
                aria-label={`Question ${i + 1}: ${STATUS_LABEL[statusOf(x.id)]}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <ul className="mt-3 space-y-1">
            {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
              <li key={s} className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                <span className={clsx('h-3.5 w-3.5 rounded border', STATUS_STYLE[s])} />
                {STATUS_LABEL[s]}
                <span className="ml-auto tabular-nums">{counts[s]}</span>
              </li>
            ))}
          </ul>
          <Button className="w-full mt-3" variant="secondary" icon={Send} onClick={() => setConfirmOpen(true)}>
            Submit test
          </Button>
        </div>
      </aside>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit the test?"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
            <Button loading={submitting} onClick={() => void submit()}>
              Submit
            </Button>
          </div>
        }
      >
        <div className="space-y-2 text-sm text-[var(--text-secondary)]">
          <p>
            You've answered <span className="font-semibold text-[var(--text-primary)]">{counts.answered + counts['answered-marked']}</span> of{' '}
            {questions.length} questions
            {counts.marked + counts['answered-marked'] > 0 && <> and marked {counts.marked + counts['answered-marked']} for review</>}.
          </p>
          <p>Answers can't be changed after submitting. You'll see your score and every worked solution.</p>
        </div>
      </Modal>
    </div>
  )
}
