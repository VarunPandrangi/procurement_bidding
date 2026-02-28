import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  ChartBar,
  Buildings,
  ClipboardText,
  UserPlus,
  Gear,
  ArrowRight,
} from '@phosphor-icons/react'
import { getAdminUsers } from '../../api/admin.api'
import { getAdminAuditLog } from '../../api/admin.api'
import { getAdminSuppliers } from '../../api/admin.api'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'

// ─── Stat Card ──────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  isLoading,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  isLoading: boolean
}) {
  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <Icon size={20} className="text-text-secondary" aria-hidden="true" />
      </div>
      {isLoading ? (
        <Skeleton width={80} height={36} borderRadius={6} />
      ) : (
        <div className="font-mono text-2xl font-bold text-text-primary tracking-tight">
          {value}
        </div>
      )}
    </div>
  )
}

// ─── Quick Action Row ───────────────────────────────
function QuickAction({
  label,
  icon: Icon,
  to,
}: {
  label: string
  icon: React.ElementType
  to: string
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 h-10 px-4 -mx-4 rounded-DEFAULT text-sm text-text-primary hover:bg-bg-subtle transition-colors group"
    >
      <Icon size={20} className="text-text-secondary" aria-hidden="true" />
      <span className="flex-1">{label}</span>
      <ArrowRight
        size={16}
        className="text-grey-400 group-hover:text-text-secondary transition-colors"
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── Format helpers ─────────────────────────────────
function formatFullDate(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate().toString().padStart(2, '0')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[d.getMonth()]
  const year = d.getFullYear()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  return `${day} ${mon} ${year} · ${hh}:${mm}`
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max) + '...'
}

// ─── Admin Dashboard ────────────────────────────────
export function AdminDashboard() {
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  })

  const { data: auditData, isLoading: auditLoading } = useQuery({
    queryKey: ['admin-audit-recent'],
    queryFn: () => getAdminAuditLog({ limit: 10, sort: 'desc' }),
  })

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: ['admin-suppliers'],
    queryFn: getAdminSuppliers,
  })

  const isLoading = usersLoading || auditLoading || suppliersLoading

  // Compute stats
  const totalUsers = users?.length ?? 0
  const activeSuppliers = suppliers?.filter((s) => s.is_active).length ?? 0

  // Count active enquiries - derive from audit or use a separate call
  // For now we use the users count and placeholder
  const activeEnquiries = useMemo(() => {
    // We don't have a direct RFQ list API for admin, so show '—' or use audit data
    return '—'
  }, [])

  const eventsToday = useMemo(() => {
    if (!auditData?.entries) return 0
    const today = new Date().toISOString().slice(0, 10)
    return auditData.entries.filter((e) => e.created_at.slice(0, 10) === today).length
  }, [auditData])

  // RFQ status breakdown from audit data
  const statusBreakdown = useMemo(() => {
    // Placeholder - in a real app you'd have a dedicated endpoint
    const statuses: { label: string; count: number; color: string; variant: BadgeVariant }[] = [
      { label: 'Draft', count: 0, color: 'bg-grey-400', variant: 'DRAFT' },
      { label: 'Published', count: 0, color: 'bg-blue', variant: 'PUBLISHED' },
      { label: 'Active', count: 0, color: 'bg-green', variant: 'ACTIVE' },
      { label: 'Closed', count: 0, color: 'bg-grey-600', variant: 'CLOSED' },
      { label: 'Awarded', count: 0, color: 'bg-[#7C3AED]', variant: 'AWARDED' },
    ]
    return statuses
  }, [])

  const maxStatusCount = Math.max(...statusBreakdown.map((s) => s.count), 1)

  const auditEntries = auditData?.entries ?? []

  return (
    <div>
      {/* Heading */}
      <div className="mb-7">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Platform Overview</h1>
        <p className="text-sm text-text-secondary mt-1">{formatFullDate(new Date())}</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Users" value={totalUsers} icon={Users} isLoading={isLoading} />
        <StatCard label="Active Enquiries" value={activeEnquiries} icon={ChartBar} isLoading={isLoading} />
        <StatCard label="Registered Suppliers" value={activeSuppliers} icon={Buildings} isLoading={isLoading} />
        <StatCard label="Events Today" value={eventsToday} icon={ClipboardText} isLoading={isLoading} />
      </div>

      {/* Two-Column Layout */}
      <div className="flex flex-col lg:flex-row gap-5">
        {/* LEFT: Recent Activity */}
        <div className="flex-1 bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-grey-200">
            <h2 className="text-base font-semibold text-text-primary">Recent Activity</h2>
            <Link to="/admin/audit" className="text-sm font-medium text-blue hover:text-blue-hover transition-colors">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-subtle border-b border-grey-200">
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Timestamp</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Event</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actor</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Summary</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-grey-100 last:border-0">
                      <td className="px-5 py-3.5"><Skeleton width={120} height={14} /></td>
                      <td className="px-5 py-3.5"><Skeleton width={80} height={20} borderRadius={999} /></td>
                      <td className="px-5 py-3.5"><Skeleton width={90} height={14} /></td>
                      <td className="px-5 py-3.5"><Skeleton width={180} height={14} /></td>
                    </tr>
                  ))
                ) : auditEntries.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-12 text-center">
                      <ClipboardText size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" aria-hidden="true" />
                      <p className="text-base font-medium text-grey-800">No audit events</p>
                      <p className="text-sm text-text-secondary mt-1">Activity on the platform will be recorded here.</p>
                    </td>
                  </tr>
                ) : (
                  auditEntries.map((entry) => (
                    <tr key={entry.id} className="border-b border-grey-100 last:border-0 hover:bg-bg-subtle transition-colors">
                      <td className="px-5 py-3.5 font-mono text-xs text-text-secondary whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-light text-blue">
                          {entry.event_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary">
                        {entry.actor_email || entry.actor_role || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-text-secondary">
                        {truncate(JSON.stringify(entry.event_data), 50)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* RIGHT: Status Breakdown + Quick Actions */}
        <div className="w-full lg:w-[380px] flex flex-col gap-5 shrink-0">
          {/* Status Breakdown */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
            <h2 className="text-base font-semibold text-text-primary mb-5">Enquiry Status Breakdown</h2>
            <div className="flex flex-col gap-3">
              {statusBreakdown.map((status) => (
                <div key={status.label} className="flex items-center gap-3">
                  <Badge variant={status.variant} className="w-[90px] text-center text-[9px]">
                    {status.label}
                  </Badge>
                  <div className="flex-1 h-1.5 bg-grey-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${status.color} transition-all duration-500`}
                      style={{ width: `${(status.count / maxStatusCount) * 100}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm font-medium text-text-primary w-8 text-right">
                    {status.count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
            <h2 className="text-base font-semibold text-text-primary mb-4">Quick Actions</h2>
            <div className="flex flex-col gap-0.5">
              <QuickAction label="Create User" icon={UserPlus} to="/admin/users" />
              <QuickAction label="Onboard Supplier" icon={Buildings} to="/admin/suppliers" />
              <QuickAction label="View Audit Log" icon={ClipboardText} to="/admin/audit" />
              <QuickAction label="System Configuration" icon={Gear} to="/admin/config" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
