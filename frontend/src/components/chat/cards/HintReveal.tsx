import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import Disclosure from '../../ui/Disclosure'

export interface HintRevealProps {
  hint: string
  buttonLabel?: string
}

/**
 * "Show hint" affordance used inside an unsolved practice problem card.
 * Hides the hint by default so students attempt the problem first; clicking
 * the lightbulb-flagged button reveals it.
 */
export default function HintReveal({ hint, buttonLabel = 'Show hint' }: HintRevealProps) {
  const [open, setOpen] = useState(false)
  return (
    <Disclosure
      open={open}
      onToggle={() => setOpen((o) => !o)}
      buttonLabel={
        <span className="inline-flex items-center gap-1.5">
          <Lightbulb className="h-3.5 w-3.5" />
          {open ? 'Hide hint' : buttonLabel}
        </span>
      }
    >
      <div className="rounded-md border border-[var(--border-default)] bg-[var(--bg-tertiary)] px-3 py-2 text-sm text-[var(--text-secondary)] leading-relaxed">
        {hint}
      </div>
    </Disclosure>
  )
}
