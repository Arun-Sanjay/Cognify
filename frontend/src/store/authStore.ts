import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'

const STORAGE_KEY = 'cognify-auth'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null

  // Selectors
  isAuthenticated: () => boolean
  role: () => User['role'] | null

  // Actions
  setSession: (payload: { user: User; token: string }) => void
  setLoading: (isLoading: boolean) => void
  setError: (error: string | null) => void
  logout: () => void
  updateUser: (user: User) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      isAuthenticated: () => !!get().token && !!get().user,
      role: () => get().user?.role ?? null,

      setSession: ({ user, token }) => set({ user, token, error: null }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error, isLoading: false }),
      logout: () => set({ user: null, token: null, error: null, isLoading: false }),
      updateUser: (user) => set({ user }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
)
