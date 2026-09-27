import { clsx } from 'clsx'
import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hover?: boolean
  padding?: boolean
  className?: string
}

export default function Card({
  children,
  hover = false,
  padding = true,
  className,
  ...props
}: CardProps) {
  return (
    <div
      className={clsx(
        hover ? 'card-hover' : 'card',
        padding && 'p-4',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardHeaderProps {
  children: ReactNode
  action?: ReactNode
  className?: string
}

export function CardHeader({ children, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-center justify-between mb-3', className)}>
      <div>{children}</div>
      {action && <div>{action}</div>}
    </div>
  )
}

export interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={clsx('font-semibold text-[var(--text-primary)]', className)}>{children}</h3>
  )
}

export interface CardLabelProps {
  children: ReactNode
  className?: string
}

export function CardLabel({ children, className }: CardLabelProps) {
  return (
    <span className={clsx('label', className)}>{children}</span>
  )
}
