import { NavLink, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { MoreHorizontal } from 'lucide-react'
import { primaryNavByRole, type Role } from './navConfig'

export interface BottomTabBarProps {
  role: Role
  /** Open the full nav drawer. */
  onMore: () => void
}

const itemClass =
  'flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] py-1.5 text-[10px] font-medium transition-colors'

/**
 * Thumb-reachable bottom navigation, mobile only (`md:hidden`). Shows the 4
 * primary destinations for the role plus a "More" button that opens the full
 * Sidebar drawer. Desktop keeps the static sidebar rail (this isn't rendered).
 */
export default function BottomTabBar({ role, onMore }: BottomTabBarProps) {
  const tabs = primaryNavByRole[role] || primaryNavByRole.student
  const location = useLocation()

  // "More" lights up whenever the active route isn't one of the 4 primaries.
  const onPrimary = tabs.some((t) =>
    t.end ? location.pathname === t.to : location.pathname.startsWith(t.to),
  )

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 flex items-stretch border-t pb-safe"
      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}
    >
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={itemClass}
          style={({ isActive }) => ({
            color: isActive ? 'var(--text-primary)' : 'var(--text-tertiary)',
          })}
        >
          <tab.icon className="h-5 w-5" />
          <span className="truncate max-w-full px-0.5">{tab.label}</span>
        </NavLink>
      ))}
      <button
        type="button"
        onClick={onMore}
        className={itemClass}
        style={{ color: onPrimary ? 'var(--text-tertiary)' : 'var(--text-primary)' }}
        aria-label="More navigation"
      >
        <MoreHorizontal className="h-5 w-5" />
        <span>More</span>
      </button>
    </nav>
  )
}
