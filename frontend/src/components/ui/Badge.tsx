import { clsx } from 'clsx'
import type { ReactNode } from 'react'

const variants = {
  default: 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] border-[var(--border-default)]',
  primary: 'bg-primary/5 text-[var(--text-primary)] border-primary/10',
  success: 'bg-success-light text-success dark:bg-success/10 border-success/20',
  warning: 'bg-warning-light text-warning dark:bg-warning/10 border-warning/20',
  danger: 'bg-danger-light text-danger dark:bg-danger/10 border-danger/20',
  info: 'bg-info-light text-info dark:bg-info/10 border-info/20',
  bronze: 'bg-tier-bronze/10 text-tier-bronze border-tier-bronze/20',
  silver: 'bg-tier-silver/10 text-tier-silver border-tier-silver/20',
  gold: 'bg-tier-gold/10 text-tier-gold border-tier-gold/20',
} satisfies Record<string, string>

const sizes = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
} satisfies Record<string, string>

export type BadgeVariant = keyof typeof variants
export type BadgeSize = keyof typeof sizes

export interface BadgeProps {
  children: ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  className?: string
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  dot = false,
  className,
}: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-md border font-medium',
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {dot && (
        <span className={clsx(
          'h-1.5 w-1.5 rounded-full',
          variant === 'success' && 'bg-success',
          variant === 'warning' && 'bg-warning',
          variant === 'danger' && 'bg-danger',
          variant === 'info' && 'bg-info',
          (variant === 'default' || variant === 'primary') && 'bg-[var(--text-tertiary)]',
        )} />
      )}
      {children}
    </span>
  )
}
