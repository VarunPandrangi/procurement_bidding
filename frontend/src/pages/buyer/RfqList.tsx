import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus,
  MagnifyingGlass,
  ClipboardText,
  ArrowRight,
} from '@phosphor-icons/react'
import { getBuyerRfqs } from '../../api/rfq.api'
import { Badge, type BadgeVariant } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import { formatDateTime, formatRelativeTime } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_TABS = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PUBLISHED', label: 'Published' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'CLOSED', label: 'Closed' },
  { key: 'AWARDED', label: 'Awarded' },
] as const

export function RfqList() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('ALL')
  const [search, setSearch] = useState('')

  const { data: rfqs, isLoading } = useQuery({
    queryKey: ['buyer-rfqs'],
    queryFn: () => getBuyerRfqs(),
  })

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0 }
    ;(rfqs ?? []).forEach((r) => {
      counts.ALL = (counts.ALL || 0) + 1
      counts[r.status] = (counts[r.status] || 0) + 1
    })
    return counts
  }, [rfqs])

  const filtered = useMemo(() => {
    let list = rfqs ?? []
    if (activeTab !== 'ALL') {
      list = list.filter((r) => r.status === activeTab)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.rfq_number.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  }, [rfqs, activeTab, search])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Enquiries</h1>
        <Button onClick={() => navigate('/buyer/rfqs/new')}>
          <Plus size={16} weight="bold" className="mr-1.5" />
          New Enquiry
        </Button>
      </div>

      <div className="flex items-center gap-1 mb-4 border-b border-grey-200">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-3 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab.key
                ? 'border-blue text-blue'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {tab.label}
            {!isLoading && (statusCounts[tab.key] ?? 0) > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-light text-blue">
                {statusCounts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
        <input
          type="text"
          placeholder="Search by title or enquiry number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-9 pl-9 pr-3 rounded-DEFAULT border border-grey-200 bg-white text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
        />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-subtle border-b border-grey-200">
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Enquiry</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Suppliers</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Bid Closes</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Created</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-grey-100 last:border-0">
                    <td className="px-5 py-3.5"><Skeleton width={180} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={80} height={20} borderRadius={999} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={40} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={120} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={100} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={16} height={16} /></td>
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <ClipboardText size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" />
                    <p className="text-base font-medium text-grey-800">No enquiries found</p>
                    <p className="text-sm text-text-secondary mt-1">
                      {search ? 'Try adjusting your search.' : 'Create your first enquiry to get started.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((rfq) => (
                  <tr
                    key={rfq.id}
                    onClick={() => navigate(`/buyer/rfqs/${rfq.id}`)}
                    className="border-b border-grey-100 last:border-0 hover:bg-bg-subtle transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3.5">
                      <span className="font-mono text-xs text-text-secondary">{rfq.rfq_number}</span>
                      <p className="text-sm font-medium text-text-primary mt-0.5 truncate max-w-[240px]">{rfq.title}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={rfq.status as BadgeVariant} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-2">
                          {Array.from({ length: Math.min(rfq.supplier_count, 3) }).map((_, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full bg-grey-200 border-2 border-white flex items-center justify-center"
                            >
                              <span className="text-[9px] font-semibold text-grey-500">S{i + 1}</span>
                            </div>
                          ))}
                          {rfq.supplier_count > 3 && (
                            <div className="w-6 h-6 rounded-full bg-grey-100 border-2 border-white flex items-center justify-center">
                              <span className="text-[9px] font-semibold text-grey-500">+{rfq.supplier_count - 3}</span>
                            </div>
                          )}
                        </div>
                        <span className="text-sm text-text-secondary">{rfq.supplier_count} invited</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-text-secondary whitespace-nowrap">
                      {rfq.status === 'ACTIVE' && rfq.bid_close_at ? (
                        <CountdownTimer targetDate={rfq.bid_close_at} size="sm" />
                      ) : rfq.bid_close_at ? (
                        formatDateTime(rfq.bid_close_at)
                      ) : (
                        '--'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-text-secondary whitespace-nowrap">
                      {formatRelativeTime(rfq.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <ArrowRight size={16} className="text-grey-400" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
