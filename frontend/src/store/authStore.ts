import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { logoutApi } from '../api/auth.api'

export type UserRole = 'ADMIN' | 'BUYER' | 'SUPPLIER'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  company_name?: string | null
  supplier_code?: string | null
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  login: (user: User, token: string) => void
  setAccessToken: (token: string) => void
  setUser: (user: User | null) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      login: (user, token) =>
        set({ user, accessToken: token, isAuthenticated: true }),
      setAccessToken: (token) =>
        set({ accessToken: token }),
      setUser: (user) =>
        set({ user, isAuthenticated: !!user }),
      logout: () => {
        logoutApi() // fire-and-forget
        set({ user: null, accessToken: null, isAuthenticated: false })
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)
