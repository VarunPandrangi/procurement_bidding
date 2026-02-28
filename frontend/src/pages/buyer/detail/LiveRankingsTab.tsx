import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRankings, type RfqDetail, type RankingResult } from '../../../api/rfq.api'
import { CountdownTimer } from '../../../components/ui/CountdownTimer'
import { Badge } from '../../../components/ui/Badge'
import { Skeleton } from '../../../components/ui/Skeleton'
import { useWebSocket } from '../../../hooks/useWebSocket'
import { useToast } from '../../../store/toastStore'
import { formatCurrency } from '../../../utils/format'
import { cn } from '../../../utils/cn'

interface LiveRankingsTabProps {
  rfq: RfqDetail
}

export function LiveRankingsTab({ rfq }: LiveRankingsTabProps) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [flashKey, setFlashKey] = useState(0)

  const { data: rankings, isLoading } = useQuery({
    queryKey: ['rfq-rankings', rfq.id],
    queryFn: () => getRankings(rfq.id),
    enabled: rfq.status === 'ACTIVE' || rfq.status === 'CLOSED',
    refetchInterval: rfq.status === 'ACTIVE' ? 30_000 : false,
  })

  const handleRankingUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['rfq-rankings', rfq.id] })
    setFlashKey((k) => k + 1)
  }, [queryClient, rfq.id])

  const handleDeadlineExtended = useCallback((data: { new_deadline: string; extension_minutes: number }) => {
    queryClient.invalidateQueries({ queryKey: ['buyer-rfq', rfq.id] })
    toast.warning('Deadline Extended', `Bid close extended to ${new Date(data.new_deadline).toLocaleTimeString()}`)
  }, [queryClient, rfq.id, toast])

  const { isConnected } = useWebSocket({
    rfqId: rfq.id,
    enabled: rfq.status === 'ACTIVE',
    onRankingUpdate: handleRankingUpdate,
    onDeadlineExtended: handleDeadlineExtended,
  })

  if (rfq.status === 'DRAFT' || rfq.status === 'PUBLISHED') {
    return (
      <div className="py-12 text-center text-text-secondary text-sm">
        Rankings will appear once bidding begins.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {rfq.status === 'ACTIVE' && (
            <>
              <div className={cn(
                'w-2.5 h-2.5 rounded-full',
                isConnected ? 'bg-green animate-pulse' : 'bg-yellow',
              )} />
              <span className={cn(
                'text-xs font-medium',
                isConnected ? 'text-green' : 'text-yellow',
              )}>
                {isConnected ? 'Live' : 'Reconnecting...'}
              </span>
            </>
          )}
        </div>
        {rfq.status === 'ACTIVE' && rfq.bid_close_at && (
          <CountdownTimer targetDate={rfq.bid_close_at} size="lg" />
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton width="100%" height={200} borderRadius={8} />
          <Skeleton width="100%" height={200} borderRadius={8} />
        </div>
      ) : rankings ? (
        <RankingCards rankings={rankings} rfq={rfq} flashKey={flashKey} />
      ) : (
        <div className="py-12 text-center text-text-secondary text-sm">
          No ranking data available.
        </div>
      )}
    </div>
  )
}

function RankingCards({ rankings, rfq, flashKey }: { rankings: RankingResult; rfq: RfqDetail; flashKey: number }) {
  const itemMap = new Map(rfq.items.map((item) => [item.id, item]))
  const l1Total = rankings.total_rankings.length > 0
    ? rankings.total_rankings.reduce((min, tr) => tr.total_price < min ? tr.total_price : min, Infinity)
    : 0

  return (
    <div className="space-y-6">
      {/* Item Rankings */}
      {rankings.item_rankings.length > 0 && (
        <div className={cn(
          'border border-grey-200 rounded-DEFAULT overflow-hidden transition-colors duration-500',
          flashKey > 0 && 'ring-2 ring-yellow/40',
        )}>
          <div className="bg-bg-subtle px-4 py-2.5">
            <h4 className="text-sm font-semibold text-text-primary">Item Rankings</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200">
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Sl.</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Description</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">L1 Supplier</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">L1 Price</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Bidders</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {rankings.item_rankings.map((ir) => {
                const item = itemMap.get(ir.rfq_item_id)
                return (
                  <tr key={ir.rfq_item_id}>
                    <td className="px-4 py-2 font-mono text-xs text-text-secondary">{item?.sl_no ?? '--'}</td>
                    <td className="px-4 py-2 text-sm text-text-primary truncate max-w-[200px]">
                      {item?.description ?? ir.rfq_item_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-text-primary">{ir.l1_supplier_code ?? '--'}</td>
                    <td className="px-4 py-2 text-right font-mono text-text-primary">
                      {ir.l1_price != null ? formatCurrency(ir.l1_price) : '--'}
                    </td>
                    <td className="px-4 py-2 text-right text-text-secondary">{ir.bidder_count}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Total Rankings */}
      {rankings.total_rankings.length > 0 && (
        <div className="border border-grey-200 rounded-DEFAULT overflow-hidden">
          <div className="bg-bg-subtle px-4 py-2.5">
            <h4 className="text-sm font-semibold text-text-primary">Total Rankings</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200">
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Rank</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Supplier</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Total Bid</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">vs L1</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Credibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {rankings.total_rankings.map((tr) => {
                const delta = tr.total_price - l1Total
                const deltaPct = l1Total > 0 ? (delta / l1Total) * 100 : 0
                return (
                  <tr key={tr.supplier_id} className={cn(
                    tr.rank === 1 && 'bg-green-light/30 border-l-4 border-l-green',
                    tr.rank === 2 && 'border-l-4 border-l-yellow',
                  )}>
                    <td className="px-4 py-2 font-semibold text-text-primary">L{tr.rank}</td>
                    <td className="px-4 py-2 font-mono text-xs text-text-primary">{tr.supplier_code}</td>
                    <td className="px-4 py-2 text-right font-mono text-text-primary">
                      {formatCurrency(tr.total_price)}
                    </td>
                    <td className="px-4 py-2 text-right font-mono text-xs">
                      {tr.rank === 1 ? (
                        <span className="text-text-secondary">&mdash;</span>
                      ) : (
                        <span className="text-red">
                          +{formatCurrency(delta)} (+{deltaPct.toFixed(1)}%)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {tr.credibility_class ? <Badge variant={tr.credibility_class} /> : '--'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Weighted Rankings */}
      {rankings.weighted_rankings.length > 0 && (
        <div className="border border-grey-200 rounded-DEFAULT overflow-hidden">
          <div className="bg-bg-subtle px-4 py-2.5">
            <h4 className="text-sm font-semibold text-text-primary">Weighted Rankings</h4>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-grey-200">
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Rank</th>
                <th className="px-4 py-2 text-left font-medium text-text-secondary">Supplier</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Score</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Price</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Delivery</th>
                <th className="px-4 py-2 text-right font-medium text-text-secondary">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {rankings.weighted_rankings.map((wr) => (
                <tr key={wr.supplier_id} className={wr.rank === 1 ? 'bg-green-light/30' : ''}>
                  <td className="px-4 py-2 font-semibold text-text-primary">#{wr.rank}</td>
                  <td className="px-4 py-2 font-mono text-xs text-text-primary">{wr.supplier_code}</td>
                  <td className="px-4 py-2 text-right font-mono font-semibold text-text-primary">
                    {wr.score.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right text-text-secondary">{wr.score_breakdown.price_score.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{wr.score_breakdown.delivery_score.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right text-text-secondary">{wr.score_breakdown.payment_score.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
