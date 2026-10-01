import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'

const STORAGE_PREFIX = 'cognify-learn-done:'

function read(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

/**
 * Per-user "lecture completed" ticks, kept in localStorage (a per-device
 * convenience — move to the backend once progress needs to sync).
 */
export function useLearnProgress() {
  const userId = useAuthStore((s) => s.user?.id ?? 'anon')
  const key = `${STORAGE_PREFIX}${userId}`
  const [done, setDone] = useState<Set<string>>(() => read(key))

  useEffect(() => {
    setDone(read(key))
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) setDone(read(key))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [key])

  const toggle = useCallback(
    (lectureId: string, value?: boolean) => {
      setDone((prev) => {
        const next = new Set(prev)
        const shouldAdd = value ?? !next.has(lectureId)
        if (shouldAdd) next.add(lectureId)
        else next.delete(lectureId)
        try {
          localStorage.setItem(key, JSON.stringify([...next]))
        } catch {
          // storage full / blocked — keep the in-memory state
        }
        return next
      })
    },
    [key],
  )

  return { done, isDone: (id: string) => done.has(id), toggle }
}

export type LanguagePreference = 'hinglish' | 'english' | 'both'

const LANGUAGE_KEY = 'cognify-learn-language'

/** Which lecture language the course outline and prev/next follow (per device). */
export function useLearnLanguage() {
  const [language, setLanguageState] = useState<LanguagePreference>(() => {
    try {
      const saved = localStorage.getItem(LANGUAGE_KEY)
      return saved === 'hinglish' || saved === 'english' ? saved : 'both'
    } catch {
      return 'both'
    }
  })

  const setLanguage = useCallback((value: LanguagePreference) => {
    setLanguageState(value)
    try {
      localStorage.setItem(LANGUAGE_KEY, value)
    } catch {
      // ignore
    }
  }, [])

  return { language, setLanguage }
}
