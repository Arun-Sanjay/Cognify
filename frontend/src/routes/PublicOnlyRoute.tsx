import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types'

const roleHome: Record<UserRole, string> = {
  student: '/student',
  teacher: '/teacher',
  admin: '/admin',
}

/**
 * Wraps login/signup pages — if already authenticated, redirect to the role home.
 */
export default function PublicOnlyRoute() {
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)

  if (token && user) {
    return <Navigate to={roleHome[user.role] ?? '/'} replace />
  }

  return <Outlet />
}
