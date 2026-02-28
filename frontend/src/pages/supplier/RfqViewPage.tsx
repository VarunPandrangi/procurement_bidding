import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowLeft,
  ArrowRight,
  CalendarBlank,
  Lightning,
  LockSimple,
  ShieldCheck,
  DownloadSimple,
  Clock,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  getSupplierRfq,
  getSupplierRanking,
  getBidStatus,
  submitBid,
  reviseBid,
  downloadReceipt,
  type SupplierRfqDetail,
  type SupplierRanking,
  type BidStatus,
} from '../../api/supplier.api'
import { useWebSocket } from '../../hooks/useWebSocket'
import { useToast } from '../../store/toastStore'
import { RankDisplayWidget } from '../../components/ui/RankDisplayWidget'
import { CountdownTimer } from '../../components/ui/CountdownTimer'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { cn } from '../../utils/cn'
import { formatCurrency, formatDateTime, formatRelativeTime } from '../../utils/format'
import { DeclarationModal } from './DeclarationModal'
import { DeclineModal } from './DeclineModal'
import { acceptRfq, declineRfq } from '../../api/supplier.api'

// ─── View State Enum ─────────────────────────────────
type ViewState =
  | 'PENDING'
  | 'ACCEPTED_WAITING'
  | 'ACCEPTED_BIDDING'
  | 'BID_SUBMITTED'
  | 'CLOSED'
  | 'DECLINED'
  | 'LOADING'

// ─── Zod Schema for Bid Form ─────────────────────────
const bidItemSchema = z.object({
  rfq_item_id: z.string(),
  description: z.string(),
  uom: z.string(),
  quantity: z.number(),
  unit_price: z
    .number({ invalid_type_error: 'Price required' })
    .positive('Must be > 0'),
})

const bidFormSchema = z.object({
  items: z.array(bidItemSchema),
})

type BidFormData = z.infer<typeof bidFormSchema>

// ─── Helpers ─────────────────────────────────────────
function deriveViewState(
  rfq: SupplierRfqDetail | undefined,
  bidStatus: BidStatus | null,
  forceClosed: boolean,
): ViewState {
  if (!rfq) return 'LOADING'
  if (forceClosed || rfq.status === 'CLOSED' || rfq.status === 'AWARDED') return 'CLOSED'
  if (rfq.supplier_status === 'DECLINED') return 'DECLINED'
  if (rfq.supplier_status === 'PENDING') return 'PENDING'

  // Accepted
  const now = Date.now()
  const open = rfq.bidding_rules.bid_open_at
    ? new Date(rfq.bidding_rules.bid_open_at).getTime()
    : 0
  const close = rfq.bidding_rules.bid_close_at
    ? new Date(rfq.bidding_rules.bid_close_at).getTime()
    : Infinity

  if (now < open) return 'ACCEPTED_WAITING'

  const windowOpen = now >= open && now < close

  if (windowOpen && bidStatus && bidStatus.revision_number >= 1) return 'BID_SUBMITTED'
  if (windowOpen) return 'ACCEPTED_BIDDING'

  return 'CLOSED'
}

// ─── Sub-components ──────────────────────────────────

function ConnectionIndicator({ isConnected, isReconnecting }: { isConnected: boolean; isReconnecting: boolean }) {
  if (isReconnecting) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-yellow" />
        <span className="text-xs text-[#B45309]">Reconnecting</span>
      </div>
    )
  }
  if (isConnected) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
        <span className="text-xs text-[#1A9E3F]">Live</span>
      </div>
    )
  }
  return null
}

function EnquiryDetailsCard({ rfq }: { rfq: SupplierRfqDetail }) {
  const [expandedSpec, setExpandedSpec] = useState<string | null>(null)
  const commercialTermLabels: Record<string, string> = {
    payment_terms: 'Payment Terms',
    freight_terms: 'Freight Terms',
    delivery_lead_time: 'Delivery Lead Time',
    taxes_duties: 'Taxes & Duties',
    warranty: 'Warranty / Guarantee',
    offer_validity: 'Offer Validity',
    packing_forwarding: 'Packing & Forwarding',
    special_conditions: 'Special Conditions',
  }

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-grey-200">
        <h2 className="text-md font-semibold text-text-primary">Enquiry Details</h2>
      </div>

      {/* Items table — horizontally scrollable on mobile */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-grey-200 bg-bg-subtle">
              <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-10 sticky left-0 bg-bg-subtle z-10">
                #
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-text-secondary sticky left-10 bg-bg-subtle z-10">
                Description
              </th>
              <th className="text-left px-4 py-2.5 font-medium text-text-secondary">Spec</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-16">UOM</th>
              <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-20">Qty</th>
              <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-24 text-text-tertiary italic">
                You will fill this
              </th>
              <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-16 text-text-tertiary italic">
                Auto
              </th>
            </tr>
          </thead>
          <tbody>
            {rfq.items.map((item, i) => (
              <tr key={item.id} className="border-b border-grey-100 last:border-0">
                <td className="px-4 py-2.5 text-text-secondary font-mono text-xs sticky left-0 bg-white z-10">
                  {i + 1}
                </td>
                <td className="px-4 py-2.5 text-text-primary sticky left-10 bg-white z-10">
                  {item.description}
                </td>
                <td className="px-4 py-2.5 text-text-secondary">
                  {item.specification ? (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSpec(expandedSpec === item.id ? null : item.id)
                      }
                      className="text-blue text-xs hover:underline"
                    >
                      {expandedSpec === item.id ? 'Hide' : 'View'}
                    </button>
                  ) : (
                    <span className="text-text-tertiary">—</span>
                  )}
                  {expandedSpec === item.id && item.specification && (
                    <p className="mt-1 text-xs text-text-secondary whitespace-pre-wrap">
                      {item.specification}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">
                  {item.uom}
                </td>
                <td className="px-4 py-2.5 text-right text-text-primary font-mono text-xs">
                  {item.quantity}
                </td>
                <td className="px-4 py-2.5 text-right text-text-tertiary text-xs">—</td>
                <td className="px-4 py-2.5 text-right text-text-tertiary text-xs">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Commercial terms */}
      <div className="px-5 py-4 border-t border-grey-200">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Commercial Terms</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {Object.entries(rfq.commercial_terms).map(([key, value]) => (
            <div key={key} className="flex flex-col">
              <dt className="text-[13px] text-text-secondary">
                {commercialTermLabels[key] || key.replace(/_/g, ' ')}
              </dt>
              <dd className="text-[13px] text-text-primary font-medium">{value || '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Bidding rules summary */}
      <div className="px-5 py-4 border-t border-grey-200">
        <h3 className="text-sm font-semibold text-text-primary mb-2">Bidding Rules</h3>
        <ul className="text-[13px] text-text-secondary space-y-1">
          <li>Maximum {rfq.bidding_rules.max_revisions} revisions allowed</li>
          <li>
            Each revision must change by at least{' '}
            {rfq.bidding_rules.min_change_percent}%
          </li>
          <li>
            {rfq.bidding_rules.cooling_time_minutes} minute
            {rfq.bidding_rules.cooling_time_minutes !== 1 ? 's' : ''} cooling period
            between revisions
          </li>
          <li>
            Anti-snipe: revisions in the last{' '}
            {rfq.bidding_rules.anti_snipe_window_minutes} minutes extend the
            deadline by {rfq.bidding_rules.anti_snipe_extension_minutes} minutes
          </li>
        </ul>
      </div>
    </div>
  )
}

// ─── Bid Entry Form ──────────────────────────────────
function BidEntryForm({
  rfq,
  onSubmitted,
}: {
  rfq: SupplierRfqDetail
  onSubmitted: () => void
}) {
  const { toast } = useToast()
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BidFormData>({
    resolver: zodResolver(bidFormSchema),
    defaultValues: {
      items: rfq.items.map((item) => ({
        rfq_item_id: item.id,
        description: item.description,
        uom: item.uom,
        quantity: item.quantity,
        unit_price: undefined as unknown as number,
      })),
    },
  })

  const watchedItems = watch('items')

  const grandTotal = useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      const total = (item.unit_price || 0) * item.quantity
      return sum + total
    }, 0)
  }, [watchedItems])

  const submitMutation = useMutation({
    mutationFn: (data: BidFormData) =>
      submitBid(
        rfq.id,
        data.items.map((i) => ({ rfq_item_id: i.rfq_item_id, unit_price: i.unit_price }))
      ),
    onSuccess: () => {
      toast.success('Bid submitted', 'Your prices have been recorded.')
      onSubmitted()
    },
    onError: () => {
      toast.error('Submission failed', 'Please check your inputs and try again.')
    },
  })

  const onValid = () => setShowConfirm(true)

  return (
    <>
      <div className="bg-white rounded-lg border border-grey-200 shadow-md overflow-hidden">
        <div className="px-5 py-4 border-b border-grey-200">
          <h2 className="text-md font-semibold text-text-primary">
            Your Price Submission
          </h2>
          <p className="text-[13px] text-text-secondary mt-0.5">
            Initial submission — you will have {rfq.bidding_rules.max_revisions}{' '}
            revisions after this
          </p>
        </div>

        <form onSubmit={handleSubmit(onValid)}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[540px] text-sm">
              <thead>
                <tr className="border-b border-grey-200 bg-bg-subtle">
                  <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-10 sticky left-0 bg-bg-subtle z-10">
                    #
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-secondary sticky left-10 bg-bg-subtle z-10">
                    Description
                  </th>
                  <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-16">
                    UOM
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-16">
                    Qty
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-[130px]">
                    Your Price
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-24">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {rfq.items.map((item, i) => {
                  const itemPrice = watchedItems[i]?.unit_price || 0
                  const lineTotal = itemPrice * item.quantity
                  const fieldError = errors.items?.[i]?.unit_price

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-grey-100 last:border-0"
                    >
                      <td className="px-4 py-2.5 text-text-secondary font-mono text-xs sticky left-0 bg-white z-10">
                        {i + 1}
                      </td>
                      <td className="px-4 py-2.5 text-text-primary text-[13px] sticky left-10 bg-white z-10">
                        {item.description}
                      </td>
                      <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">
                        {item.uom}
                      </td>
                      <td className="px-4 py-2.5 text-right text-text-primary font-mono text-xs">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary text-xs font-mono">
                            £
                          </span>
                          <input
                            type="number"
                            step="0.0001"
                            min="0"
                            placeholder="0.0000"
                            {...register(`items.${i}.unit_price`, {
                              valueAsNumber: true,
                            })}
                            className={cn(
                              'w-full pl-6 pr-2 py-2 text-right font-mono text-sm rounded-DEFAULT border transition-colors text-text-primary',
                              'focus:border-blue focus:ring-2 focus:ring-blue/20 focus:bg-[#F8FBFF] outline-none',
                              '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                              fieldError
                                ? 'border-red bg-red-light/20'
                                : 'border-grey-300'
                            )}
                            style={{ fontSize: '16px' }} // prevent iOS zoom
                          />
                        </div>
                        {fieldError && (
                          <p className="text-[11px] text-red mt-0.5 text-right">
                            {fieldError.message}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-sm text-text-primary">
                        {itemPrice > 0 ? formatCurrency(lineTotal) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-text-primary">
                  <td
                    colSpan={5}
                    className="px-4 pt-3 pb-2 text-sm font-semibold text-text-primary"
                  >
                    Grand Total
                  </td>
                  <td className="px-4 pt-3 pb-2 text-right font-mono text-lg font-bold text-text-primary">
                    {formatCurrency(grandTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-grey-200">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              isLoading={submitMutation.isPending}
            >
              Submit Bid
              <ArrowRight size={18} weight="bold" />
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Submit your bid?"
        message={`Grand total: ${formatCurrency(grandTotal)}`}
        detail={`After submitting, you will have ${rfq.bidding_rules.max_revisions} revisions available.`}
        confirmLabel="Submit bid"
        onConfirm={async () => {
          await handleSubmit((data) => submitMutation.mutateAsync(data))()
          setShowConfirm(false)
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  )
}

// ─── Revision Form ───────────────────────────────────
function RevisionForm({
  rfq,
  ranking,
  bidStatus,
  onRevised,
}: {
  rfq: SupplierRfqDetail
  ranking: SupplierRanking | null
  bidStatus: BidStatus
  onRevised: () => void
}) {
  const { toast } = useToast()
  const [coolingSeconds, setCoolingSeconds] = useState(bidStatus.cooling_seconds_remaining)
  const [minChangeErrors, setMinChangeErrors] = useState<Record<number, boolean>>({})

  // Sync cooling seconds from upstream
  useEffect(() => {
    setCoolingSeconds(bidStatus.cooling_seconds_remaining)
  }, [bidStatus.cooling_seconds_remaining])

  // Countdown timer for cooling
  useEffect(() => {
    if (coolingSeconds <= 0) return
    const id = setInterval(() => setCoolingSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [coolingSeconds > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const isCooling = coolingSeconds > 0
  const coolMm = Math.floor(coolingSeconds / 60).toString().padStart(2, '0')
  const coolSs = (coolingSeconds % 60).toString().padStart(2, '0')

  // Get current prices from ranking data
  const currentPrices = useMemo(() => {
    const map: Record<string, number> = {}
    if (ranking?.own_prices) {
      ranking.own_prices.forEach((p) => {
        map[p.rfq_item_id] = p.unit_price
      })
    }
    return map
  }, [ranking])

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BidFormData>({
    resolver: zodResolver(bidFormSchema),
    defaultValues: {
      items: rfq.items.map((item) => ({
        rfq_item_id: item.id,
        description: item.description,
        uom: item.uom,
        quantity: item.quantity,
        unit_price: currentPrices[item.id] ?? 0,
      })),
    },
  })

  const watchedItems = watch('items')

  const grandTotal = useMemo(() => {
    return watchedItems.reduce((sum, item) => {
      return sum + (item.unit_price || 0) * item.quantity
    }, 0)
  }, [watchedItems])

  const reviseMutation = useMutation({
    mutationFn: (data: BidFormData) =>
      reviseBid(
        rfq.id,
        data.items.map((i) => ({ rfq_item_id: i.rfq_item_id, unit_price: i.unit_price }))
      ),
    onSuccess: () => {
      toast.success('Revision submitted', 'Your revised prices have been recorded.')
      setMinChangeErrors({})
      onRevised()
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { code?: string; details?: Array<{ index: number }> } } }
      if (error?.response?.data?.code === 'MIN_CHANGE_NOT_MET') {
        toast.error('Minimum change requirement not met', 'Some items need a larger price change.')
        const errorIndices: Record<number, boolean> = {}
        error.response.data.details?.forEach((d) => {
          errorIndices[d.index] = true
        })
        setMinChangeErrors(errorIndices)
      } else if (error?.response?.data?.code === 'COOLING_TIME_ACTIVE') {
        toast.error('Cooling period active', 'Please wait before submitting another revision.')
        // Re-sync cooling from server
        setCoolingSeconds(rfq.bidding_rules.cooling_time_minutes * 60)
      } else {
        toast.error('Revision failed', 'Please check your inputs and try again.')
      }
    },
  })

  if (bidStatus.revisions_remaining <= 0) {
    return null
  }

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden relative">
      <div className="px-5 py-4 border-b border-grey-200 flex items-center justify-between">
        <h2 className="text-md font-semibold text-text-primary">Revise Your Prices</h2>
        <span className="text-sm text-text-secondary">
          Revision {bidStatus.revision_number + 1} of{' '}
          {bidStatus.revision_number + bidStatus.revisions_remaining}
        </span>
      </div>

      <form onSubmit={handleSubmit((data) => reviseMutation.mutate(data))}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="border-b border-grey-200 bg-bg-subtle">
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-10 sticky left-0 bg-bg-subtle z-10">
                  #
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary sticky left-10 bg-bg-subtle z-10">
                  Description
                </th>
                <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-16">
                  UOM
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-16">
                  Qty
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-[130px]">
                  Your Price
                </th>
                <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-24">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {rfq.items.map((item, i) => {
                const itemPrice = watchedItems[i]?.unit_price || 0
                const lineTotal = itemPrice * item.quantity
                const prevPrice = currentPrices[item.id]
                const hasChanged = prevPrice !== undefined && itemPrice !== prevPrice
                const fieldError = errors.items?.[i]?.unit_price
                const hasMinChangeError = minChangeErrors[i]

                return (
                  <tr
                    key={item.id}
                    className={cn(
                      'border-b border-grey-100 last:border-0 transition-colors',
                      hasMinChangeError && 'bg-[#FFF5F5] border-r-[3px] border-r-[#C0392B]'
                    )}
                  >
                    <td className="px-4 py-2.5 text-text-secondary font-mono text-xs sticky left-0 bg-white z-10">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2.5 text-text-primary text-[13px] sticky left-10 bg-white z-10">
                      {item.description}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">
                      {item.uom}
                    </td>
                    <td className="px-4 py-2.5 text-right text-text-primary font-mono text-xs">
                      {item.quantity}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-secondary text-xs font-mono">
                          £
                        </span>
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.0000"
                          {...register(`items.${i}.unit_price`, {
                            valueAsNumber: true,
                          })}
                          className={cn(
                            'w-full pl-6 pr-2 py-2 text-right font-mono text-sm rounded-DEFAULT border transition-colors text-text-primary',
                            'focus:border-blue focus:ring-2 focus:ring-blue/20 focus:bg-[#F8FBFF] outline-none',
                            '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                            hasChanged ? 'bg-[#FFFDE7]' : '',
                            fieldError || hasMinChangeError
                              ? 'border-red'
                              : 'border-grey-300'
                          )}
                          style={{ fontSize: '16px' }}
                        />
                      </div>
                      {hasChanged && prevPrice !== undefined && (
                        <p className="text-[11px] font-mono text-text-secondary mt-0.5 text-right">
                          Was: £{prevPrice.toFixed(4)}
                        </p>
                      )}
                      {hasMinChangeError && (
                        <p className="text-[11px] text-[#C0392B] mt-0.5 text-right flex items-center justify-end gap-0.5">
                          <WarningCircle size={12} weight="fill" />
                          Change ≥ {rfq.bidding_rules.min_change_percent}% required
                        </p>
                      )}
                      {fieldError && (
                        <p className="text-[11px] text-red mt-0.5 text-right">
                          {fieldError.message}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-sm text-text-primary">
                      {itemPrice > 0 ? formatCurrency(lineTotal) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-text-primary">
                <td
                  colSpan={5}
                  className="px-4 pt-3 pb-2 text-sm font-semibold text-text-primary"
                >
                  Grand Total
                </td>
                <td className="px-4 pt-3 pb-2 text-right font-mono text-lg font-bold text-text-primary">
                  {formatCurrency(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-5 py-4 border-t border-grey-200">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={isCooling}
            isLoading={reviseMutation.isPending}
          >
            Submit Revision
          </Button>
        </div>
      </form>

      {/* Cooling period overlay */}
      {isCooling && (
        <div className="absolute inset-0 bg-white/[0.92] backdrop-blur-[2px] flex flex-col items-center justify-center z-20 rounded-lg">
          <Clock size={40} weight="duotone" className="text-text-secondary mb-3" />
          <p className="text-sm font-medium text-grey-700">Next revision available in</p>
          <p className="font-mono text-[32px] font-bold text-[#C0392B] tabular-nums mt-1">
            {coolMm}:{coolSs}
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Cooling period between revisions
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Submission History ──────────────────────────────
interface SubmissionEntry {
  revision: number
  label: string
  timestamp: string
  total: number
  hash: string
}

function SubmissionHistory({
  rfqId,
  entries,
}: {
  rfqId: string
  entries: SubmissionEntry[]
}) {
  const { toast } = useToast()

  const handleDownloadReceipt = async (revision: number) => {
    try {
      const blob = await downloadReceipt(rfqId, revision)
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 10_000)
    } catch {
      toast.error('Download failed', 'Could not download the receipt.')
    }
  }

  if (entries.length === 0) return null

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-grey-200">
        <h2 className="text-md font-semibold text-text-primary">Submission History</h2>
      </div>

      <div className="px-5 py-4">
        <div className="relative pl-6">
          {/* Vertical line */}
          <div className="absolute left-[3px] top-2 bottom-2 w-px bg-grey-300" />

          <div className="space-y-5">
            {entries.map((entry, i) => (
              <div key={entry.revision} className="relative">
                {/* Dot */}
                <span
                  className={cn(
                    'absolute -left-6 top-1 w-2 h-2 rounded-full',
                    i === 0 ? 'bg-blue' : 'bg-grey-300'
                  )}
                />

                <div>
                  <p className="text-sm font-semibold text-text-primary">{entry.label}</p>
                  <p className="text-xs font-mono text-text-secondary mt-0.5">
                    {formatDateTime(entry.timestamp)}
                  </p>
                  <p className="font-mono text-base font-medium text-text-primary mt-1">
                    {formatCurrency(entry.total)}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-bg-subtle text-[11px] font-mono text-text-secondary">
                      <ShieldCheck size={12} weight="fill" className="text-green" />
                      {entry.hash.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt(entry.revision)}
                      className="inline-flex items-center gap-1 text-sm text-blue hover:underline"
                    >
                      <DownloadSimple size={14} />
                      Download Receipt
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Final Prices Read-Only ──────────────────────────
function FinalPricesTable({
  rfq,
  ranking,
}: {
  rfq: SupplierRfqDetail
  ranking: SupplierRanking | null
}) {
  const prices = useMemo(() => {
    const map: Record<string, { unit: number; total: number }> = {}
    ranking?.own_prices?.forEach((p) => {
      map[p.rfq_item_id] = { unit: p.unit_price, total: p.total_price }
    })
    return map
  }, [ranking])

  const grandTotal = ranking?.own_prices?.reduce((s, p) => s + p.total_price, 0) ?? 0

  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-grey-200">
        <h2 className="text-md font-semibold text-text-primary">Your Final Submission</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[440px] text-sm">
          <thead>
            <tr className="border-b border-grey-200 bg-bg-subtle">
              <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-10 sticky left-0 z-10 bg-bg-subtle">#</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-secondary sticky left-10 z-10 bg-bg-subtle">Description</th>
              <th className="text-left px-4 py-2.5 font-medium text-text-secondary w-16">UOM</th>
              <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-16">Qty</th>
              <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-24">Price</th>
              <th className="text-right px-4 py-2.5 font-medium text-text-secondary w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {rfq.items.map((item, i) => {
              const p = prices[item.id]
              return (
                <tr key={item.id} className="border-b border-grey-100 last:border-0">
                  <td className="px-4 py-2.5 text-text-secondary font-mono text-xs sticky left-0 z-10 bg-white">{i + 1}</td>
                  <td className="px-4 py-2.5 text-text-primary text-[13px] sticky left-10 z-10 bg-white">{item.description}</td>
                  <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">{item.uom}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">
                    {p ? `£${p.unit.toFixed(4)}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm">
                    {p ? formatCurrency(p.total) : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-text-primary">
              <td colSpan={5} className="px-4 pt-3 pb-2 text-sm font-semibold">Grand Total</td>
              <td className="px-4 pt-3 pb-2 text-right font-mono text-lg font-bold">
                {formatCurrency(grandTotal)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════
//  MAIN PAGE COMPONENT
// ═════════════════════════════════════════════════════
export function RfqViewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // ─── Local state ───────────────────────────────────
  const [showDeclarationModal, setShowDeclarationModal] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [forceClosed, setForceClosed] = useState(false)
  const [deadlineFlash, setDeadlineFlash] = useState<string | null>(null)

  // ─── Data fetching ─────────────────────────────────
  const rfqQuery = useQuery({
    queryKey: ['supplier-rfq', id],
    queryFn: () => getSupplierRfq(id!),
    enabled: !!id,
  })

  const rfq = rfqQuery.data

  // Derive whether bidding has started and we have a bid
  const shouldFetchRanking =
    !!rfq &&
    rfq.supplier_status === 'ACCEPTED' &&
    (rfq.status === 'ACTIVE' || rfq.status === 'CLOSED' || rfq.status === 'AWARDED')

  const rankingQuery = useQuery({
    queryKey: ['supplier-ranking', id],
    queryFn: () => getSupplierRanking(id!),
    enabled: shouldFetchRanking,
    refetchInterval: rfq?.status === 'ACTIVE' ? 30_000 : false,
  })

  const bidStatusQuery = useQuery({
    queryKey: ['supplier-bid-status', id],
    queryFn: () => getBidStatus(id!),
    enabled: shouldFetchRanking,
    refetchInterval: rfq?.status === 'ACTIVE' ? 15_000 : false,
  })

  const ranking = rankingQuery.data ?? null
  const bidStatus = bidStatusQuery.data ?? null

  // ─── Derived view state ────────────────────────────
  const viewState = deriveViewState(rfq, bidStatus, forceClosed)

  // ─── Submission history (built from bid-status + ranking data) ──
  const submissionHistory = useMemo<SubmissionEntry[]>(() => {
    if (!bidStatus || bidStatus.revision_number < 1) return []

    const currentTotal = bidStatus.latest_bid?.total_price
      ?? (ranking ? ranking.own_prices.reduce((s, p) => s + p.total_price, 0) : 0)
    const currentHash = bidStatus.latest_bid?.submission_hash ?? ''
    const currentTs = bidStatus.latest_bid?.submitted_at
      ?? bidStatus.last_submission_at
      ?? new Date().toISOString()

    // Only show the latest entry with real data; older revision details
    // require a dedicated backend endpoint (not yet available)
    return [{
      revision: bidStatus.revision_number,
      label: bidStatus.revision_number === 1 ? 'Initial Submission' : `Revision ${bidStatus.revision_number - 1}`,
      timestamp: currentTs,
      total: currentTotal,
      hash: currentHash,
    }]
  }, [bidStatus, ranking])

  // ─── WebSocket ─────────────────────────────────────
  const handleRankingUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['supplier-ranking', id] })
    queryClient.invalidateQueries({ queryKey: ['supplier-bid-status', id] })
  }, [queryClient, id])

  const handleDeadlineExtended = useCallback(
    (data: { new_deadline: string; extension_minutes: number }) => {
      queryClient.invalidateQueries({ queryKey: ['supplier-rfq', id] })
      toast.warning(
        'Bid window extended',
        `New close: ${formatDateTime(data.new_deadline)}`
      )
      setDeadlineFlash(`+${data.extension_minutes}m extended`)
      setTimeout(() => setDeadlineFlash(null), 3000)
    },
    [queryClient, id, toast]
  )

  const handleClosed = useCallback(() => {
    setForceClosed(true)
    toast.info('Bid window closed', 'Bid window has closed for this enquiry')
    queryClient.invalidateQueries({ queryKey: ['supplier-rfq', id] })
  }, [queryClient, id, toast])

  const handleReconnect = useCallback(() => {
    // Refetch all data to catch events missed during disconnection
    queryClient.invalidateQueries({ queryKey: ['supplier-rfq', id] })
    queryClient.invalidateQueries({ queryKey: ['supplier-ranking', id] })
    queryClient.invalidateQueries({ queryKey: ['supplier-bid-status', id] })
  }, [queryClient, id])

  const { isConnected, isReconnecting } = useWebSocket({
    rfqId: id ?? '',
    enabled:
      !!id &&
      !!rfq &&
      rfq.status === 'ACTIVE' &&
      rfq.supplier_status === 'ACCEPTED' &&
      !forceClosed,
    onRankingUpdate: handleRankingUpdate,
    onDeadlineExtended: handleDeadlineExtended,
    onClosed: handleClosed,
    onReconnect: handleReconnect,
  })

  // ─── Handlers ──────────────────────────────────────
  const handleAccepted = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-rfq', id] })
    queryClient.invalidateQueries({ queryKey: ['supplier-rfqs'] })
    toast.success('Participation accepted', 'You have accepted the enquiry.')
  }

  const handleDeclined = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-rfq', id] })
    queryClient.invalidateQueries({ queryKey: ['supplier-rfqs'] })
    toast.info('Participation declined', 'Your response has been recorded.')
  }

  const handleBidSubmitted = () => {
    queryClient.invalidateQueries({ queryKey: ['supplier-ranking', id] })
    queryClient.invalidateQueries({ queryKey: ['supplier-bid-status', id] })
  }

  // ─── Loading state ─────────────────────────────────
  if (viewState === 'LOADING' || rfqQuery.isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton width={32} height={32} borderRadius={8} />
          <Skeleton width={100} height={14} />
          <Skeleton width="50%" height={18} />
        </div>
        <Skeleton width="100%" height={200} borderRadius={12} />
        <Skeleton width="100%" height={300} borderRadius={12} className="mt-4" />
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-text-secondary">Enquiry not found.</p>
        <Button variant="ghost" onClick={() => navigate('/supplier')} className="mt-4">
          Back to My Enquiries
        </Button>
      </div>
    )
  }

  const bidCloseAt = rfq.bidding_rules.bid_close_at

  // ─── Render ────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto pb-32 sm:pb-8">
      {/* ── Sticky Top Bar ───────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-grey-200 shadow-sm -mx-4 sm:-mx-6 px-4 sm:px-6">
        <div className="flex items-center gap-3 h-14 sm:flex-row flex-wrap">
          <button
            type="button"
            onClick={() => navigate('/supplier')}
            className="p-2 -ml-2 rounded-DEFAULT hover:bg-bg-subtle transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Back to enquiries"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="font-mono text-[13px] text-text-secondary">
            {rfq.rfq_number}
          </span>
          <h1 className="text-base font-medium text-text-primary truncate flex-1 min-w-0">
            {rfq.title}
          </h1>
          {bidCloseAt && viewState !== 'CLOSED' && viewState !== 'DECLINED' && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {deadlineFlash && (
                <span className="text-xs text-yellow font-medium animate-pulse">
                  {deadlineFlash}
                </span>
              )}
              <CountdownTimer
                targetDate={bidCloseAt}
                size="sm"
                compact
                onExpired={() => setForceClosed(true)}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Connection Status ────────────────────────── */}
      {(viewState === 'BID_SUBMITTED' || viewState === 'ACCEPTED_BIDDING') && (
        <div className="flex justify-end mt-2 mb-1">
          <ConnectionIndicator isConnected={isConnected} isReconnecting={isReconnecting} />
        </div>
      )}

      {/* ── STATE: DECLINED ──────────────────────────── */}
      {viewState === 'DECLINED' && (
        <div className="mt-4 rounded-DEFAULT border border-red-light bg-red-light/30 px-5 py-4">
          <p className="text-sm font-semibold text-[#7F1D1D]">
            You have declined to participate in this enquiry
          </p>
          {rfq.decline_reason && (
            <p className="text-[13px] text-text-tertiary mt-1">
              Reason: {rfq.decline_reason}
            </p>
          )}
        </div>
      )}

      {/* ── STATE: ACCEPTED_WAITING ──────────────────── */}
      {viewState === 'ACCEPTED_WAITING' && (
        <div className="mt-4 rounded-DEFAULT border border-[#C6DCFA] bg-[#E8F1FB] px-5 py-3.5 flex items-center gap-3">
          <CalendarBlank size={20} className="text-blue flex-shrink-0" />
          <p className="text-base text-text-primary">
            Bidding opens on{' '}
            <span className="font-medium">
              {formatDateTime(rfq.bidding_rules.bid_open_at)}
            </span>
          </p>
        </div>
      )}

      {/* ── STATE: ACCEPTED_BIDDING (live banner) ────── */}
      {viewState === 'ACCEPTED_BIDDING' && (
        <div className="mt-4 rounded-DEFAULT bg-gradient-to-br from-[#0071E3] to-[#005EC7] px-5 py-4">
          <div className="flex items-center gap-2">
            <Lightning size={24} weight="fill" className="text-white" />
            <span className="text-md font-bold text-white">Bidding is live</span>
          </div>
          <p className="text-[13px] text-white/80 mt-0.5">
            Submit your prices now · window closes{' '}
            {formatRelativeTime(bidCloseAt)}
          </p>
        </div>
      )}

      {/* ── STATE: CLOSED banner ─────────────────────── */}
      {viewState === 'CLOSED' && (
        <div className="mt-4 rounded-DEFAULT border border-grey-200 bg-bg-subtle px-5 py-4 flex items-center gap-3">
          <LockSimple size={20} className="text-text-secondary flex-shrink-0" />
          <div>
            <p className="text-base font-semibold text-grey-800">
              This enquiry has closed
            </p>
            <p className="text-[13px] text-text-secondary mt-0.5">
              No further bids are accepted. Download your confirmation receipts below.
            </p>
          </div>
        </div>
      )}

      {/* ── Main Content ─────────────────────────────── */}
      <div className="mt-4 flex flex-col gap-4">
        {/* State 1: PENDING — show details + actions */}
        {viewState === 'PENDING' && <EnquiryDetailsCard rfq={rfq} />}

        {/* State 2: ACCEPTED_WAITING — show details */}
        {viewState === 'ACCEPTED_WAITING' && <EnquiryDetailsCard rfq={rfq} />}

        {/* State 3: ACCEPTED_BIDDING — bid entry form */}
        {viewState === 'ACCEPTED_BIDDING' && (
          <BidEntryForm rfq={rfq} onSubmitted={handleBidSubmitted} />
        )}

        {/* State 4: BID_SUBMITTED — rank widget + revision + history */}
        {viewState === 'BID_SUBMITTED' && (
          <>
            {/* Section A: RankDisplayWidget */}
            {ranking && bidStatus && (
              <RankDisplayWidget
                rankColor={ranking.rank_color}
                proximityLabel={ranking.proximity_label}
                revisionsRemaining={bidStatus.revisions_remaining}
                maxRevisions={bidStatus.revision_number + bidStatus.revisions_remaining}
                coolingSecondsRemaining={bidStatus.cooling_seconds_remaining}
              />
            )}

            {/* Section B: Revision form */}
            {bidStatus && (
              <RevisionForm
                rfq={rfq}
                ranking={ranking}
                bidStatus={bidStatus}
                onRevised={handleBidSubmitted}
              />
            )}

            {/* Section C: Submission history */}
            <SubmissionHistory rfqId={rfq.id} entries={submissionHistory} />
          </>
        )}

        {/* State 5: CLOSED — final prices + history */}
        {viewState === 'CLOSED' && (
          <>
            <FinalPricesTable rfq={rfq} ranking={ranking} />
            <SubmissionHistory rfqId={rfq.id} entries={submissionHistory} />
          </>
        )}
      </div>

      {/* ── Sticky Bottom Action Bar (PENDING only) ──── */}
      {viewState === 'PENDING' && (
        <div className="fixed bottom-0 left-0 right-0 sm:left-auto sm:right-auto sm:max-w-3xl sm:mx-auto bg-white border-t border-grey-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-30 px-5 py-3.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <p className="text-[13px] text-text-secondary hidden sm:block flex-1">
              Please decide your participation
            </p>
            <div className="flex flex-col sm:flex-row gap-2.5 w-full sm:w-auto">
              <Button
                variant="danger"
                size="lg"
                onClick={() => setShowDeclineModal(true)}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Decline
              </Button>
              <Button
                variant="primary"
                size="lg"
                onClick={() => setShowDeclarationModal(true)}
                className="w-full sm:w-auto min-h-[44px]"
              >
                Review & Accept
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────── */}
      <DeclarationModal
        isOpen={showDeclarationModal}
        onClose={() => setShowDeclarationModal(false)}
        onAccepted={handleAccepted}
        onAccept={(declarations) => acceptRfq(rfq.id, declarations)}
      />

      <DeclineModal
        isOpen={showDeclineModal}
        onClose={() => setShowDeclineModal(false)}
        onDeclined={handleDeclined}
        onDecline={(reason) => declineRfq(rfq.id, reason)}
      />
    </div>
  )
}
