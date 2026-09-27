import { ArrowRight } from 'lucide-react'
import Badge from '../ui/Badge'
import type { BadgeVariant } from '../ui/Badge'

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low'

export interface Task {
  title: string
  priority: TaskPriority
  reason: string
}

export interface TaskFeedProps {
  tasks?: Task[]
}

const priorityVariant: Record<TaskPriority, BadgeVariant> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'primary',
  low: 'default',
}

export default function TaskFeed({ tasks = [] }: TaskFeedProps) {
  return (
    <div className="space-y-2">
      {tasks.map((task, i) => (
        <div
          key={i}
          className="card-hover p-3 flex items-center gap-3 cursor-pointer group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium text-[var(--text-primary)] truncate">{task.title}</span>
              <Badge variant={priorityVariant[task.priority]} size="sm">{task.priority}</Badge>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] truncate">{task.reason}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)] transition-colors shrink-0" />
        </div>
      ))}
    </div>
  )
}
