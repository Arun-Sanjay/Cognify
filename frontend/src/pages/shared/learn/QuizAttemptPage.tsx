import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, LoaderCircle } from 'lucide-react'
import { quizApi } from '../../../api/client'
import { useAuthStore } from '../../../store/authStore'
import PracticeRunner from '../../../components/quiz/PracticeRunner'
import ExamRunner from '../../../components/quiz/ExamRunner'
import QuizResults from '../../../components/quiz/QuizResults'
import type { QuizAttemptDetail, QuizOverview } from '../../../types'

/** One quiz attempt: the runner while active, the results once completed. */
export default function QuizAttemptPage() {
  const { subjectId = '', unitId = '', attemptId = '' } = useParams()
  const role = useAuthStore((s) => s.user?.role ?? 'student')
  const [attempt, setAttempt] = useState<QuizAttemptDetail | null>(null)
  const [overview, setOverview] = useState<QuizOverview | null>(null)
  const [error, setError] = useState<string | null>(null)

  const unitPath = `/${role}/learn/${subjectId}/${unitId}`

  useEffect(() => {
    let cancelled = false
    setAttempt(null)
    setError(null)
    Promise.all([quizApi.attempt(attemptId), quizApi.overview(subjectId, unitId)])
      .then(([a, o]) => {
        if (cancelled) return
        setAttempt(a)
        setOverview(o)
      })
      .catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load the quiz'))
    return () => {
      cancelled = true
    }
  }, [attemptId, subjectId, unitId])

  const subtopicName = useCallback(
    (id: string) => {
      for (const t of overview?.topics ?? []) {
        const s = t.subtopics.find((x) => x.id === id)
        if (s) return `${t.title} › ${s.name}`
      }
      return id
    },
    [overview],
  )

  const onFinished = useCallback((a: QuizAttemptDetail) => {
    setAttempt(a)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  return (
    <div className="space-y-4 max-w-5xl">
      <Link
        to={`${unitPath}/quiz`}
        className="inline-flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All quizzes
      </Link>
      {error ? (
        <div className="card p-4 text-sm text-danger">{error}</div>
      ) : !attempt ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-tertiary)]">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Loading quiz…
        </div>
      ) : attempt.status === 'completed' ? (
        <QuizResults key={attempt.id} attempt={attempt} subtopicName={subtopicName} unitPath={unitPath} />
      ) : attempt.mode === 'exam' ? (
        <ExamRunner attempt={attempt} subtopicName={subtopicName} onFinished={onFinished} />
      ) : (
        <PracticeRunner attempt={attempt} subtopicName={subtopicName} onFinished={onFinished} />
      )}
    </div>
  )
}
