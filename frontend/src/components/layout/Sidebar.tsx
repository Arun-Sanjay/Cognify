import { NavLink, useNavigate } from 'react-router-dom'
import { clsx } from 'clsx'
import { Zap, Settings, ChevronLeft, ChevronRight, LogOut, X } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { navByRole, type Role } from './navConfig'

export interface SidebarProps {
  role?: Role
  collapsed: boolean
  onToggle: () => void
  /** Mobile drawer open state (lifted to AppLayout). */
  mobileOpen?: boolean
  onMobileClose?: () => void
  user?: { name?: string; email?: string }
}

export default function Sidebar({
  role = 'student',
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
  user,
}: SidebarProps) {
  const navigation = navByRole[role] || navByRole.student
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  // The drawer always shows full labels on mobile; `collapsed` is desktop-only.
  const expanded = mobileOpen || !collapsed

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-dvh z-50 flex flex-col transition-all duration-300 pt-safe',
        'bg-[var(--bg-sidebar)] border-r border-[var(--sidebar-border)]',
        // Full-width drawer on mobile; collapsible rail on desktop.
        'w-60', collapsed ? 'md:w-16' : 'md:w-60',
        // Off-canvas below md, always docked at md+.
        mobileOpen ? 'translate-x-0' : '-translate-x-full', 'md:translate-x-0',
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--sidebar-border)] shrink-0">
        <div className="h-8 w-8 rounded-lg bg-white flex items-center justify-center shrink-0">
          <Zap className="h-4 w-4 text-black" />
        </div>
        {expanded && (
          <span className="font-bold text-lg tracking-tight text-[var(--sidebar-text-active)]">Cognify</span>
        )}
        {/* desktop collapse toggle */}
        <button
          onClick={onToggle}
          className="hidden md:flex ml-auto p-1 text-[var(--text-tertiary)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)] rounded-md transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
        {/* mobile drawer close */}
        <button
          onClick={onMobileClose}
          className="md:hidden ml-auto tap-target flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)] rounded-md transition-colors"
          aria-label="Close navigation"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scroll-touch py-3 px-2 space-y-5">
        {navigation.map((section) => (
          <div key={section.group}>
            {expanded && (
              <div className="text-[11px] font-medium uppercase tracking-wider text-[var(--text-tertiary)] px-2 mb-2">
                {section.group}
              </div>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 rounded-lg transition-all duration-150 min-h-[44px]',
                      expanded ? 'px-3 py-2' : 'justify-center p-2.5',
                      isActive
                        ? 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-active)] font-medium'
                        : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]',
                    )
                  }
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {expanded && <span className="text-sm truncate">{item.label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="border-t border-[var(--sidebar-border)] p-2 space-y-1 shrink-0 pb-safe">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            clsx(
              'flex items-center gap-3 rounded-lg transition-colors min-h-[44px]',
              expanded ? 'px-3 py-2' : 'justify-center p-2.5',
              isActive
                ? 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-active)]'
                : 'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]',
            )
          }
        >
          <Settings className="h-[18px] w-[18px] shrink-0" />
          {expanded && <span className="text-sm font-medium">Settings</span>}
        </NavLink>

        <button
          onClick={handleLogout}
          className={clsx(
            'w-full flex items-center gap-3 rounded-lg transition-colors min-h-[44px]',
            expanded ? 'px-3 py-2' : 'justify-center p-2.5',
            'text-[var(--sidebar-text)] hover:text-[var(--sidebar-text-active)] hover:bg-[var(--sidebar-hover)]',
          )}
          title="Log out"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {expanded && <span className="text-sm font-medium">Log Out</span>}
        </button>

        <div className={clsx('flex items-center gap-3 rounded-lg p-2', !expanded && 'justify-center')}>
          <div className="h-7 w-7 rounded-full bg-[var(--sidebar-active)] text-[var(--sidebar-text)] font-semibold flex items-center justify-center shrink-0 text-xs">
            {(user?.name || 'U').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
          </div>
          {expanded && (
            <div className="min-w-0">
              <div className="text-sm font-medium text-[var(--sidebar-text-active)] truncate">
                {user?.name || 'User'}
              </div>
              <div className="text-xs text-[var(--text-tertiary)] capitalize">{role}</div>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
