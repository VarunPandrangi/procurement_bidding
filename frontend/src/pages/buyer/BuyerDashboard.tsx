import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ChartBar,
  Gavel,
  CalendarBlank,
  TrendDown,
  Buildings,
  ArrowRight,
  ClipboardText,
  Clock,
} from '@phosphor-icons/react'
import { getBuyerRfqs, getBuyerKpis } from '../../api/rfq.api'
import { useAuthStore } from '../../store/authStore'
import { Badge } from '../../components/ui/Badge'
import { Skeleton } from '../../components/ui/Skeleton'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import { getGreeting, formatDateTime, formatRelativeTime, formatNumber } from '../../utils/format'

function StatCard({ label, value, icon: Icon, iconColor, isLoading }: {
  label: string
  value: number | string
  icon: React.ElementType
  iconColor?: string
  isLoading: boolean
}) {
  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <Icon size={20} className={iconColor ?? 'text-text-secondary'} aria-hidden="true" />
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

const STATUS_STEPS = ['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'AWARDED'] as const

function StatusProgressBar({ status }: { status: string }) {
  const currentIdx = STATUS_STEPS.indexOf(status as typeof STATUS_STEPS[number])
  const progress = currentIdx >= 0 ? ((currentIdx + 1) / STATUS_STEPS.length) * 100 : 0
  const color = status === 'ACTIVE' ? 'bg-blue' : status === 'CLOSED' ? 'bg-grey-400' : status === 'AWARDED' ? 'bg-green' : 'bg-blue'
  return (
    <div className="h-1 w-full bg-grey-100 rounded-full overflow-hidden mt-3">
      <div className={`h-full ${color} rounded-full transition-all duration-300`} style={{ width: `${progress}%` }} />
    </div>
  )
}

export function BuyerDashboard() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const firstName = user?.full_name?.split(' ')[0] || 'there'

  const { data: rfqs, isLoading: rfqsLoading } = useQuery({
    queryKey: ['buyer-rfqs'],
    queryFn: () => getBuyerRfqs(),
  })

  const { data: kpis, isLoading: kpisLoading } = useQuery({
    queryKey: ['buyer-kpis'],
    queryFn: () => getBuyerKpis(),
  })

  const isLoading = rfqsLoading || kpisLoading

  const stats = useMemo(() => {
    const list = rfqs ?? []
    const now = new Date()
    const thisMonth = list.filter((r) => {
      const d = new Date(r.created_at)
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }).length
    return {
      active: list.filter((r) => r.status === 'ACTIVE').length,
      pendingAward: list.filter((r) => r.status === 'CLOSED').length,
      thisMonth,
      savings: kpis?.savings_pct != null ? `${formatNumber(kpis.savings_pct, 1)}%` : '--',
    }
  }, [rfqs, kpis])

  const recentRfqs = useMemo(() => {
    if (!rfqs) return []
    return [...rfqs]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 5)
  }, [rfqs])

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">
          {getGreeting()}, {firstName}
        </h1>
        <p className="text-sm text-text-secondary mt-1">
          Here's what needs your attention
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Active Enquiries" value={stats.active} icon={ChartBar} iconColor="text-blue" isLoading={isLoading} />
        <StatCard label="Pending Award" value={stats.pendingAward} icon={Gavel} iconColor="text-yellow" isLoading={isLoading} />
        <StatCard label="Enquiries This Month" value={stats.thisMonth} icon={CalendarBlank} iconColor="text-grey-400" isLoading={isLoading} />
        <StatCard label="Avg Savings" value={stats.savings} icon={TrendDown} iconColor="text-green" isLoading={isLoading} />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-grey-200">
          <h2 className="text-base font-semibold text-text-primary">Recent Enquiries</h2>
          <Link to="/buyer/rfqs" className="text-sm font-medium text-blue hover:text-blue-hover transition-colors flex items-center gap-1">
            View all <ArrowRight size={14} />
          </Link>
        </div>

        {rfqsLoading ? (
          <div className="p-6 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton width={200} height={16} />
                <Skeleton width={80} height={20} borderRadius={999} />
                <Skeleton width={100} height={14} />
              </div>
            ))}
          </div>
        ) : recentRfqs.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <ClipboardText size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" />
            <p className="text-base font-medium text-grey-800">No enquiries yet</p>
            <p className="text-sm text-text-secondary mt-1">Create your first enquiry to get started.</p>
          </div>
        ) : (
          <div className="divide-y divide-grey-100">
            {recentRfqs.map((rfq) => (
              <div
                key={rfq.id}
                onClick={() => navigate(`/buyer/rfqs/${rfq.id}`)}
                className="px-6 py-4 hover:bg-bg-subtle transition-all duration-200 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs text-text-secondary">{rfq.rfq_number}</span>
                    <Badge variant={rfq.status} />
                  </div>
                  {rfq.status === 'ACTIVE' && rfq.bid_close_at && (
                    <CountdownTimer targetDate={rfq.bid_close_at} size="sm" />
                  )}
                </div>
                <p className="text-[17px] font-semibold text-text-primary mb-2">{rfq.title}</p>
                <div className="flex items-center gap-4 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <Buildings size={14} /> {rfq.supplier_count} supplier{rfq.supplier_count !== 1 ? 's' : ''}
                  </span>
                  <BidCloseContext status={rfq.status} bidCloseAt={rfq.bid_close_at} bidOpenAt={rfq.bid_open_at} />
                </div>
                <StatusProgressBar status={rfq.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BidCloseContext({ status, bidCloseAt, bidOpenAt }: {
  status: string
  bidCloseAt: string | null
  bidOpenAt: string | null
}) {
  if (status === 'ACTIVE' && bidCloseAt) {
    const isExpired = new Date(bidCloseAt) <= new Date()
    if (isExpired) {
      return <span className="text-yellow flex items-center gap-1"><Clock size={14} /> Closing...</span>
    }
    return (
      <span className="flex items-center gap-1">
        <Clock size={14} /> Closes {formatRelativeTime(bidCloseAt)}
      </span>
    )
  }
  if (status === 'PUBLISHED' && bidOpenAt) {
    return <span>Opens {formatDateTime(bidOpenAt)}</span>
  }
  if ((status === 'CLOSED' || status === 'AWARDED') && bidCloseAt) {
    return <span>Closed {formatRelativeTime(bidCloseAt)}</span>
  }
  return null
}
