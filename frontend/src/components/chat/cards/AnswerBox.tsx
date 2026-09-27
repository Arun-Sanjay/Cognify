import type { ReactNode } from 'react'

export interface AnswerBoxProps {
  body: ReactNode
}

/**
 * Final-answer box. Greenish accent borrowed from the `success` token so it
 * pops against neutral step cards while still working in all three themes
 * (the success token is themed via Tailwind, not hardcoded).
 */
export default function AnswerBox({ body }: AnswerBoxProps) {
  return (
    <div className="rounded-lg border border-success/40 bg-success/5 p-3 my-2 min-w-0 max-w-full overflow-hidden">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-success mb-1.5">
        Answer
      </div>
      <div className="text-sm text-[var(--text-primary)] leading-relaxed">{body}</div>
    </div>
  )
}
