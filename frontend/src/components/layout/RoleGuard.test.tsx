import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RoleGuard } from './RoleGuard'
import { useAuthStore } from '../../store/authStore'

describe('RoleGuard', () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('redirects to login if not authenticated', () => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/protected"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <div>Protected Content</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Login Page')).toBeInTheDocument()
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument()
  })

  it('renders children if authenticated and role is allowed', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'admin@test.com', full_name: 'Admin User', role: 'ADMIN' },
      isAuthenticated: true,
    })

    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route
            path="/protected"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <div>Protected Content</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Protected Content')).toBeInTheDocument()
  })

  it('redirects to correct dashboard if role is not allowed', () => {
    useAuthStore.setState({
      user: { id: '1', email: 'buyer@test.com', full_name: 'Buyer User', role: 'BUYER' },
      isAuthenticated: true,
    })

    render(
      <MemoryRouter initialEntries={['/admin-only']}>
        <Routes>
          <Route path="/buyer" element={<div>Buyer Dashboard</div>} />
          <Route
            path="/admin-only"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <div>Admin Content</div>
              </RoleGuard>
            }
          />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Buyer Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Admin Content')).not.toBeInTheDocument()
  })
})
