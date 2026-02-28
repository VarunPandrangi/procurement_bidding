import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  ChartBar,
  ClipboardText,
  Buildings,
  Users,
  Gear,
  SignOut,
  List,
  X,
  Package,
  Plus,
  TrendUp,
} from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import { useAuthStore, type UserRole } from '../../store/authStore'
import { Badge } from '../ui/Badge'
import { cn } from '../../utils/cn'

// ─── Brand Mark ──────────────────────────────────────
function BrandMark({ size = 'default' }: { size?: 'default' | 'large' }) {
  const h = size === 'large' ? 'h-[36px]' : 'h-[24px]'
  const barH = size === 'large' ? 'h-[4px]' : 'h-[3px]'
  return (
    <div className={cn('flex flex-col justify-center gap-[3px]', h)}>
      <div className={cn(barH, 'w-full rounded-full bg-blue')} />
      <div className={cn(barH, 'w-[80%] rounded-full bg-blue opacity-60')} />
      <div className={cn(barH, 'w-[60%] rounded-full bg-blue opacity-30')} />
    </div>
  )
}

export { BrandMark }

// ─── Nav Item Config ─────────────────────────────────
interface NavItem {
  label: string
  path: string
  icon: Icon
}

interface NavSection {
  label?: string
  items: NavItem[]
}

const adminNav: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/admin', icon: ChartBar },
    ],
  },
  {
    label: 'Management',
    items: [
      { label: 'Users', path: '/admin/users', icon: Users },
      { label: 'Suppliers', path: '/admin/suppliers', icon: Buildings },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Audit Log', path: '/admin/audit', icon: ClipboardText },
      { label: 'Configuration', path: '/admin/config', icon: Gear },
    ],
  },
]

const buyerNav: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { label: 'Dashboard', path: '/buyer', icon: ChartBar },
    ],
  },
  {
    label: 'Procurement',
    items: [
      { label: 'Enquiries', path: '/buyer/rfqs', icon: ClipboardText },
      { label: 'New Enquiry', path: '/buyer/rfqs/new', icon: Plus },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { label: 'KPI Dashboard', path: '/buyer/kpis', icon: TrendUp },
    ],
  },
]

const supplierNav: NavSection[] = [
  {
    items: [
      { label: 'My Enquiries', path: '/supplier', icon: Package },
    ],
  },
]

const navByRole: Record<UserRole, NavSection[]> = {
  ADMIN: adminNav,
  BUYER: buyerNav,
  SUPPLIER: supplierNav,
}

// ─── Sidebar Component ──────────────────────────────
export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  if (!user) return null

  const sections = navByRole[user.role]

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const isActive = (path: string) => {
    if (path === '/admin' || path === '/buyer' || path === '/supplier') {
      return location.pathname === path
    }
    return location.pathname.startsWith(path)
  }

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Brand */}
      <div className="flex items-center gap-2.5 h-16 px-5 shrink-0">
        <div className="w-5">
          <BrandMark />
        </div>
        <span className="text-[18px] font-bold text-text-primary tracking-tight">
          ProcureX
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section, si) => (
          <div key={si}>
            {section.label && (
              <div
                className={cn(
                  'px-5 text-[10px] font-semibold uppercase tracking-[0.10em] text-grey-400',
                  si === 0 ? 'pt-3 pb-1.5' : 'pt-5 pb-1.5'
                )}
              >
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const active = isActive(item.path)
              const IconComponent = item.icon
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    'relative flex items-center gap-2.5 mx-2 px-3 h-10 rounded-DEFAULT text-sm font-medium transition-colors duration-[120ms] ease-out',
                    active
                      ? 'bg-blue-light text-blue'
                      : 'text-grey-700 hover:bg-bg-subtle hover:text-text-primary'
                  )}
                >
                  {active && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue rounded-r" />
                  )}
                  <IconComponent
                    size={20}
                    weight={active ? 'fill' : 'regular'}
                    aria-hidden="true"
                  />
                  {item.label}
                </NavLink>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="border-t border-grey-200 px-4 py-3 mt-auto shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-blue flex items-center justify-center shrink-0">
            <span className="text-[13px] font-bold text-white">
              {getInitials(user.full_name)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-text-primary truncate">
              {user.full_name}
            </div>
            <Badge variant={user.role === 'ADMIN' ? 'ACTIVE' : user.role === 'BUYER' ? 'PUBLISHED' : 'PENDING'} className="mt-0.5 text-[9px] px-1.5 py-0">
              {user.role}
            </Badge>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-DEFAULT text-grey-600 hover:text-red transition-colors duration-150"
            title="Sign out"
            aria-label="Sign out"
          >
            <SignOut size={20} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile Hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 p-2 rounded-DEFAULT bg-white border border-grey-200 shadow-card md:hidden"
        aria-label="Open navigation"
      >
        <List size={24} aria-hidden="true" />
      </button>

      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 w-64 h-screen bg-white border-r border-grey-200 transition-transform duration-300 ease-out md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          onClick={() => setMobileOpen(false)}
          className="absolute top-4 right-4 p-1.5 rounded-DEFAULT text-grey-600 hover:text-text-primary transition-colors"
          aria-label="Close navigation"
        >
          <X size={20} aria-hidden="true" />
        </button>
        {sidebarContent}
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className="hidden md:block fixed top-0 left-0 w-64 h-screen bg-white border-r border-grey-200 z-30"
        data-sidebar
      >
        {sidebarContent}
      </aside>
    </>
  )
}
