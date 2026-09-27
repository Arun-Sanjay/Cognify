import { BookOpen, Network, ListChecks } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { clsx } from 'clsx'
import type { AssistantMode } from '../../types'

export interface ModeSelectorProps {
  value: AssistantMode
  onChange: (mode: AssistantMode) => void
  disabled?: boolean
}

interface ModeOption {
  value: AssistantMode
  label: string
  Icon: LucideIcon
  hint: string
}

const MODES: ModeOption[] = [
  {
    value: 'explain',
    label: 'Explain',
    Icon: BookOpen,
    hint: 'Concept walk-through grounded in your notes.',
  },
  {
    value: 'diagram',
    label: 'Diagram',
    Icon: Network,
    hint: 'Mermaid diagram + how to read it.',
  },
  {
    value: 'questions',
    label: 'Questions',
    Icon: ListChecks,
    hint: 'Solved + unsolved practice problems.',
  },
]

/**
 * Three-button segmented control for picking the Note Assistant response mode.
 * Lives above the chat input on `NoteAssistantPage`.
 */
export default function ModeSelector({ value, onChange, disabled = false }: ModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Response mode"
      className="inline-flex items-center gap-1 p-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]"
    >
      {MODES.map(({ value: mode, label, Icon, hint }) => {
        const isActive = mode === value
        return (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={`${label} mode — ${hint}`}
            title={hint}
            disabled={disabled}
            onClick={() => onChange(mode)}
            className={clsx(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gradient-accent)]/40',
              isActive
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        )
      })}
    </div>
  )
}
