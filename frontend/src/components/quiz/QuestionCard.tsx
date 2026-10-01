import { useState } from 'react'
import { clsx } from 'clsx'
import { AlertTriangle, Check, ChevronDown, RotateCcw, X } from 'lucide-react'
import Badge from '../ui/Badge'
import { Md } from '../learn/NoteBlockView'
import {
  DIFFICULTY_LABEL,
  LETTERS,
  TYPE_HINT,
  TYPE_LABEL,
  correctLetters,
  formatAnswer,
  formatMarks,
} from './quizFormat'
import type { QuizAnswerValue, QuizQuestion } from '../../types'

export interface QuestionResult {
  isCorrect: boolean
  marks?: number | null
  /** The response that was graded. */
  response: QuizAnswerValue
}

export interface QuestionCardProps {
  question: QuizQuestion
  /** "Q 3 / 10" style label. */
  label?: string
  /** Current (unsubmitted) answer. */
  value: QuizAnswerValue
  onChange?: (value: QuizAnswerValue) => void
  /** Text for the NAT input (kept separately so "1." can be typed). */
  natText?: string
  onNatTextChange?: (text: string) => void
  /** Graded result — locks the card and reveals the solution if the question carries it. */
  result?: QuestionResult | null
  isReview?: boolean
  /** Collapse the solution by default (review lists). */
  collapsibleSolution?: boolean
  className?: string
}

export function DifficultyDots({ level }: { level: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`Difficulty ${level}/5 · ${DIFFICULTY_LABEL[level]}`}>
      <span className="inline-flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            className={clsx('h-1.5 w-1.5 rounded-full', i <= level ? 'bg-[var(--text-primary)]' : 'bg-[var(--border-strong)]')}
          />
        ))}
      </span>
      <span className="text-[11px] text-[var(--text-tertiary)]">{DIFFICULTY_LABEL[level]}</span>
    </span>
  )
}

export default function QuestionCard({
  question: q,
  label,
  value,
  onChange,
  natText,
  onNatTextChange,
  result,
  isReview,
  collapsibleSolution,
  className,
}: QuestionCardProps) {
  const locked = !!result || !onChange
  const revealed = q.explanation != null
  const right = revealed ? correctLetters(q) : []
  const chosen = result ? result.response : value
  const chosenLetters = Array.isArray(chosen) ? chosen : typeof chosen === 'string' ? [chosen] : []
  const [showSolution, setShowSolution] = useState(!collapsibleSolution)

  const toggle = (letter: string) => {
    if (locked || !onChange) return
    if (q.type === 'mcq') {
      onChange(value === letter ? null : letter)
      return
    }
    const current = Array.isArray(value) ? value : []
    const next = current.includes(letter) ? current.filter((l) => l !== letter) : [...current, letter].sort()
    onChange(next.length ? next : null)
  }

  return (
    <div className={clsx('card p-5 space-y-4', className)}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {label && <span className="text-xs font-semibold text-[var(--text-primary)]">{label}</span>}
        <Badge size="sm">{TYPE_LABEL[q.type]}</Badge>
        <span className="text-[11px] text-[var(--text-tertiary)]">
          {q.marks} mark{q.marks > 1 ? 's' : ''}
        </span>
        <DifficultyDots level={q.difficulty} />
        {isReview && (
          <Badge size="sm" variant="info">
            <RotateCcw className="h-3 w-3 mr-1 inline" />
            Review of an earlier miss
          </Badge>
        )}
        {result && (
          <span
            className={clsx(
              'ml-auto inline-flex items-center gap-1 text-xs font-semibold',
              result.isCorrect ? 'text-success' : 'text-danger',
            )}
          >
            {result.isCorrect ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
            {result.response == null ? 'Not answered' : result.isCorrect ? 'Correct' : 'Incorrect'}
            {result.marks != null && <span className="font-normal text-[var(--text-tertiary)]">({formatMarks(result.marks)})</span>}
          </span>
        )}
      </div>

      <Md className="text-[15px] text-[var(--text-primary)] leading-relaxed">{q.stem}</Md>

      {q.options && (
        <div className="space-y-2" role={q.type === 'mcq' ? 'radiogroup' : 'group'}>
          {q.options.map((opt, i) => {
            const letter = LETTERS[i]
            const isChosen = chosenLetters.includes(letter)
            const isRight = right.includes(letter)
            const state = !revealed || !result ? (isChosen ? 'chosen' : 'idle') : isRight ? 'right' : isChosen ? 'wrong' : 'idle'
            return (
              <div key={letter}>
                <button
                  type="button"
                  role={q.type === 'mcq' ? 'radio' : 'checkbox'}
                  aria-checked={isChosen}
                  disabled={locked}
                  onClick={() => toggle(letter)}
                  className={clsx(
                    'w-full flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors',
                    state === 'idle' && 'border-[var(--border-default)]',
                    state === 'idle' && !locked && 'hover:border-[var(--border-strong)] hover:bg-[var(--bg-tertiary)]',
                    state === 'chosen' && 'border-[var(--text-primary)] bg-[var(--bg-tertiary)]',
                    state === 'right' && 'border-success bg-success/10',
                    state === 'wrong' && 'border-danger bg-danger/10',
                    locked && 'cursor-default',
                  )}
                >
                  <span
                    className={clsx(
                      'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border text-xs font-semibold',
                      q.type === 'mcq' ? 'rounded-full' : 'rounded-md',
                      state === 'chosen' && 'border-[var(--text-primary)] bg-[var(--text-primary)] text-[var(--text-inverted)]',
                      state === 'right' && 'border-success bg-success text-white',
                      state === 'wrong' && 'border-danger bg-danger text-white',
                      state === 'idle' && 'border-[var(--border-strong)] text-[var(--text-secondary)]',
                    )}
                  >
                    {state === 'right' ? <Check className="h-3.5 w-3.5" /> : state === 'wrong' ? <X className="h-3.5 w-3.5" /> : letter}
                  </span>
                  <Md className="flex-1 text-[14px] text-[var(--text-primary)]">{opt}</Md>
                </button>
                {revealed && result && q.option_feedback?.[i] && (isChosen || isRight) && (
                  <p className="mt-1 ml-12 text-[12.5px] text-[var(--text-secondary)]">{q.option_feedback[i]}</p>
                )}
              </div>
            )
          })}
          {!locked && <p className="text-[11px] text-[var(--text-tertiary)]">{TYPE_HINT[q.type]}</p>}
        </div>
      )}

      {q.type === 'nat' && (
        <div className="space-y-1.5">
          {locked ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="text-[var(--text-secondary)]">
                Your answer: <span className="font-semibold text-[var(--text-primary)]">{formatAnswer(chosen)}</span>
              </span>
              {revealed && (
                <span className="text-[var(--text-secondary)]">
                  Accepted: <span className="font-semibold text-success">{formatAnswer(q.answer)}</span>
                </span>
              )}
            </div>
          ) : (
            <>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={natText ?? ''}
                onChange={(e) => onNatTextChange?.(e.target.value)}
                placeholder="Enter a number"
                className="w-full sm:w-64 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] px-3 py-2 text-[15px] text-[var(--text-primary)] focus:outline-none focus:border-[var(--border-strong)]"
                aria-label="Numerical answer"
              />
              <p className="text-[11px] text-[var(--text-tertiary)]">{TYPE_HINT.nat}</p>
            </>
          )}
        </div>
      )}

      {revealed && result && (
        <div className="space-y-3 border-t border-[var(--border-default)] pt-4">
          {q.type !== 'nat' && (
            <div className="text-sm text-[var(--text-secondary)]">
              Correct answer: <span className="font-semibold text-success">{formatAnswer(q.answer)}</span>
              {chosen != null && !result.isCorrect && (
                <span className="ml-3">
                  You chose: <span className="font-semibold text-danger">{formatAnswer(chosen)}</span>
                </span>
              )}
            </div>
          )}
          {q.trap && (
            <div className="flex gap-2.5 rounded-xl border border-warning/30 bg-warning/5 px-3.5 py-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 text-warning mt-0.5" />
              <div className="text-[13px] text-[var(--text-secondary)]">
                <span className="font-semibold text-[var(--text-primary)]">Common trap: </span>
                {q.trap}
              </div>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => setShowSolution((v) => !v)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
            >
              Worked solution
              <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', showSolution && 'rotate-180')} />
            </button>
            {showSolution && <Md className="mt-2">{q.explanation ?? ''}</Md>}
          </div>
        </div>
      )}
    </div>
  )
}
