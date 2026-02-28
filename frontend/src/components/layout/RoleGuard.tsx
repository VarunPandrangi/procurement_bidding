import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, type UserRole } from '../../store/authStore'

interface RoleGuardProps {
  allowedRoles: UserRole[]
  children: React.ReactNode
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ allowedRoles, children }) => {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to their respective dashboard
    switch (user.role) {
      case 'ADMIN':
        return <Navigate to="/admin" replace />
      case 'BUYER':
        return <Navigate to="/buyer" replace />
      case 'SUPPLIER':
        return <Navigate to="/supplier" replace />
      default:
        return <Navigate to="/login" replace />
    }
  }

  return <>{children}</>
}
