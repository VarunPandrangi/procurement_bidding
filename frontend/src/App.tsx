import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastContainer } from './components/ui/Toast'
import { RoleGuard } from './components/layout/RoleGuard'
import { AppShell } from './components/layout/AppShell'
import { useAuthStore } from './store/authStore'

// ─── Lazy-loaded pages (route-level code splitting) ─────────
const LoginPage = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })))
const TokenLandingPage = lazy(() => import('./pages/auth/TokenLandingPage').then(m => ({ default: m.TokenLandingPage })))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then(m => ({ default: m.NotFoundPage })))

// Admin
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const UserManagement = lazy(() => import('./pages/admin/UserManagement').then(m => ({ default: m.UserManagement })))
const SupplierDirectory = lazy(() => import('./pages/admin/SupplierDirectory').then(m => ({ default: m.SupplierDirectory })))
const AuditLog = lazy(() => import('./pages/admin/AuditLog').then(m => ({ default: m.AuditLog })))
const SystemConfiguration = lazy(() => import('./pages/admin/SystemConfig').then(m => ({ default: m.SystemConfiguration })))

// Buyer
const BuyerDashboard = lazy(() => import('./pages/buyer/BuyerDashboard').then(m => ({ default: m.BuyerDashboard })))
const RfqList = lazy(() => import('./pages/buyer/RfqList').then(m => ({ default: m.RfqList })))
const RfqCreate = lazy(() => import('./pages/buyer/RfqCreate').then(m => ({ default: m.RfqCreate })))
const RfqDetail = lazy(() => import('./pages/buyer/RfqDetail').then(m => ({ default: m.RfqDetail })))
const AwardSimulation = lazy(() => import('./pages/buyer/AwardSimulation').then(m => ({ default: m.AwardSimulation })))
const AwardFinalization = lazy(() => import('./pages/buyer/AwardFinalization').then(m => ({ default: m.AwardFinalization })))
const KpiDashboard = lazy(() => import('./pages/buyer/KpiDashboard').then(m => ({ default: m.KpiDashboard })))

// Supplier
const SupplierDashboard = lazy(() => import('./pages/supplier/SupplierDashboard').then(m => ({ default: m.SupplierDashboard })))
const RfqViewPage = lazy(() => import('./pages/supplier/RfqViewPage').then(m => ({ default: m.RfqViewPage })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

// ─── Loading Fallback ────────────────────────────────
function PageLoader() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )
}

// ─── Root Redirect ──────────────────────────────────
function RootRedirect() {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/access/:token" element={<TokenLandingPage />} />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <RoleGuard allowedRoles={['ADMIN']}>
                <AppShell />
              </RoleGuard>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<UserManagement />} />
            <Route path="suppliers" element={<SupplierDirectory />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="config" element={<SystemConfiguration />} />
          </Route>

          {/* Buyer */}
          <Route
            path="/buyer"
            element={
              <RoleGuard allowedRoles={['BUYER']}>
                <AppShell />
              </RoleGuard>
            }
          >
            <Route index element={<BuyerDashboard />} />
            <Route path="rfqs" element={<RfqList />} />
            <Route path="rfqs/new" element={<RfqCreate />} />
            <Route path="rfqs/:id" element={<RfqDetail />} />
            <Route path="rfqs/:id/simulate" element={<AwardSimulation />} />
            <Route path="rfqs/:id/award" element={<AwardFinalization />} />
            <Route path="kpis" element={<KpiDashboard />} />
          </Route>

          {/* Supplier */}
          <Route
            path="/supplier"
            element={
              <RoleGuard allowedRoles={['SUPPLIER']}>
                <AppShell />
              </RoleGuard>
            }
          >
            <Route index element={<SupplierDashboard />} />
            <Route path="rfqs/:id" element={<RfqViewPage />} />
          </Route>

          {/* Root redirect */}
          <Route path="/" element={<RootRedirect />} />

          {/* 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </Suspense>
        <ToastContainer />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
