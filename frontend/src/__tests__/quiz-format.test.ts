import { describe, expect, it } from 'vitest'
import {
  correctLetters,
  formatAnswer,
  formatClock,
  formatMarks,
  parseNat,
  parseServerTime,
  poolSize,
} from '../components/quiz/quizFormat'
import type { QuizQuestion, SubtopicOverview } from '../types'

const sub = (counts: Record<string, number>): SubtopicOverview => ({
  id: 's',
  name: 'S',
  question_count: 0,
  by_difficulty: {},
  by_type: {},
  by_difficulty_type: counts,
  seen: 0,
  reviews_due: 0,
  skill: { subtopic: 's', rating: 0, attempts: 0, correct: 0, level: 'new', readiness: 27, uncertainty: 1 },
})

describe('poolSize', () => {
  const subs = [sub({ '1:mcq': 2, '3:nat': 4, '4:nat': 1 }), sub({ '3:mcq': 3, '3:nat': 1 })]
  it('counts everything when no filter is set', () => {
    expect(poolSize(subs, [], [])).toBe(11)
  })
  it('applies difficulty and type filters together', () => {
    expect(poolSize(subs, [3], ['nat'])).toBe(5)
    expect(poolSize(subs, [3, 4], [])).toBe(9)
    expect(poolSize(subs, [], ['mcq'])).toBe(5)
  })
})

describe('formatAnswer', () => {
  it('formats each answer shape', () => {
    expect(formatAnswer('B')).toBe('B')
    expect(formatAnswer(['A', 'C'])).toBe('A, C')
    expect(formatAnswer({ min: 8, max: 8 })).toBe('8')
    expect(formatAnswer({ min: 13.33, max: 13.34 })).toBe('13.33 to 13.34')
    expect(formatAnswer(0.1 + 0.2)).toBe('0.3')
    expect(formatAnswer(null)).toBe('—')
  })
})

describe('correctLetters', () => {
  const q = { answer: 'C' } as QuizQuestion
  it('normalises MCQ / MSQ / NAT answers', () => {
    expect(correctLetters(q)).toEqual(['C'])
    expect(correctLetters({ ...q, answer: ['A', 'D'] })).toEqual(['A', 'D'])
    expect(correctLetters({ ...q, answer: { min: 1, max: 1 } })).toEqual([])
  })
})

describe('parseNat', () => {
  it('accepts plain numbers only', () => {
    expect(parseNat('12')).toBe(12)
    expect(parseNat(' -3.5 ')).toBe(-3.5)
    expect(parseNat('.25')).toBe(0.25)
    expect(parseNat('1e3')).toBe(1000)
    expect(parseNat('')).toBeNull()
    expect(parseNat('12ms')).toBeNull()
    expect(parseNat('1/3')).toBeNull()
  })
})

describe('formatClock / formatMarks', () => {
  it('formats durations and signed marks', () => {
    expect(formatClock(95_000)).toBe('1:35')
    expect(formatClock(3_725_000)).toBe('1:02:05')
    expect(formatMarks(2)).toBe('+2')
    expect(formatMarks(-2 / 3)).toBe('−0.67')
    expect(formatMarks(0)).toBe('0')
  })
})

describe('parseServerTime', () => {
  it('treats zone-less timestamps as UTC', () => {
    expect(parseServerTime('2026-10-01T04:59:10')).toBe(Date.UTC(2026, 9, 1, 4, 59, 10))
    expect(parseServerTime('2026-10-01T04:59:10Z')).toBe(Date.UTC(2026, 9, 1, 4, 59, 10))
    expect(parseServerTime('2026-10-01T10:29:10+05:30')).toBe(Date.UTC(2026, 9, 1, 4, 59, 10))
  })
})
