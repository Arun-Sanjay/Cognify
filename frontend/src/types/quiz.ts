// Mirrors backend/app/schemas/quiz.py.

export type QuizMode = 'practice' | 'exam' | 'adaptive'
export type QuestionType = 'mcq' | 'msq' | 'nat'
export type MasteryLevel = 'new' | 'learning' | 'proficient' | 'mastered'
export type AdaptiveTarget = 'challenge' | 'balanced' | 'confidence'

export interface SkillView {
  subtopic: string
  rating: number
  attempts: number
  correct: number
  level: MasteryLevel
  /** 0–100: predicted % of GATE 2-mark numericals answered right. */
  readiness: number
  /** Elo U(n): 1 = no evidence yet; shrinks with practice. */
  uncertainty: number
  before?: number | null
  readiness_before?: number | null
}

export interface SubtopicOverview {
  id: string
  name: string
  question_count: number
  by_difficulty: Record<string, number>
  by_type: Record<string, number>
  /** "3:nat" → count */
  by_difficulty_type: Record<string, number>
  seen: number
  reviews_due: number
  skill: SkillView
}

export interface TopicOverview {
  id: string
  title: string
  readiness: number | null
  subtopics: SubtopicOverview[]
}

export interface QuizAttemptSummary {
  id: string
  mode: QuizMode
  status: 'active' | 'completed'
  subject_id: string
  unit_id: string
  config: {
    subtopics?: string[]
    types?: QuestionType[] | null
    difficulties?: number[] | null
    count?: number
    time_limit_sec?: number
    target?: AdaptiveTarget
  }
  question_count: number
  answered: number
  correct: number
  score: number
  max_score: number
  started_at: string
  completed_at: string | null
}

export interface QuizOverview {
  subject_id: string
  unit_id: string
  question_count: number
  answered_total: number
  correct_total: number
  reviews_due: number
  topics: TopicOverview[]
  recent_attempts: QuizAttemptSummary[]
}

export type NatAnswer = { min: number; max: number }
export type QuizAnswerValue = string | string[] | number | null

export interface QuizQuestion {
  id: string
  topic_id: string
  subtopic: string
  difficulty: number
  type: QuestionType
  marks: number
  est_seconds: number
  concepts: string[]
  stem: string
  options: string[] | null
  // Present only once the question may be revealed.
  answer?: string | string[] | NatAnswer | null
  explanation?: string | null
  option_feedback?: string[] | null
  trap?: string | null
}

export interface QuizResponseView {
  question_id: string
  response: QuizAnswerValue
  is_correct?: boolean | null
  marks_awarded?: number | null
  time_ms?: number | null
  is_review?: boolean | null
  p_expected?: number | null
  skill_before?: number | null
  skill_after?: number | null
}

export interface SubtopicResult {
  id: string
  name: string
  topic_id: string | null
  topic_title: string | null
  answered: number
  correct: number
  readiness_start: number | null
  skill: SkillView
}

export interface QuizResults {
  subtopics: SubtopicResult[]
  by_difficulty: Record<string, { answered: number; correct: number }>
  unanswered: number
  reviews: number
  total_time_ms: number
  focus_next: string[]
}

export interface QuizAttemptDetail extends QuizAttemptSummary {
  questions: QuizQuestion[]
  responses: QuizResponseView[]
  current_question_id: string | null
  summary: QuizResults | null
}

export interface StartQuizRequest {
  mode: QuizMode
  subtopics: string[]
  difficulties?: number[] | null
  types?: QuestionType[] | null
  count: number
  target?: AdaptiveTarget
}

export interface QuizAnswerResult {
  question_id: string
  recorded: boolean
  done: boolean
  is_correct?: boolean | null
  marks_awarded?: number | null
  is_review?: boolean | null
  question?: QuizQuestion | null
  p_expected?: number | null
  skill?: SkillView | null
  next_question?: QuizQuestion | null
  next_is_review: boolean
}
