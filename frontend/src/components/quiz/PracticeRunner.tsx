import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { ArrowRight, Brain, Flag, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'
import { quizApi } from '../../api/client'
import Button from '../ui/Button'
import QuestionCard from './QuestionCard'
import QuestionTutor from './QuestionTutor'
import { MasteryBadge, ReadinessBar } from './ReadinessBar'
import { LETTERS, parseNat } from './quizFormat'
import type { QuizAnswerResult, QuizAnswerValue, QuizAttemptDetail, QuizQuestion } from '../../types'

export interface PracticeRunnerProps {
  attempt: QuizAttemptDetail
  subtopicName: (id: string) => string
  onFinished: (attempt: QuizAttemptDetail) => void
}

/** Practice and adaptive modes: one question at a time, instant feedback. */
export default function PracticeRunner({ attempt, subtopicName, onFinished }: PracticeRunnerProps) {
  const adaptive = attempt.mode === 'adaptive'
  const total = attempt.question_count

  const initialQuestion = (): QuizQuestion | null => {
    if (adaptive) return attempt.questions.find((q) => q.id === attempt.current_question_id) ?? null
    const answered = new Set(attempt.responses.map((r) => r.question_id))
    return attempt.questions.find((q) => !answered.has(q.id)) ?? null
  }

  const [question, setQuestion] = useState<QuizQuestion | null>(initialQuestion)
  const [isReview, setIsReview] = useState(false)
  const [answeredCount, setAnsweredCount] = useState(attempt.answered)
  const [correctCount, setCorrectCount] = useState(attempt.correct)
  const [value, setValue] = useState<QuizAnswerValue>(null)
  const [natText, setNatText] = useState('')
  const [feedback, setFeedback] = useState<QuizAnswerResult | null>(null)
  const [submitted, setSubmitted] = useState<QuizAnswerValue>(null)
  const [submitting, setSubmitting] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tutorFor, setTutorFor] = useState<string | null>(null)
  const startedAt = useRef(Date.now())
  const topRef = useRef<HTMLDivElement>(null)

  const finish = async () => {
    setFinishing(true)
    try {
      onFinished(await quizApi.finish(attempt.id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not finish the quiz')
      setFinishing(false)
    }
  }

  // Nothing left to answer (e.g. resumed a finished-but-not-submitted quiz).
  useEffect(() => {
    if (!question && !finishing) void finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const response: QuizAnswerValue = question?.type === 'nat' ? parseNat(natText) : value
  const natInvalid = question?.type === 'nat' && natText.trim() !== '' && response === null

  const submit = async (skip = false) => {
    if (!question || submitting || feedback) return
    setSubmitting(true)
    setError(null)
    const sent = skip ? null : response
    try {
      const res = await quizApi.answer(attempt.id, {
        question_id: question.id,
        response: sent,
        time_ms: Date.now() - startedAt.current,
      })
      setSubmitted(sent)
      setFeedback(res)
      setAnsweredCount((n) => n + 1)
      if (res.is_correct) setCorrectCount((n) => n + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit the answer')
    } finally {
      setSubmitting(false)
    }
  }

  const next = () => {
    if (!feedback) return
    let upcoming: QuizQuestion | null = null
    if (adaptive) {
      upcoming = feedback.next_question ?? null
      setIsReview(feedback.next_is_review)
    } else {
      const idx = attempt.questions.findIndex((q) => q.id === question?.id)
      upcoming = attempt.questions[idx + 1] ?? null
    }
    if (!upcoming || feedback.done) {
      void finish()
      return
    }
    setQuestion(upcoming)
    setValue(null)
    setNatText('')
    setFeedback(null)
    setTutorFor(null)
    startedAt.current = Date.now()
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Keyboard: A–D / 1–4 pick options, Enter submits or moves on.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
      if (e.key === 'Enter' && !e.shiftKey && (!typing || target.getAttribute('aria-label') === 'Numerical answer')) {
        if (tutorFor) return
        e.preventDefault()
        if (feedback) next()
        else if (response != null) void submit()
        return
      }
      if (typing || feedback || !question?.options || e.metaKey || e.ctrlKey) return
      const k = e.key.toUpperCase()
      const i = LETTERS.indexOf(k as (typeof LETTERS)[number]) >= 0 ? LETTERS.indexOf(k as (typeof LETTERS)[number]) : Number(k) - 1
      if (i >= 0 && i < question.options.length) {
        const letter = LETTERS[i]
        if (question.type === 'mcq') setValue((v) => (v === letter ? null : letter))
        else
          setValue((v) => {
            const cur = Array.isArray(v) ? v : []
            const nxt = cur.includes(letter) ? cur.filter((l) => l !== letter) : [...cur, letter].sort()
            return nxt.length ? nxt : null
          })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!question) {
    return <div className="text-sm text-[var(--text-tertiary)]">Wrapping up…</div>
  }

  const shown = feedback?.question ?? question
  const position = Math.min(answeredCount + (feedback ? 0 : 1), total)
  const skill = feedback?.skill
  const delta = skill && skill.readiness_before != null ? skill.readiness - skill.readiness_before : 0

  return (
    <div ref={topRef} className="space-y-4 scroll-mt-20">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
            {adaptive && <Brain className="h-4 w-4" />}
            {adaptive ? 'Adaptive practice' : 'Practice'}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            Question <span className="font-semibold text-[var(--text-primary)]">{position}</span> of {total}
          </div>
          <div className="text-xs text-[var(--text-secondary)]">
            {correctCount} / {answeredCount} correct
          </div>
          <div className="text-xs text-[var(--text-tertiary)] truncate">{subtopicName(question.subtopic)}</div>
          <Button size="sm" variant="ghost" icon={Flag} className="ml-auto" loading={finishing} onClick={() => void finish()}>
            End quiz
          </Button>
        </div>
        <div className="mt-3 h-1 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--text-primary)] transition-all duration-500"
            style={{ width: `${(100 * answeredCount) / Math.max(total, 1)}%` }}
          />
        </div>
      </div>

      <QuestionCard
        key={question.id + (isReview ? '-r' : '')}
        question={shown}
        label={`Q${position}`}
        value={value}
        onChange={feedback ? undefined : setValue}
        natText={natText}
        onNatTextChange={setNatText}
        isReview={isReview || !!feedback?.is_review}
        result={
          feedback
            ? { isCorrect: !!feedback.is_correct, marks: feedback.marks_awarded, response: submitted }
            : null
        }
      />

      {error && <p className="text-sm text-danger">{error}</p>}

      {!feedback ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void submit()} loading={submitting} disabled={response == null}>
            Check answer
          </Button>
          <Button variant="ghost" onClick={() => void submit(true)} disabled={submitting}>
            I don't know
          </Button>
          {natInvalid && <span className="text-xs text-danger">Enter a plain number, e.g. 12.5</span>}
          <span className="ml-auto hidden sm:inline text-[11px] text-[var(--text-tertiary)]">
            {question.options ? 'Keys A–D to choose · ' : ''}Enter to check
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          {skill && (
            <div className="card p-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <div className="flex items-center gap-2 text-sm">
                {delta >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-danger" />}
                <span className="text-[var(--text-secondary)]">
                  {subtopicName(question.subtopic)} readiness{' '}
                  <span className="tabular-nums text-[var(--text-tertiary)]">{Math.round(skill.readiness_before ?? 0)}</span>
                  {' → '}
                  <span className={clsx('font-semibold tabular-nums', delta >= 0 ? 'text-success' : 'text-danger')}>
                    {Math.round(skill.readiness)}
                  </span>
                </span>
              </div>
              <ReadinessBar value={skill.readiness} uncertain={skill.uncertainty > 0.6} className="w-32" />
              <MasteryBadge skill={skill} />
              {feedback.p_expected != null && (
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  Predicted chance before answering: {Math.round(100 * feedback.p_expected)}%
                </span>
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={next} iconRight={ArrowRight} loading={finishing}>
              {feedback.done ? 'See results' : 'Next question'}
            </Button>
            <Button variant="secondary" icon={Sparkles} onClick={() => setTutorFor(question.id)}>
              Ask AI about this
            </Button>
          </div>
        </div>
      )}

      <QuestionTutor
        attemptId={attempt.id}
        questionId={tutorFor}
        questionLabel={`${subtopicName(question.subtopic)} · Q${position}`}
        wasCorrect={!!feedback?.is_correct}
        onClose={() => setTutorFor(null)}
      />
    </div>
  )
}
