import { useEffect, useState } from 'react'

/**
 * Subscribe to a CSS media query. SSR-safe (defaults to false until the
 * browser is available). Used for the handful of layout decisions that can't
 * be pure CSS — the mobile nav drawer, gating proctored quizzes to laptop,
 * and Monaco / ScoreRing sizing.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  )

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches)
    setMatches(mql.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** True on phone-sized viewports (below Tailwind's `md` breakpoint, < 768px). */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
