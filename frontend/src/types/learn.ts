// Mirrors backend/app/schemas/learn.py + the notes-deck shape documented in
// backend/content/learn/README.md.

export type LectureLanguage = 'hinglish' | 'english'

export interface LearnUnitSummary {
  id: string
  name: string
  number: number | null
  available: boolean
  topic_count: number
  lecture_count: number
  has_quiz: boolean
  syllabus: string
}

export interface LearnSubjectSummary {
  id: string
  code: string
  name: string
  description: string
  units: LearnUnitSummary[]
}

export interface LearnCatalog {
  subjects: LearnSubjectSummary[]
}

export interface LectureSummary {
  id: string
  youtube_id: string
  title: string
  channel: string
  language: LectureLanguage
  duration_sec: number
  views: number | null
  headline: string | null
  has_notes: boolean
}

export interface TopicOutline {
  id: string
  number: number
  title: string
  summary: string
  syllabus_points: string[]
  lectures: LectureSummary[]
}

export interface LearnUnitDetail {
  subject: { id: string; code: string; name: string }
  id: string
  name: string
  description: string
  syllabus: string
  has_quiz: boolean
  topics: TopicOutline[]
}

export interface TranscriptSegment {
  start: number
  dur: number
  text: string
}

// ── Notes deck ──────────────────────────────────────────────

export type NoteBlock =
  | { type: 'text'; md: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'steps'; title?: string; items: string[] }
  | { type: 'definition'; term: string; md: string }
  | { type: 'formula'; label?: string; expr: string; note?: string }
  | { type: 'table'; headers: string[]; rows: string[][]; caption?: string }
  | { type: 'compare'; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  | { type: 'example'; title?: string; question: string; solution: string }
  | { type: 'callout'; tone: 'tip' | 'gate' | 'warning' | 'insight'; title?: string; md: string }
  | { type: 'diagram'; mermaid: string; caption?: string }
  | { type: 'code'; language: string; code: string }

export interface NoteSlide {
  id: string
  title: string
  timestamp?: number | null
  image?: string | null
  image_caption?: string | null
  blocks: NoteBlock[]
}

export interface PracticeQuestion {
  type: 'mcq' | 'msq' | 'nat' | 'short'
  question: string
  options?: string[]
  answer: string
  explanation?: string
}

export interface NotesDeck {
  headline?: string
  summary?: string
  read_minutes?: number
  key_takeaways?: string[]
  gate_focus?: string[]
  slides: NoteSlide[]
  practice?: PracticeQuestion[]
}

export interface LectureDetail {
  id: string
  youtube_id: string
  subject_id: string
  unit_id: string
  topic_id: string
  topic_title: string
  title: string
  channel: string
  channel_url: string | null
  language: LectureLanguage
  duration_sec: number
  views: number | null
  likes: number | null
  comments: number | null
  upload_date: string | null
  why: string
  comment_highlights: string[]
  transcript: { source: string; language: string; segments: TranscriptSegment[] }
  notes: NotesDeck | null
}

export interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
}
