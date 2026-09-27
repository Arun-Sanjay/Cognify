import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, Megaphone, Trophy, BookOpen, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  useNotificationStore,
  type NotificationKind,
} from '../../store/notificationStore'

const TOAST_LIFETIME_MS = 6000

const KIND_ICONS: Record<NotificationKind, LucideIcon> = {
  quiz_result: BookOpen,
  score_update: Trophy,
  deadline_reminder: Bell,
  interview_feedback: Trophy,
  badge_earned: Trophy,
  announcement: Megaphone,
  doubt_answered: Bell,
  system: Bell,
}

export default function NotificationToasts() {
  const toasts = useNotificationStore((s) => s.toasts)
  const dismiss = useNotificationStore((s) => s.dismiss)

  useEffect(() => {
    if (toasts.length === 0) return undefined
    const timers = toasts.map((t) =>
      window.setTimeout(() => dismiss(t.id), TOAST_LIFETIME_MS),
    )
    return () => {
      for (const id of timers) window.clearTimeout(id)
    }
  }, [toasts, dismiss])

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => {
          const Icon = KIND_ICONS[toast.type] ?? Bell
          return (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ duration: 0.25 }}
              className="pointer-events-auto w-80 rounded-lg border border-[var(--border-default)] bg-[var(--bg-elevated)] shadow-lg p-3 flex items-start gap-3"
            >
              <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                  {toast.title}
                </p>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 line-clamp-2">
                  {toast.content}
                </p>
              </div>
              <button
                onClick={() => dismiss(toast.id)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] shrink-0"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
