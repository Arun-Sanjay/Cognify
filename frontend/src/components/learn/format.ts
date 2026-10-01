/** `754` → `12:34`, `3725` → `1:02:05`. */
export function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

/** `2723123` → `2.7M`, `46500` → `46.5K`. */
export function formatCount(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`
  return String(n)
}

/** `741` → `12 min`, `5400` → `1 h 30 min`. */
export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60)
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

export const LANGUAGE_LABEL = { hinglish: 'Hinglish', english: 'English' } as const

// "[3:35]", "[03:35]", "[1:02:05]" and the start of ranges like "[4:31–5:10]".
const TIMESTAMP = /\[(\d{1,2}(?::\d{2}){1,2})(?:\s*[–-]\s*\d{1,2}(?::\d{2}){1,2})?\]/g

export function toSeconds(stamp: string): number {
  return stamp.split(':').reduce((acc, part) => acc * 60 + Number(part), 0)
}

/** Turn cited timestamps into `#t=<seconds>` links the panel intercepts. */
export function linkTimestamps(markdown: string): string {
  return markdown.replace(TIMESTAMP, (match, start: string) => `[${match.slice(1, -1)}](#t=${toSeconds(start)})`)
}
