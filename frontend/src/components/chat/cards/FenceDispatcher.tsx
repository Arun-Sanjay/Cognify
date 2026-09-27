import SolvedCard from './SolvedCard'
import UnsolvedCard from './UnsolvedCard'
import MermaidDiagram from './MermaidDiagram'

export interface FenceDispatcherProps {
  /** Language token from the fence (without the `language-` prefix). */
  language: string
  /** Optional info-string suffix from the fence header (e.g. `meta={...}`). */
  meta?: string
  /** Raw body of the fence (everything between the opening and closing fence). */
  body: string
  isStreaming?: boolean
}

interface ParsedMeta {
  meta: Record<string, unknown>
  body: string
}

/**
 * Try to extract a JSON metadata object from the head of the fence body.
 *
 * Accepts two forms (LLM occasionally drifts):
 * 1. First non-empty line of body is a JSON object → parse it, drop that line.
 * 2. Else, info-string suffix `meta={...}` after the language → parse it,
 *    keep the body untouched.
 *
 * Returns `{ meta: {}, body }` if nothing parses — cards then fall back to
 * sane defaults.
 */
function parseMeta(body: string, infoMeta: string | undefined): ParsedMeta {
  // Form 1: leading JSON line in body.
  const lines = body.split('\n')
  let firstNonEmptyIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim().length > 0) {
      firstNonEmptyIdx = i
      break
    }
  }
  if (firstNonEmptyIdx >= 0) {
    const candidate = lines[firstNonEmptyIdx]!.trim()
    if (candidate.startsWith('{') && candidate.endsWith('}')) {
      try {
        const parsed = JSON.parse(candidate)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          const remaining = lines.slice(firstNonEmptyIdx + 1).join('\n').replace(/^\n+/, '')
          return { meta: parsed as Record<string, unknown>, body: remaining }
        }
      } catch {
        // fall through to form 2
      }
    }
  }

  // Form 2: `meta={...}` from the info string.
  if (infoMeta) {
    const idx = infoMeta.indexOf('meta=')
    if (idx >= 0) {
      const json = infoMeta.slice(idx + 'meta='.length).trim()
      try {
        const parsed = JSON.parse(json)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return { meta: parsed as Record<string, unknown>, body }
        }
      } catch {
        // fall through
      }
    }
  }

  return { meta: {}, body }
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = parseInt(v, 10)
    if (Number.isFinite(n)) return n
  }
  return null
}

function asString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v : null
}

/**
 * Routes a custom-language code fence to the right card component.
 * Languages we recognise: `solved`, `unsolved`, `mermaid` (Phase 3).
 * Anything else just renders as a plain fenced code block (caller decides).
 */
export default function FenceDispatcher({ language, meta, body, isStreaming }: FenceDispatcherProps) {
  if (language === 'solved') {
    const { meta: m, body: rest } = parseMeta(body, meta)
    return (
      <SolvedCard
        index={asNumber(m.index)}
        problem={asString(m.problem) ?? 'Problem'}
        body={rest}
      />
    )
  }
  if (language === 'unsolved') {
    const { meta: m, body: rest } = parseMeta(body, meta)
    return (
      <UnsolvedCard
        index={asNumber(m.index)}
        problem={asString(m.problem) ?? 'Practice problem'}
        hint={asString(m.hint)}
        body={rest}
      />
    )
  }
  if (language === 'mermaid') {
    return <MermaidDiagram source={body} isStreaming={isStreaming} />
  }
  // Anything unrecognised: caller falls back to a plain code block.
  return null
}
