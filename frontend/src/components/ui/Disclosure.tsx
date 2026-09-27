import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface DisclosureProps {
  open: boolean
  onToggle: () => void
  /** Button label (can include an icon). */
  buttonLabel: ReactNode
  /** Content shown when `open` is true. */
  children: ReactNode
  className?: string
}

/**
 * Generic show/hide primitive. Used by `HintReveal` and any other
 * "click to reveal" surface in the chat (Phase 4 may wire this up for
 * "Show explanation" on diagrams).
 *
 * Controlled component — the parent owns the open state.
 */
export default function Disclosure({
  open,
  onToggle,
  buttonLabel,
  children,
  className,
}: DisclosureProps) {
  return (
    <div className={clsx('inline-block', className)}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gradient-accent)]/40"
      >
        {buttonLabel}
      </button>
      {open && <div className="mt-2 block">{children}</div>}
    </div>
  )
}
