import type { ReactNode } from 'react'

export interface StepCardProps {
  /** "STEP 1", "STEP 2"... If null, only `title` is shown. */
  index: number | null
  /** The uppercase title after the em-dash, e.g. "CHARACTERISTIC EQUATION". */
  title: string
  body: ReactNode
}

/**
 * One step of a worked solution. Rendered as a subtle bordered box with a
 * caps-tracked label header, mirroring the visual rhythm of Claude.ai's
 * stepped solutions.
 */
export default function StepCard({ index, title, body }: StepCardProps) {
  const label = index != null ? `STEP ${index} — ${title}` : title
  return (
    <div className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)] p-3 my-2 min-w-0 max-w-full overflow-hidden">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
        {label}
      </div>
      <div className="text-sm text-[var(--text-primary)] leading-relaxed">{body}</div>
    </div>
  )
}
