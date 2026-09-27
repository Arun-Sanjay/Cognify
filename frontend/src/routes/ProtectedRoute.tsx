import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { authApi, ApiError } from '../api/client'
import type { UserRole } from '../types'

interface ProtectedRouteProps {
  allowedRoles?: UserRole[]
}

/**
 * Route wrapper that:
 *  1. Redirects to /login if there's no token
 *  2. Calls GET /auth/me on first load to validate the token + refresh user data
 *  3. Enforces role-based access when `allowedRoles` is provided
 */
export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const logout = useAuthStore((s) => s.logout)

  const [validated, setValidated] = useState(false)

  useEffect(() => {
    if (!token || validated) return
    let cancelled = false
    authApi
      .me()
      .then((freshUser) => {
        if (!cancelled) {
          updateUser(freshUser)
          setValidated(true)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          if (err instanceof ApiError && err.status === 401) {
            logout()
          }
          setValidated(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [token, validated, updateUser, logout])

  // Not logged in — redirect to login, preserving intended destination
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  // Logged in but wrong role
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const roleHomeMap: Record<UserRole, string> = {
      student: '/student',
      teacher: '/teacher',
      admin: '/admin',
    }
    return <Navigate to={roleHomeMap[user.role] ?? '/'} replace />
  }

  return <Outlet />
}
