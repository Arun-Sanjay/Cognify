import { LayoutDashboard, Sparkles, Library, Users, Bell } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Role = 'student' | 'teacher' | 'admin'

export interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  /** Match the route exactly (used for index routes like `/student`). */
  end?: boolean
}

export interface NavSection {
  group: string
  items: NavItem[]
}

// Add a route in `src/routes/AppRouter.tsx`, then list it here so it shows up
// in the role's sidebar (and gets its TopBar title).
const studentNav: NavSection[] = [
  {
    group: 'LEARN',
    items: [
      { to: '/student', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/student/assistant', icon: Sparkles, label: 'AI Assistant' },
      { to: '/student/library', icon: Library, label: 'Library' },
    ],
  },
]

const teacherNav: NavSection[] = [
  {
    group: 'DASHBOARD',
    items: [
      { to: '/teacher', icon: LayoutDashboard, label: 'Overview', end: true },
      { to: '/teacher/assistant', icon: Sparkles, label: 'AI Assistant' },
    ],
  },
  {
    group: 'CONTENT',
    items: [{ to: '/teacher/library', icon: Library, label: 'Library' }],
  },
]

const adminNav: NavSection[] = [
  {
    group: 'DASHBOARD',
    items: [
      { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
      { to: '/admin/library', icon: Library, label: 'Library' },
      { to: '/admin/assistant', icon: Sparkles, label: 'AI Assistant' },
    ],
  },
  {
    group: 'PLATFORM',
    items: [
      { to: '/admin/users', icon: Users, label: 'User Management' },
      { to: '/admin/notifications', icon: Bell, label: 'Notification Status' },
    ],
  },
]

export const navByRole: Record<Role, NavSection[]> = {
  student: studentNav,
  teacher: teacherNav,
  admin: adminNav,
}

/**
 * Up to 4 thumb-reachable destinations shown in the mobile bottom tab bar per
 * role. Short labels so they fit a tab. A "More" entry is added by
 * BottomTabBar to open the full nav drawer.
 */
export const primaryNavByRole: Record<Role, NavItem[]> = {
  student: [
    { to: '/student', icon: LayoutDashboard, label: 'Home', end: true },
    { to: '/student/assistant', icon: Sparkles, label: 'Assistant' },
    { to: '/student/library', icon: Library, label: 'Library' },
  ],
  teacher: [
    { to: '/teacher', icon: LayoutDashboard, label: 'Home', end: true },
    { to: '/teacher/assistant', icon: Sparkles, label: 'Assistant' },
    { to: '/teacher/library', icon: Library, label: 'Library' },
  ],
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Home', end: true },
    { to: '/admin/library', icon: Library, label: 'Library' },
    { to: '/admin/users', icon: Users, label: 'Users' },
  ],
}

/** TopBar title for a path, derived from the nav so they never drift. */
export function titleForPath(pathname: string): string | undefined {
  for (const sections of Object.values(navByRole)) {
    for (const section of sections) {
      const hit = section.items.find((item) => item.to === pathname)
      if (hit) return hit.label
    }
  }
  return undefined
}
