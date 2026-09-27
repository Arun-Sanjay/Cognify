import { clsx } from 'clsx'

const heights = {
  sm: 'h-1',
  md: 'h-2',
  lg: 'h-3',
} satisfies Record<string, string>

const colors = {
  primary: 'bg-primary dark:bg-white',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
  info: 'bg-info',
  purple: 'bg-feature-place',
} satisfies Record<string, string>

export type ProgressBarSize = keyof typeof heights
export type ProgressBarColor = keyof typeof colors

export interface ProgressBarProps {
  value?: number
  max?: number
  label?: string
  showValue?: boolean
  size?: ProgressBarSize
  color?: ProgressBarColor
  className?: string
}

export default function ProgressBar({
  value = 0,
  max = 100,
  label,
  showValue = false,
  size = 'md',
  color = 'primary',
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100))

  return (
    <div className={clsx('w-full', className)}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-xs font-medium text-[var(--text-secondary)]">{label}</span>}
          {showValue && (
            <span className="text-xs text-[var(--text-tertiary)]">{value} / {max}</span>
          )}
        </div>
      )}
      <div className={clsx('w-full bg-[var(--bg-tertiary)] rounded-full overflow-hidden', heights[size])}>
        <div
          className={clsx('rounded-full transition-all duration-500 ease-out', heights[size], colors[color])}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
