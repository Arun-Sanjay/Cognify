import { useEffect, useMemo, useState } from 'react'
import { motion, type Variants } from 'framer-motion'
import { AlertCircle, Loader2, Search } from 'lucide-react'
import Card from '../../components/ui/Card'
import Avatar from '../../components/ui/Avatar'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import { ResponsiveTable, type ResponsiveColumn } from '../../components/ui'
import { ApiError, adminApi } from '../../api/client'
import { useAuthStore } from '../../store/authStore'
import type { AdminUserRow, UserRole as AdminUserRole } from '../../types'

const stagger: Variants = { animate: { transition: { staggerChildren: 0.04 } } }
const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] } },
}

const ROLE_OPTIONS: { value: 'all' | AdminUserRole; label: string }[] = [
  { value: 'all', label: 'All roles' },
  { value: 'student', label: 'Students' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'admin', label: 'Admins' },
]

const ROLE_BADGE: Record<AdminUserRole, 'primary' | 'success' | 'warning'> = {
  student: 'primary',
  teacher: 'success',
  admin: 'warning',
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function UserManagementPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | AdminUserRole>('all')
  const [searchTerm, setSearchTerm] = useState('')

  // Fetch on mount + when filter changes; debounce search separately.
  const debouncedSearch = useDebouncedValue(searchTerm, 250)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        const data = await adminApi.listUsers({
          role: roleFilter,
          search: debouncedSearch || undefined,
          limit: 200,
        })
        if (!cancelled) {
          setUsers(data.items)
          setTotal(data.total)
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiError && typeof err.detail === 'string'
              ? err.detail
              : 'Could not load users',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [roleFilter, debouncedSearch])

  const currentUserId = useAuthStore((s) => s.user?.id)

  const toggleActive = async (u: AdminUserRow) => {
    try {
      const updated = await adminApi.updateUser(u.id, { is_active: !u.is_active })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
    } catch (err) {
      setError(err instanceof ApiError && typeof err.detail === 'string' ? err.detail : 'Update failed')
    }
  }

  const summary = useMemo(() => {
    const counts = { student: 0, teacher: 0, admin: 0 }
    for (const u of users) counts[u.role] += 1
    return counts
  }, [users])

  const columns: ResponsiveColumn<AdminUserRow>[] = [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      render: (u) => (
        <div className="flex items-center gap-2">
          <Avatar name={u.full_name} size="sm" />
          <span className="text-[var(--text-primary)] font-medium">{u.full_name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      className: 'text-[var(--text-secondary)]',
      render: (u) => u.email,
    },
    {
      key: 'role',
      header: 'Role',
      render: (u) => (
        <Badge variant={ROLE_BADGE[u.role]} size="sm">
          {u.role}
        </Badge>
      ),
    },
    {
      key: 'branch',
      header: 'Branch / Dept',
      className: 'text-[var(--text-secondary)]',
      render: (u) =>
        u.role === 'student'
          ? u.branch ?? '—'
          : u.department ?? '—',
    },
    {
      key: 'last_login',
      header: 'Last Login',
      className: 'text-[var(--text-tertiary)]',
      render: (u) => formatDate(u.last_login),
    },
    {
      key: 'joined',
      header: 'Joined',
      className: 'text-[var(--text-tertiary)]',
      render: (u) => formatDate(u.created_at),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u) => (
        <button
          type="button"
          onClick={() => void toggleActive(u)}
          disabled={u.id === currentUserId}
          title={u.id === currentUserId ? "You can't disable yourself" : u.is_active ? 'Disable account' : 'Enable account'}
          className="disabled:cursor-not-allowed"
        >
          <Badge variant={u.is_active ? 'success' : 'danger'} size="sm" dot>
            {u.is_active ? 'Active' : 'Disabled'}
          </Badge>
        </button>
      ),
    },
  ]

  return (
    <motion.div className="space-y-6" variants={stagger} initial="initial" animate="animate">
      <motion.div variants={fadeUp} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">User Management</h1>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">
            {total.toLocaleString()} total accounts ({summary.student} students,{' '}
            {summary.teacher} teachers, {summary.admin} admins shown)
          </p>
        </div>
      </motion.div>

      <motion.div variants={fadeUp} className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search by name or email…"
            icon={Search}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="sm:w-48">
          <Select
            options={ROLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={roleFilter}
            onChange={(e) =>
              setRoleFilter((e.target as HTMLSelectElement).value as 'all' | AdminUserRole)
            }
          />
        </div>
      </motion.div>

      {error && (
        <motion.div
          variants={fadeUp}
          className="flex items-start gap-2 p-3 rounded-lg bg-danger/10 border border-danger/20 text-sm text-danger"
        >
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </motion.div>
      )}

      <motion.div variants={fadeUp}>
        <Card padding={false}>
          <ResponsiveTable
            columns={columns}
            rows={loading ? [] : users}
            rowKey={(u) => u.id}
            empty={
              loading ? (
                <span>
                  <Loader2 className="h-4 w-4 animate-spin inline-block mr-2" />
                  Loading users…
                </span>
              ) : (
                'No users match the current filters.'
              )
            }
          />
        </Card>
      </motion.div>
    </motion.div>
  )
}

function useDebouncedValue<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}
