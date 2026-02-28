import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  DownloadSimple,
  Package,
} from '@phosphor-icons/react'
import { getSupplierRfqs, type SupplierRfqSummary } from '../../api/supplier.api'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../utils/cn'
import { formatRelativeTime, formatDateTime } from '../../utils/format'

// ─── Helpers ─────────────────────────────────────────
function isWindowOpen(rfq: SupplierRfqSummary): boolean {
  if (rfq.status !== 'ACTIVE') return false
  const now = Date.now()
  const open = rfq.bid_open_at ? new Date(rfq.bid_open_at).getTime() : 0
  const close = rfq.bid_close_at ? new Date(rfq.bid_close_at).getTime() : Infinity
  return now >= open && now < close
}

function getTimeContext(rfq: SupplierRfqSummary): {
  text: string
  color: string
} {
  if (rfq.status === 'ACTIVE' && isWindowOpen(rfq)) {
    return {
      text: `Bid window open · closes ${formatRelativeTime(rfq.bid_close_at!)}`,
      color: 'text-green',
    }
  }
  if (rfq.status === 'ACTIVE' && rfq.bid_open_at) {
    return {
      text: `Opens ${formatDateTime(rfq.bid_open_at)}`,
      color: 'text-text-secondary',
    }
  }
  if (rfq.status === 'PUBLISHED') {
    return { text: 'Awaiting bid window', color: 'text-text-secondary' }
  }
  if (rfq.status === 'CLOSED' || rfq.status === 'AWARDED') {
    return {
      text: `Closed ${rfq.bid_close_at ? formatRelativeTime(rfq.bid_close_at) : ''}`,
      color: 'text-text-tertiary',
    }
  }
  return { text: '', color: '' }
}

// ─── Card Component ──────────────────────────────────
function RfqCard({ rfq }: { rfq: SupplierRfqSummary }) {
  const navigate = useNavigate()
  const windowOpen = isWindowOpen(rfq)
  const timeCtx = getTimeContext(rfq)

  const goToRfq = () => navigate(`/supplier/rfqs/${rfq.id}`)

  const renderCta = () => {
    // Declined — disabled ghost
    if (rfq.supplier_status === 'DECLINED') {
      return (
        <Button variant="ghost" size="lg" disabled className="w-full opacity-50">
          Declined
        </Button>
      )
    }

    // Pending — review & respond
    if (rfq.supplier_status === 'PENDING') {
      return (
        <Button variant="primary" size="lg" onClick={goToRfq} className="w-full">
          Review & Respond
        </Button>
      )
    }

    // Closed / Awarded — download receipt
    if (rfq.status === 'CLOSED' || rfq.status === 'AWARDED') {
      return (
        <Button variant="secondary" size="lg" onClick={goToRfq} className="w-full">
          <DownloadSimple size={18} weight="bold" />
          Download Receipt
        </Button>
      )
    }

    // Accepted + window open — Bid Now (urgent pulsing glow)
    if (rfq.supplier_status === 'ACCEPTED' && windowOpen) {
      return (
        <Button
          variant="primary"
          size="lg"
          onClick={goToRfq}
          className="w-full animate-[glowPulse_2s_ease-in-out_infinite]"
        >
          Bid Now
          <ArrowRight size={18} weight="bold" />
        </Button>
      )
    }

    // Accepted + window not open — view details
    return (
      <Button variant="secondary" size="lg" onClick={goToRfq} className="w-full">
        View Details
      </Button>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-grey-200 rounded-[12px] overflow-hidden">
      {/* Top section */}
      <div className="px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-text-secondary">{rfq.rfq_number}</span>
          <Badge variant={rfq.supplier_status}>{rfq.supplier_status}</Badge>
        </div>
        <h3 className="text-base font-semibold text-text-primary mt-1 line-clamp-2">
          {rfq.title}
        </h3>
        {rfq.buyer_company && (
          <p className="text-[13px] text-text-secondary mt-0.5">{rfq.buyer_company}</p>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-grey-200" />

      {/* Middle section */}
      <div className="px-5 py-3 bg-[#FAFAFA]">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={rfq.status}>{rfq.status}</Badge>
        </div>
        {timeCtx.text && (
          <div className={cn('flex items-center gap-1.5 mt-2 text-[13px]', timeCtx.color)}>
            <Clock size={14} weight="regular" className="flex-shrink-0" />
            <span>{timeCtx.text}</span>
          </div>
        )}
      </div>

      {/* Bottom section — CTA */}
      <div className="px-5 py-3">
        {renderCta()}
      </div>
    </div>
  )
}

// ─── Loading Skeleton ────────────────────────────────
function CardSkeleton() {
  return (
    <div className="bg-white shadow-sm border border-grey-200 rounded-[12px] overflow-hidden">
      <div className="px-5 py-4 space-y-2">
        <Skeleton width={100} height={14} />
        <Skeleton width="80%" height={18} />
        <Skeleton width={120} height={13} />
      </div>
      <div className="h-px bg-grey-200" />
      <div className="px-5 py-3 bg-[#FAFAFA] space-y-2">
        <Skeleton width={60} height={20} borderRadius={999} />
        <Skeleton width="60%" height={13} />
      </div>
      <div className="px-5 py-3">
        <Skeleton width="100%" height={44} borderRadius={8} />
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────
export function SupplierDashboard() {
  const { data: rfqs, isLoading, error } = useQuery({
    queryKey: ['supplier-rfqs'],
    queryFn: getSupplierRfqs,
  })

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-text-primary tracking-tight mb-6">
        My Enquiries
      </h1>

      {/* Loading */}
      {isLoading && (
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-DEFAULT border border-red-light bg-red-light/30 p-4 text-sm text-red">
          Failed to load enquiries. Please try again.
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && rfqs?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-subtle flex items-center justify-center mb-4">
            <Package size={32} weight="duotone" className="text-text-tertiary" />
          </div>
          <h2 className="text-base font-semibold text-text-primary mb-1">No enquiries assigned</h2>
          <p className="text-sm text-text-secondary max-w-[280px]">
            You will receive an access link when a buyer invites you to participate.
          </p>
        </div>
      )}

      {/* Cards */}
      {!isLoading && rfqs && rfqs.length > 0 && (
        <div className="flex flex-col gap-4">
          {rfqs.map((rfq) => (
            <RfqCard key={rfq.id} rfq={rfq} />
          ))}
        </div>
      )}
    </div>
  )
}
