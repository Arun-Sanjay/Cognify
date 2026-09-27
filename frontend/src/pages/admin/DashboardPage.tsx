import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, type Variants } from 'framer-motion'
import { AlertCircle, ArrowRight, FileText, Loader2, MessageSquare, Users } from 'lucide-react'
import Card, { CardHeader, CardTitle } from '../../components/ui/Card'
import ProgressBar from '../../components/ui/ProgressBar'
import StatCard from '../../components/dashboard/StatCard'
import { ApiError, adminApi } from '../../api/client'
import type { AdminStatsResponse } from '../../types'

const stagger: Variants = { animate: { transition: { staggerChildren: 0.05 } } }
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}

export default function DashboardPage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    adminApi
      .stats()
      .then(setStats)
      .catch((err) =>
        setError(err instanceof ApiError && typeof err.detail === 'string' ? err.detail : 'Could not load stats'),
      )
  }, [])

  if (error) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>{error}</span>
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-[40vh]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--text-tertiary)]" />
      </div>
    )
  }

  const roles = [
    { label: 'Students', value: stats.students },
    { label: 'Teachers', value: stats.teachers },
    { label: 'Admins', value: stats.admins },
  ]

  return (
    <motion.div variants={stagger} initial="initial" animate="animate" className="space-y-6">
      <motion.div variants={fadeUp} className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <StatCard label="TOTAL USERS" value={stats.total_users} icon={Users} />
        <StatCard
          label="DOCUMENTS"
          value={`${stats.ready_documents}/${stats.documents}`}
          icon={FileText}
        />
        <StatCard label="CHAT SESSIONS" value={stats.chat_sessions} icon={MessageSquare} />
      </motion.div>

      <motion.div variants={fadeUp} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Users by role</CardTitle>
          </CardHeader>
          <div className="space-y-4">
            {roles.map((r) => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="text-[var(--text-secondary)]">{r.label}</span>
                  <span className="font-medium text-[var(--text-primary)]">{r.value}</span>
                </div>
                <ProgressBar value={stats.total_users ? (r.value / stats.total_users) * 100 : 0} />
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manage</CardTitle>
          </CardHeader>
          <div className="space-y-1">
            {[
              { to: '/admin/users', label: 'User management' },
              { to: '/admin/library', label: 'Library (knowledge base)' },
              { to: '/admin/notifications', label: 'Notification delivery' },
            ].map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                {l.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            ))}
          </div>
        </Card>
      </motion.div>
    </motion.div>
  )
}
