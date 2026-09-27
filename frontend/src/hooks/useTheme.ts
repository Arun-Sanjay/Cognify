import { create } from 'zustand'
import type { Theme } from '../types'

// `nebula` is first → it's what the cycle button advances to from `dark`,
// and it's the implicit default for first-time visitors (see getInitialTheme).
const THEMES: Theme[] = ['nebula', 'light', 'dark']

// Any leftover stored value from when premium / aurora / luxury existed gets
// silently swapped for the default on the next page load.
const LEGACY_THEMES = ['premium', 'aurora', 'luxury']

interface ThemeMeta {
  label: string
  icon: string
}

const THEME_META: Record<Theme, ThemeMeta> = {
  nebula: { label: 'Nebula', icon: 'Sparkles' },
  light: { label: 'Light', icon: 'Sun' },
  dark: { label: 'Dark', icon: 'Moon' },
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'nebula'
  const stored = localStorage.getItem('cognify-theme') as Theme | null
  if (stored && THEMES.includes(stored)) return stored
  // No stored preference → land on Nebula (the signature theme). Users can
  // still pick Light or Dark via the topbar cycle.
  return 'nebula'
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement
  // Clear current + legacy classes so a user upgrading from a stale localStorage
  // entry doesn't keep an .aurora / .luxury / etc. class hanging around.
  for (const t of [...THEMES, ...LEGACY_THEMES]) root.classList.remove(t)
  if (theme !== 'light') root.classList.add(theme)
}

interface ThemeStore {
  theme: Theme
  cycle: () => void
  setTheme: (theme: Theme) => void
}

const useThemeStore = create<ThemeStore>((set) => ({
  theme: getInitialTheme(),
  cycle: () =>
    set((state) => {
      const idx = THEMES.indexOf(state.theme)
      const next = THEMES[(idx + 1) % THEMES.length]!
      localStorage.setItem('cognify-theme', next)
      applyTheme(next)
      return { theme: next }
    }),
  setTheme: (theme) => {
    localStorage.setItem('cognify-theme', theme)
    applyTheme(theme)
    set({ theme })
  },
}))

if (typeof window !== 'undefined') {
  applyTheme(getInitialTheme())
}

interface UseThemeReturn {
  theme: Theme
  cycle: () => void
  setTheme: (theme: Theme) => void
  themes: Theme[]
  meta: Record<Theme, ThemeMeta>
}

export const useTheme = (): UseThemeReturn => {
  const theme = useThemeStore((s) => s.theme)
  const cycle = useThemeStore((s) => s.cycle)
  const setTheme = useThemeStore((s) => s.setTheme)
  return { theme, cycle, setTheme, themes: THEMES, meta: THEME_META }
}
