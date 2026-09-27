/**
 * Admin notification dashboard response shapes.
 *
 * Mirrors `backend/app/schemas/notification_admin.py`. Used by the
 * /admin/notifications page to render the live delivery table + the
 * three header stat cards (delivery rate, pending, failed).
 */

export type NotificationDeliveryStatus = 'pending' | 'sent' | 'acked' | 'failed'

export type NotificationDeliveryType = 'system' | 'announcement'

export interface NotificationDeliveryRow {
  id: string
  user_id: string
  user_name: string | null
  user_email: string | null
  notification_type: NotificationDeliveryType | string
  title: string
  content: string
  sequence_number: number
  status: NotificationDeliveryStatus
  retry_count: number
  last_sent_at: string | null
  acked_at: string | null
  created_at: string
  /** Server-computed latency in ms — null while still PENDING. */
  latency_ms: number | null
}

export interface NotificationStatusResponse {
  rows: NotificationDeliveryRow[]
  total: number
}

export interface NotificationStatsResponse {
  total: number
  pending: number
  sent: number
  acked: number
  failed: number
  delivery_rate_percent: number
}
