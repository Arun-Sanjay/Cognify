import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import BottomTabBar from './BottomTabBar'
import GradientMesh from './GradientMesh'
import PageTransition from './PageTransition'
import NotificationToasts from './NotificationToasts'
import ErrorBoundary from '../ErrorBoundary'
import { useAuthStore } from '../../store/authStore'
import { useNotificationsSocket } from '../../hooks/useNotificationsSocket'
import { titleForPath } from './navConfig'

type Role = 'student' | 'teacher' | 'admin'

function getRoleFromPath(pathname: string): Role {
  if (pathname.startsWith('/teacher')) return 'teacher'
  if (pathname.startsWith('/admin')) return 'admin'
  return 'student'
}

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  // Open the notifications WebSocket once we know who's logged in.
  useNotificationsSocket()

  // Mobile nav drawer: auto-close on navigation, lock body scroll while open.
  useEffect(() => { setMobileNavOpen(false) }, [location.pathname])
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileNavOpen])
  const role: Role = user?.role ?? getRoleFromPath(location.pathname)
  const title = titleForPath(location.pathname) ?? 'Cognify'

  const displayUser = {
    name: user?.full_name || 'User',
    email: user?.email || '',
  }

  return (
    <div className="min-h-dvh relative" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Premium gradient mesh background */}
      <GradientMesh />

      <Sidebar
        role={role}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
        user={displayUser}
      />

      {/* Mobile drawer backdrop */}
      {mobileNavOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm fade-in"
          onClick={() => setMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={clsx(
          'min-h-dvh transition-all duration-300 flex flex-col relative z-10',
          'ml-0', sidebarCollapsed ? 'md:ml-16' : 'md:ml-60',
        )}
      >
        <TopBar title={title} onMenuClick={() => setMobileNavOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-6">
          <AnimatePresence mode="wait">
            <PageTransition key={location.pathname}>
              <ErrorBoundary scope={location.pathname}>
                <Outlet />
              </ErrorBoundary>
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      <BottomTabBar role={role} onMore={() => setMobileNavOpen(true)} />

      <NotificationToasts />
    </div>
  )
}
