import { useState, useMemo, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ClipboardText,
  CaretDown,
  CaretRight,
  Export,
  Funnel,
} from '@phosphor-icons/react'
import {
  getAdminAuditLog,
  type AuditLogEntry,
  type AuditLogParams,
} from '../../api/admin.api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'

// ─── Event Type Options ─────────────────────────────
const eventTypeOptions = [
  { value: '', label: 'All Events' },
  { value: 'RFQ_CREATED', label: 'RFQ Created' },
  { value: 'RFQ_PUBLISHED', label: 'RFQ Published' },
  { value: 'RFQ_CLOSED', label: 'RFQ Closed' },
  { value: 'RFQ_AWARDED', label: 'RFQ Awarded' },
  { value: 'RFQ_EXTENDED', label: 'RFQ Extended' },
  { value: 'BID_SUBMITTED', label: 'Bid Submitted' },
  { value: 'BID_REVISED', label: 'Bid Revised' },
  { value: 'BID_WITHDRAWN', label: 'Bid Withdrawn' },
  { value: 'USER_LOGIN', label: 'User Login' },
  { value: 'USER_CREATED', label: 'User Created' },
  { value: 'USER_DEACTIVATED', label: 'User Deactivated' },
  { value: 'USER_REACTIVATED', label: 'User Reactivated' },
  { value: 'SUPPLIER_ONBOARDED', label: 'Supplier Onboarded' },
  { value: 'CONFIG_UPDATED', label: 'Config Updated' },
  { value: 'ADMIN_OVERRIDE', label: 'Admin Override' },
]

// ─── JSON Syntax Highlighting ───────────────────────
function JsonViewer({ data }: { data: Record<string, unknown> }) {
  const colorize = useCallback((value: unknown, indent: number): JSX.Element[] => {
    const elements: JSX.Element[] = []
    const pad = '  '.repeat(indent)

    if (value === null || value === undefined) {
      elements.push(
        <span key={Math.random()} className="text-[#BB9AF7]">null</span>
      )
    } else if (typeof value === 'boolean') {
      elements.push(
        <span key={Math.random()} className="text-[#BB9AF7]">{String(value)}</span>
      )
    } else if (typeof value === 'number') {
      elements.push(
        <span key={Math.random()} className="text-[#FF9E64]">{String(value)}</span>
      )
    } else if (typeof value === 'string') {
      elements.push(
        <span key={Math.random()} className="text-[#9ECE6A]">"{value}"</span>
      )
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        elements.push(<span key={Math.random()}>{'[]'}</span>)
      } else {
        elements.push(<span key={Math.random()}>{'[\n'}</span>)
        value.forEach((item, i) => {
          elements.push(<span key={Math.random()}>{pad}  </span>)
          elements.push(...colorize(item, indent + 1))
          if (i < value.length - 1) elements.push(<span key={Math.random()}>,</span>)
          elements.push(<span key={Math.random()}>{'\n'}</span>)
        })
        elements.push(<span key={Math.random()}>{pad}{']'}</span>)
      }
    } else if (typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>)
      if (entries.length === 0) {
        elements.push(<span key={Math.random()}>{'{}'}</span>)
      } else {
        elements.push(<span key={Math.random()}>{'{\n'}</span>)
        entries.forEach(([k, v], i) => {
          elements.push(<span key={Math.random()}>{pad}  </span>)
          elements.push(
            <span key={Math.random()} className="text-[#79B8FF]">"{k}"</span>
          )
          elements.push(<span key={Math.random()}>: </span>)
          elements.push(...colorize(v, indent + 1))
          if (i < entries.length - 1) elements.push(<span key={Math.random()}>,</span>)
          elements.push(<span key={Math.random()}>{'\n'}</span>)
        })
        elements.push(<span key={Math.random()}>{pad}{'}'}</span>)
      }
    }

    return elements
  }, [])

  return (
    <pre className="bg-[#1E1E2E] text-[#CDD6F4] rounded-lg p-4 text-xs font-mono overflow-x-auto leading-relaxed whitespace-pre">
      {colorize(data, 0)}
    </pre>
  )
}

// ─── Format helpers ─────────────────────────────────
function formatTimestamp(iso: string): string {
  const d = new Date(iso)
  const day = d.getDate().toString().padStart(2, '0')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const mon = months[d.getMonth()]
  const year = d.getFullYear()
  const hh = d.getHours().toString().padStart(2, '0')
  const mm = d.getMinutes().toString().padStart(2, '0')
  const ss = d.getSeconds().toString().padStart(2, '0')
  return `${day} ${mon} ${year} · ${hh}:${mm}:${ss}`
}

function truncateJson(data: Record<string, unknown>, max: number): string {
  const str = JSON.stringify(data)
  if (str.length <= max) return str
  return str.slice(0, max) + '...'
}

// ─── Audit Log Page ─────────────────────────────────
export function AuditLog() {
  // Filter state
  const [filters, setFilters] = useState<AuditLogParams>({
    page: 1,
    limit: 25,
    sort: 'desc',
  })
  const [draftFilters, setDraftFilters] = useState({
    event_type: '',
    rfq_id: '',
    from: '',
    to: '',
  })

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  // Data
  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit', filters],
    queryFn: () => getAdminAuditLog(filters),
  })

  const entries = data?.entries ?? []
  const total = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / (filters.limit ?? 25)))

  // Toggle row
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Apply filters
  const handleApplyFilters = () => {
    const applied: AuditLogParams = {
      page: 1,
      limit: filters.limit,
      sort: filters.sort,
    }
    if (draftFilters.event_type) applied.event_type = draftFilters.event_type
    if (draftFilters.rfq_id) applied.rfq_id = draftFilters.rfq_id
    if (draftFilters.from) applied.from = draftFilters.from
    if (draftFilters.to) applied.to = draftFilters.to
    setFilters(applied)
    setExpandedRows(new Set())
  }

  const handleClearFilters = () => {
    setDraftFilters({ event_type: '', rfq_id: '', from: '', to: '' })
    setFilters({ page: 1, limit: 25, sort: 'desc' })
    setExpandedRows(new Set())
  }

  const hasActiveFilters = useMemo(() => {
    return !!(draftFilters.event_type || draftFilters.rfq_id || draftFilters.from || draftFilters.to)
  }, [draftFilters])

  // Export
  const handleExport = () => {
    if (!entries.length) return
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Pagination
  const handlePageChange = (page: number) => {
    setFilters((prev) => ({ ...prev, page }))
    setExpandedRows(new Set())
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-text-primary tracking-tight">Audit Log</h1>
        <Button variant="secondary" onClick={handleExport} disabled={entries.length === 0}>
          <Export size={18} weight="bold" aria-hidden="true" />
          Export JSON
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-4 mb-4">
        <div className="flex flex-col gap-3">
          {/* Row 1: Date range + Event Type */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                label="From"
                type="date"
                value={draftFilters.from}
                onChange={(e) => setDraftFilters({ ...draftFilters, from: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <Input
                label="To"
                type="date"
                value={draftFilters.to}
                onChange={(e) => setDraftFilters({ ...draftFilters, to: e.target.value })}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Event Type"
                options={eventTypeOptions}
                value={draftFilters.event_type}
                onChange={(val) => setDraftFilters({ ...draftFilters, event_type: val })}
                placeholder="All Events"
              />
            </div>
          </div>

          {/* Row 2: RFQ ID + Actions */}
          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1">
              <Input
                label="RFQ ID"
                placeholder="Filter by RFQ ID..."
                value={draftFilters.rfq_id}
                onChange={(e) => setDraftFilters({ ...draftFilters, rfq_id: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleApplyFilters}>
                <Funnel size={16} weight="bold" aria-hidden="true" />
                Apply Filters
              </Button>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="text-sm font-medium text-blue hover:text-blue-hover transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-subtle border-b border-grey-200">
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-8" />
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Event</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Actor</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">RFQ</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Summary</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-grey-100 last:border-0">
                    <td className="px-5 py-3.5"><Skeleton width={16} height={16} borderRadius={4} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={140} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={100} height={20} borderRadius={999} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={100} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={60} height={14} /></td>
                    <td className="px-5 py-3.5"><Skeleton width={200} height={14} /></td>
                  </tr>
                ))
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <ClipboardText size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" aria-hidden="true" />
                    <p className="text-base font-medium text-grey-800">No audit entries found</p>
                    <p className="text-sm text-text-secondary mt-1">
                      {hasActiveFilters ? 'Try adjusting your filters.' : 'Platform activity will appear here.'}
                    </p>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const isExpanded = expandedRows.has(entry.id)
                  return (
                    <AuditRow
                      key={entry.id}
                      entry={entry}
                      isExpanded={isExpanded}
                      onToggle={() => toggleRow(entry.id)}
                    />
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-grey-200 bg-bg-subtle">
            <span className="text-sm text-text-secondary">
              Showing {((filters.page ?? 1) - 1) * (filters.limit ?? 25) + 1}–
              {Math.min((filters.page ?? 1) * (filters.limit ?? 25), total)} of {total}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange((filters.page ?? 1) - 1)}
                disabled={(filters.page ?? 1) <= 1}
                className="px-3 py-1.5 text-sm font-medium rounded-DEFAULT border border-grey-200 bg-white text-text-primary hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                const currentPage = filters.page ?? 1
                let pageNum: number
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-8 h-8 text-sm font-medium rounded-DEFAULT transition-colors ${
                      pageNum === currentPage
                        ? 'bg-blue text-white'
                        : 'border border-grey-200 bg-white text-text-primary hover:bg-bg-subtle'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
              <button
                onClick={() => handlePageChange((filters.page ?? 1) + 1)}
                disabled={(filters.page ?? 1) >= totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-DEFAULT border border-grey-200 bg-white text-text-primary hover:bg-bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Audit Row ──────────────────────────────────────
function AuditRow({
  entry,
  isExpanded,
  onToggle,
}: {
  entry: AuditLogEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <>
      <tr
        className="border-b border-grey-100 last:border-0 hover:bg-bg-subtle transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className="px-5 py-3.5">
          {isExpanded ? (
            <CaretDown size={14} className="text-text-secondary" aria-hidden="true" />
          ) : (
            <CaretRight size={14} className="text-text-secondary" aria-hidden="true" />
          )}
        </td>
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
        <td className="px-5 py-3.5">
          {entry.rfq_id ? (
            <span className="font-mono text-sm text-grey-700 bg-bg-subtle px-2 py-0.5 rounded">
              {entry.rfq_id.slice(0, 8)}
            </span>
          ) : (
            <span className="text-sm text-grey-400">—</span>
          )}
        </td>
        <td className="px-5 py-3.5 text-sm text-text-secondary max-w-[300px] truncate">
          {truncateJson(entry.event_data, 60)}
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-grey-100 last:border-0">
          <td colSpan={6} className="px-5 py-4 bg-[#F8F8FA]">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-4 text-xs text-text-secondary">
                <span>
                  <span className="font-medium text-text-primary">Hash:</span>{' '}
                  <span className="font-mono">{entry.entry_hash.slice(0, 16)}...</span>
                </span>
                <span>
                  <span className="font-medium text-text-primary">Previous:</span>{' '}
                  <span className="font-mono">{entry.previous_hash.slice(0, 16)}...</span>
                </span>
              </div>
              <JsonViewer data={entry.event_data} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
