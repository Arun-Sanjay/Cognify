export interface Activity {
  text: string
  time: string
}

export interface ActivityFeedProps {
  activities?: Activity[]
}

export default function ActivityFeed({ activities = [] }: ActivityFeedProps) {
  return (
    <div className="space-y-3">
      {activities.map((item, i) => (
        <div key={i} className="flex items-start gap-3">
          <span className="mt-1.5 h-2 w-2 rounded-full bg-[var(--text-tertiary)] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-primary)]">{item.text}</p>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">{item.time}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
