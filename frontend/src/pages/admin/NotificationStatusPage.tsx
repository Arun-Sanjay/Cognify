/**
 * Admin Notification Status — wired to the real TCP-style delivery layer.
 *
 * Header stat cards pull from `/admin/notifications/stats`. The table
 * pulls a paginated slice from `/admin/notifications/status`. A manual
 * "Refresh" button lets the demo runner pull a fresh snapshot mid-stage;
 * a quiet 5s background poll keeps the view current without flicker.
 *
 * Reads are best-effort — when the network blips, the previous snapshot
 * stays visible and an inline pill explains the failure.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { clsx } from 'clsx'
import {
  Bell,
  CheckCircle2,
  Clock,
  Info,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import type { BadgeVariant } from '../../components/ui/Badge'
import { ResponsiveTable, type ResponsiveColumn } from '../../components/ui'
import StatCard from '../../components/dashboard/StatCard'
import { ApiError, adminApi } from '../../api/client'
import type {
  NotificationDeliveryRow,
  NotificationDeliveryStatus,
  NotificationStatsResponse,
} from '../../types'

const stagger: Variants = { animate: { transition: { staggerChildren: 0.05 } } }
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const POLL_INTERVAL_MS = 5_000
const PAGE_SIZE = 50

type FilterType = 'All' | 'Pending' | 'Sent' | 'Failed' | 'Acked'
const FILTER_TO_STATUS: Record<FilterType, NotificationDeliveryStatus | null> = {
  All: null,
  Pending: 'pending',
  Sent: 'sent',
  Failed: 'failed',
  Acked: 'acked',
}
const FILTERS: FilterType[] = ['All', 'Acked', 'Sent', 'Pending', 'Failed']

function statusBadge(status: NotificationDeliveryStatus): {
  label: string
  variant: BadgeVariant
} {
  switch (status) {
    case 'acked':
      return { label: 'Acked', variant: 'success' }
    case 'sent':
      return { label: 'Sent', variant: 'info' }
    case 'failed':
      return { label: 'Failed', variant: 'danger' }
    case 'pending':
    default:
      return { label: 'Pending', variant: 'warning' }
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const now = Date.now()
  const diffSec = Math.round((now - d.getTime()) / 1000)
  if (diffSec >= 0 && diffSec < 60) return `${diffSec}s ago`
  if (diffSec >= 60 && diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatLatency(ms: number | null): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  if (s < 3600) return `${Math.round(s / 60)} m`
  if (s < 86400) return `${Math.round(s / 3600)} h`
  return `${Math.round(s / 86400)} d`
}

function humanType(type: string): string {
  return type
    .split('_')
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ')
}

export default function NotificationStatusPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>('All')
  const [stats, setStats] = useState<NotificationStatsResponse | null>(null)
  const [rows, setRows] = useState<NotificationDeliveryRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [statsResp, statusResp] = await Promise.all([
        adminApi.notificationStats(),
        adminApi.notificationStatus({ limit: PAGE_SIZE }),
      ])
      setStats(statsResp)
      setRows(statusResp.rows)
      setTotal(statusResp.total)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      setError(
        err instanceof ApiError && typeof err.detail === 'string'
          ? err.detail
          : 'Could not load notification status.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(() => {
      void refresh()
    }, POLL_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [refresh])

  const filtered = useMemo(() => {
    const status = FILTER_TO_STATUS[activeFilter]
    if (!status) return rows
    return rows.filter((r) => r.status === status)
  }, [rows, activeFilter])

  const headerStats = stats ?? {
    total: 0,
    pending: 0,
    sent: 0,
    acked: 0,
    failed: 0,
    delivery_rate_percent: 0,
  }

  const columns: ResponsiveColumn<NotificationDeliveryRow>[] = [
    {
      key: 'seq',
      header: 'Seq',
      className: 'font-mono text-[var(--text-tertiary)] tabular-nums',
      render: (row) => `#${row.sequence_number}`,
    },
    {
      key: 'type',
      header: 'Type',
      primary: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
          <span className="text-[var(--text-primary)] font-medium">
            {humanType(row.notification_type)}
          </span>
        </div>
      ),
    },
    {
      key: 'recipient',
      header: 'Recipient',
      className: 'text-[var(--text-secondary)]',
      render: (row) => (
        <>
          <div className="text-[var(--text-primary)]">
            {row.user_name ?? row.user_email ?? row.user_id.slice(0, 8)}
          </div>
          {row.user_email && (
            <div className="text-[11px] text-[var(--text-tertiary)]">{row.user_email}</div>
          )}
        </>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => {
        const badge = statusBadge(row.status)
        return (
          <Badge variant={badge.variant} size="sm" dot>
            {badge.label}
          </Badge>
        )
      },
    },
    {
      key: 'retries',
      header: 'Retries',
      render: (row) => (
        <span
          className={clsx(
            'font-medium tabular-nums',
            row.retry_count >= 3 ? 'text-danger' : 'text-[var(--text-secondary)]',
          )}
        >
          {row.retry_count}
        </span>
      ),
    },
    {
      key: 'latency',
      header: 'Latency',
      className: 'text-[var(--text-secondary)] tabular-nums',
      render: (row) => formatLatency(row.latency_ms),
    },
    {
      key: 'last_sent',
      header: 'Last Sent',
      className: 'text-[var(--text-tertiary)] tabular-nums',
      render: (row) => formatTime(row.last_sent_at),
    },
    {
      key: 'acked_at',
      header: 'Acked At',
      className: 'text-[var(--text-tertiary)] tabular-nums',
      render: (row) => formatTime(row.acked_at),
    },
  ]

  const tableEmpty = loading
    ? 'Loading…'
    : activeFilter === 'All'
      ? 'No notifications delivered yet. Post an announcement to see one fire.'
      : `No ${activeFilter.toLowerCase()} notifications.`

  return (
    <motion.div className="space-y-6" variants={stagger} initial="initial" animate="animate">
      {/* Header */}
      <motion.div variants={fadeUp} className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Notification Status</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            Monitor TCP-style reliable notification delivery
            {lastUpdated && (
              <span className="ml-2 text-[var(--text-tertiary)]">
                · updated {formatTime(lastUpdated.toISOString())}
              </span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md border transition-colors disabled:opacity-60"
          style={{
            background: 'var(--bg-secondary)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-secondary)',
          }}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Refresh
        </button>
      </motion.div>

      {error && (
        <motion.div
          variants={fadeUp}
          className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger"
        >
          <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      {/* Stats */}
      <motion.div variants={fadeUp} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="DELIVERY RATE"
          value={`${headerStats.delivery_rate_percent.toFixed(1)}%`}
          icon={CheckCircle2}
        />
        <StatCard label="ACKED" value={String(headerStats.acked)} icon={CheckCircle2} />
        <StatCard label="PENDING" value={String(headerStats.pending)} icon={Clock} />
        <StatCard label="FAILED" value={String(headerStats.failed)} icon={XCircle} />
      </motion.div>

      {/* Status Filter */}
      <motion.div variants={fadeUp} className="flex gap-1 p-1 rounded-lg bg-[var(--bg-tertiary)] w-fit flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActiveFilter(f)}
            className={clsx(
              'px-4 py-2 text-sm font-medium rounded-md transition-all duration-200',
              activeFilter === f
                ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] shadow-sm'
                : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]',
            )}
          >
            {f}
            {f !== 'All' && (
              <span className="ml-1.5 text-[var(--text-tertiary)] tabular-nums">
                {f === 'Acked' && headerStats.acked}
                {f === 'Sent' && headerStats.sent}
                {f === 'Pending' && headerStats.pending}
                {f === 'Failed' && headerStats.failed}
              </span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Notification Table */}
      <motion.div variants={fadeUp}>
        <Card padding={false}>
          <ResponsiveTable
            columns={columns}
            rows={filtered}
            rowKey={(row) => row.id}
            empty={tableEmpty}
          />
        </Card>
        {total > PAGE_SIZE && (
          <p className="mt-2 text-[11px] text-[var(--text-tertiary)] text-right">
            Showing {filtered.length} of {total} latest rows.
          </p>
        )}
      </motion.div>

      {/* How it works */}
      <motion.div variants={fadeUp}>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-[var(--text-secondary)]" />
              <CardTitle>How TCP-Style Delivery Works</CardTitle>
            </div>
          </CardHeader>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Each notification gets a per-user sequence number. The client ACKs by
            id over the same WebSocket. The server retries with exponential
            backoff (1s, 2s, 4s, 8s) up to 3 times — exactly the schedule used
            by the existing demo plate. If no ACK arrives after the final retry,
            the row is marked <strong>Failed</strong> and stops being touched.
          </p>
        </Card>
      </motion.div>
    </motion.div>
  )
}
