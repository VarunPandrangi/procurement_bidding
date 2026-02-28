import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAuthStore } from './authStore'
import type { User } from './authStore'

// Mock the auth API to prevent actual HTTP calls during logout test
vi.mock('../api/auth.api', () => ({
  logoutApi: vi.fn(() => Promise.resolve()),
}))

const mockUser: User = {
  id: '123',
  email: 'buyer@test.com',
  full_name: 'Test Buyer',
  role: 'BUYER',
  company_name: 'Test Corp',
  supplier_code: null,
}

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      accessToken: null,
      isAuthenticated: false,
    })
  })

  it('login sets user, accessToken, and isAuthenticated', () => {
    useAuthStore.getState().login(mockUser, 'tok_abc')

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.accessToken).toBe('tok_abc')
    expect(state.isAuthenticated).toBe(true)
  })

  it('setAccessToken updates only the token', () => {
    useAuthStore.getState().login(mockUser, 'tok_old')
    useAuthStore.getState().setAccessToken('tok_new')

    const state = useAuthStore.getState()
    expect(state.accessToken).toBe('tok_new')
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('logout clears user, token, and isAuthenticated', () => {
    useAuthStore.getState().login(mockUser, 'tok_abc')
    useAuthStore.getState().logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setUser sets user and isAuthenticated', () => {
    useAuthStore.getState().setUser(mockUser)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.isAuthenticated).toBe(true)
  })

  it('setUser(null) clears user and isAuthenticated', () => {
    useAuthStore.getState().login(mockUser, 'tok_abc')
    useAuthStore.getState().setUser(null)

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('initial state is unauthenticated', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.accessToken).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })
})
