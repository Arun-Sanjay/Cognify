import type {
  MasteryLevel,
  NatAnswer,
  QuestionType,
  QuizAnswerValue,
  QuizQuestion,
  SubtopicOverview,
} from '../../types'

export const LETTERS = ['A', 'B', 'C', 'D'] as const

export const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'Recall',
  2: 'Easy',
  3: 'Medium',
  4: 'Hard',
  5: 'GATE+',
}

export const DIFFICULTY_HINT: Record<number, string> = {
  1: 'Definitions and facts',
  2: 'One-step application',
  3: 'GATE 1-mark style',
  4: 'GATE 2-mark, multi-step',
  5: 'Hardest GATE 2-mark',
}

export const TYPE_LABEL: Record<QuestionType, string> = { mcq: 'MCQ', msq: 'MSQ', nat: 'NAT' }

export const TYPE_HINT: Record<QuestionType, string> = {
  mcq: 'One correct option · −⅓ mark if wrong',
  msq: 'One or more correct · no partial or negative marks',
  nat: 'Type a number · no negative marks',
}

export const LEVEL_LABEL: Record<MasteryLevel, string> = {
  new: 'Not started',
  learning: 'Learning',
  proficient: 'Proficient',
  mastered: 'Mastered',
}

export const LEVEL_BADGE: Record<MasteryLevel, 'default' | 'info' | 'warning' | 'success'> = {
  new: 'default',
  learning: 'warning',
  proficient: 'info',
  mastered: 'success',
}

/** Bar colour for a 0–100 readiness score. */
export function readinessColor(readiness: number): string {
  if (readiness >= 80) return 'bg-success'
  if (readiness >= 50) return 'bg-info'
  if (readiness >= 25) return 'bg-warning'
  return 'bg-danger'
}

/** Exact number of questions matching a difficulty × type filter across subtopics. */
export function poolSize(
  subtopics: SubtopicOverview[],
  difficulties: number[],
  types: QuestionType[],
): number {
  const ds = difficulties.length ? difficulties : [1, 2, 3, 4, 5]
  const ts = types.length ? types : (['mcq', 'msq', 'nat'] as QuestionType[])
  let n = 0
  for (const s of subtopics) {
    for (const d of ds) for (const t of ts) n += s.by_difficulty_type[`${d}:${t}`] ?? 0
  }
  return n
}

export function isNatAnswer(a: unknown): a is NatAnswer {
  return typeof a === 'object' && a !== null && 'min' in a && 'max' in a
}

function fmtNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(6)))
}

/** Human text for the correct answer or a student's response. */
export function formatAnswer(value: QuizQuestion['answer'] | QuizAnswerValue | undefined): string {
  if (value == null || value === '') return '—'
  if (isNatAnswer(value)) {
    return value.min === value.max ? fmtNumber(value.min) : `${fmtNumber(value.min)} to ${fmtNumber(value.max)}`
  }
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'number') return fmtNumber(value)
  return value
}

/** Letters that are part of the correct answer (MCQ/MSQ). */
export function correctLetters(q: QuizQuestion): string[] {
  if (typeof q.answer === 'string') return [q.answer]
  if (Array.isArray(q.answer)) return q.answer
  return []
}

/** Parse what the student typed for a NAT question; null if it isn't a number. */
export function parseNat(text: string): number | null {
  const t = text.trim()
  if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(t)) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** `95_000` → `1:35`, `3_725_000` → `1:02:05`. */
export function formatClock(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** GATE marks shown with sign: `+2`, `−0.67`, `0`. */
export function formatMarks(m: number): string {
  if (m === 0) return '0'
  const abs = Number(Math.abs(m).toFixed(2))
  return m > 0 ? `+${abs}` : `−${abs}`
}

/** Parse a server timestamp; one without a zone is UTC (never local time). */
export function parseServerTime(iso: string): number {
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : `${iso}Z`)
}
