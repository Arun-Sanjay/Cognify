import { clsx } from 'clsx'
import type { LucideIcon } from 'lucide-react'

export interface StatCardProps {
  label: string
  value: string | number
  icon?: LucideIcon
  trend?: number
  className?: string
}

export default function StatCard({ label, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={clsx('card p-4', className)}>
      <div className="flex items-start justify-between mb-3">
        <span className="label">{label}</span>
        {Icon && <Icon className="h-4 w-4 text-[var(--text-tertiary)]" />}
      </div>
      <div className="flex items-end gap-2">
        <span className="stat-value">{value}</span>
        {trend && (
          <span className={clsx(
            'text-xs font-medium mb-1',
            trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-[var(--text-tertiary)]',
          )}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
    </div>
  )
}
