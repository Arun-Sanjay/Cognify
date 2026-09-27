/**
 * Tiny Zustand store for inbound real-time notifications (Phase 9).
 *
 * The WebSocket hook pushes events into this store; the toast component
 * subscribes and renders the stack with auto-dismiss timers.
 */
import { create } from 'zustand'

export type NotificationKind =
  | 'quiz_result'
  | 'score_update'
  | 'deadline_reminder'
  | 'interview_feedback'
  | 'badge_earned'
  | 'announcement'
  | 'doubt_answered'
  | 'system'

export interface PushNotification {
  /** Server-issued id when present, otherwise a client-generated one. */
  id: string
  type: NotificationKind
  title: string
  content: string
  /** ISO timestamp from the server. */
  createdAt: string
}

interface NotificationStore {
  toasts: PushNotification[]
  push: (n: Omit<PushNotification, 'createdAt'> & { createdAt?: string }) => void
  dismiss: (id: string) => void
  clear: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  toasts: [],
  push: (n) =>
    set((state) => {
      const next: PushNotification = {
        id: n.id,
        type: n.type,
        title: n.title,
        content: n.content,
        createdAt: n.createdAt ?? new Date().toISOString(),
      }
      // Cap at 5 visible toasts (newest at top).
      return { toasts: [next, ...state.toasts.filter((t) => t.id !== next.id)].slice(0, 5) }
    }),
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}))
