import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CaretDown, CaretRight, DownloadSimple } from '@phosphor-icons/react'
import { getAuditLog, type RfqAuditEntry } from '../../../api/rfq.api'
import { Skeleton } from '../../../components/ui/Skeleton'
import { Button } from '../../../components/ui/Button'
import { formatDateTime } from '../../../utils/format'
import { cn } from '../../../utils/cn'

interface AuditLogTabProps {
  rfqId: string
}

export function AuditLogTab({ rfqId }: AuditLogTabProps) {
  const [page, setPage] = useState(1)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['rfq-audit', rfqId, page],
    queryFn: () => getAuditLog(rfqId, { page: String(page), limit: '50' }),
  })

  function handleExportJson() {
    if (!data?.entries) return
    const blob = new Blob([JSON.stringify(data.entries, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-log-${rfqId.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={48} borderRadius={6} />
        ))}
      </div>
    )
  }

  const entries = data?.entries ?? []
  const total = data?.total ?? 0

  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-text-secondary text-sm">
        No audit entries recorded yet.
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-text-secondary">{total} event{total !== 1 ? 's' : ''} recorded</p>
        <Button variant="secondary" size="sm" onClick={handleExportJson}>
          <DownloadSimple size={16} className="mr-1" /> Export JSON
        </Button>
      </div>

      <div className="border border-grey-200 rounded-DEFAULT overflow-hidden divide-y divide-grey-100">
        {entries.map((entry) => (
          <AuditRow
            key={entry.id}
            entry={entry}
            isExpanded={expandedId === entry.id}
            onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
          />
        ))}
      </div>

      {total > 50 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-text-secondary">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page * 50 >= total}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

function AuditRow({ entry, isExpanded, onToggle }: {
  entry: RfqAuditEntry
  isExpanded: boolean
  onToggle: () => void
}) {
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-bg-subtle transition-colors"
      >
        <div className="flex-shrink-0 text-text-secondary">
          {isExpanded ? <CaretDown size={14} /> : <CaretRight size={14} />}
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-4">
          <span className={cn(
            'px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider',
            getEventColor(entry.event_type),
          )}>
            {entry.event_type}
          </span>
          <span className="text-xs text-text-secondary">
            {entry.actor_type}{entry.actor_code ? ` (${entry.actor_code})` : ''}
          </span>
        </div>
        <span className="text-xs text-text-secondary flex-shrink-0">
          {formatDateTime(entry.created_at)}
        </span>
      </button>
      {isExpanded && (
        <div className="px-4 pb-3">
          <pre
            className="text-xs rounded-lg p-3 overflow-x-auto font-mono"
            style={{ background: '#1E1E2E', color: '#CDD6F4' }}
            dangerouslySetInnerHTML={{ __html: highlightJson(entry.event_data) }}
          />
          <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
            <span>ID: <span className="font-mono">{entry.id.slice(0, 8)}</span></span>
            <span>Hash: <span className="font-mono">{entry.event_hash.slice(0, 12)}</span></span>
          </div>
        </div>
      )}
    </div>
  )
}

function highlightJson(data: unknown): string {
  const json = JSON.stringify(data, null, 2)
  return json.replace(
    /("(?:[^"\\]|\\.)*")\s*:/g,
    '<span style="color:#79B8FF">$1</span>:',
  ).replace(
    /:\s*("(?:[^"\\]|\\.)*")/g,
    (_match, val) => `: <span style="color:#9ECE6A">${val}</span>`,
  ).replace(
    /:\s*(\d+\.?\d*)/g,
    ': <span style="color:#FF9E64">$1</span>',
  ).replace(
    /:\s*(true|false|null)/g,
    ': <span style="color:#BB9AF7">$1</span>',
  )
}

function getEventColor(eventType: string): string {
  if (eventType.includes('CREATED') || eventType.includes('PUBLISHED')) return 'bg-blue-light text-blue'
  if (eventType.includes('BID')) return 'bg-green-light text-green'
  if (eventType.includes('CLOSED') || eventType.includes('EXPIRED')) return 'bg-bg-subtle text-grey-600'
  if (eventType.includes('AWARDED')) return 'bg-[#EDE7F6] text-[#5E35B1]'
  if (eventType.includes('FLAG') || eventType.includes('WARNING')) return 'bg-yellow-light text-yellow'
  return 'bg-bg-subtle text-text-secondary'
}
