import { useQuery } from '@tanstack/react-query'
import type { RfqDetail } from '../../../api/rfq.api'
import { getRankings } from '../../../api/rfq.api'
import { Badge } from '../../../components/ui/Badge'
import { formatCurrency } from '../../../utils/format'

interface OverviewTabProps {
  rfq: RfqDetail
}

export function OverviewTab({ rfq }: OverviewTabProps) {
  const isPostClose = rfq.status === 'CLOSED' || rfq.status === 'AWARDED'

  const { data: rankings } = useQuery({
    queryKey: ['rfq-rankings', rfq.id],
    queryFn: () => getRankings(rfq.id),
    enabled: isPostClose,
  })

  // Build a lookup: itemId → supplier_code → unit_price
  const priceMap = new Map<string, Map<string, { unit_price: number; rank: number }>>()
  const supplierCodes: string[] = []
  if (rankings) {
    const codeSet = new Set<string>()
    for (const ir of rankings.item_rankings) {
      const m = new Map<string, { unit_price: number; rank: number }>()
      for (const entry of ir.rankings) {
        m.set(entry.supplier_code, { unit_price: entry.unit_price, rank: entry.rank })
        codeSet.add(entry.supplier_code)
      }
      priceMap.set(ir.rfq_item_id, m)
    }
    supplierCodes.push(...Array.from(codeSet).sort())
  }

  return (
    <div className="space-y-6">
      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Items Table - 3/5 */}
        <div className="lg:col-span-3">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Line Items</h3>
          <div className="border border-grey-200 rounded-DEFAULT overflow-hidden overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-subtle">
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Sl.</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Description</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Spec</th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary">UOM</th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Qty</th>
                  {isPostClose && supplierCodes.length > 0 ? (
                    supplierCodes.map((code) => (
                      <th key={code} className="px-4 py-2.5 text-right font-medium text-text-secondary font-mono text-xs">
                        {code}
                      </th>
                    ))
                  ) : (
                    <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Unit Price</th>
                  )}
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Ref Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grey-100">
                {rfq.items.map((item) => (
                  <tr key={item.id} className="hover:bg-bg-subtle/50">
                    <td className="px-4 py-2.5 text-text-secondary font-mono text-xs">{item.sl_no}</td>
                    <td className="px-4 py-2.5 text-text-primary">{item.description}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{item.specification || '--'}</td>
                    <td className="px-4 py-2.5 text-text-secondary">{item.uom}</td>
                    <td className="px-4 py-2.5 text-right text-text-primary font-mono">{item.quantity}</td>
                    {isPostClose && supplierCodes.length > 0 ? (
                      supplierCodes.map((code) => {
                        const entry = priceMap.get(item.id)?.get(code)
                        return (
                          <td
                            key={code}
                            className={`px-4 py-2.5 text-right font-mono text-xs ${entry?.rank === 1 ? 'text-green font-semibold bg-green-light/20' : 'text-text-primary'}`}
                          >
                            {entry ? formatCurrency(entry.unit_price) : '--'}
                          </td>
                        )
                      })
                    ) : (
                      <td className="px-4 py-2.5 text-right text-xs italic text-grey-400">Supplier fills</td>
                    )}
                    <td className="px-4 py-2.5 text-right text-text-secondary font-mono">
                      {item.last_price != null ? formatCurrency(item.last_price) : '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right column - 2/5 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Commercial Terms */}
          <div className="border border-grey-200 rounded-DEFAULT p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Commercial Terms</h3>
            <dl className="space-y-2 text-sm">
              <TermRow label="Payment Terms" value={rfq.payment_terms} />
              <TermRow label="Freight Terms" value={rfq.freight_terms} />
              <TermRow label="Delivery Lead Time" value={rfq.delivery_lead_time_days != null ? `${rfq.delivery_lead_time_days} days` : null} />
              <TermRow label="Taxes & Duties" value={rfq.taxes_duties} />
              <TermRow label="Warranty" value={rfq.warranty} />
              <TermRow label="Offer Validity" value={rfq.offer_validity_days != null ? `${rfq.offer_validity_days} days` : null} />
              <TermRow label="Packing & Forwarding" value={rfq.packing_forwarding} />
              {rfq.special_conditions && (
                <TermRow label="Special Conditions" value={rfq.special_conditions} />
              )}
            </dl>
          </div>

          {/* Bidding Rules */}
          <div className="border border-grey-200 rounded-DEFAULT p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Bidding Rules</h3>
            <div className="space-y-2 text-sm text-text-primary">
              <p>Suppliers can revise up to <span className="font-semibold">{rfq.max_revisions}</span> times</p>
              <p>Each revision must change prices by at least <span className="font-semibold">{rfq.min_change_percent}%</span></p>
              <p><span className="font-semibold">{rfq.cooling_time_minutes}-minute</span> cooling time between revisions</p>
              <p>Anti-snipe: bids in final <span className="font-semibold">{rfq.anti_snipe_window_minutes} minutes</span> extend window by <span className="font-semibold">{rfq.anti_snipe_extension_minutes} minutes</span></p>
            </div>
            {(rfq.weight_price > 0 || rfq.weight_delivery > 0 || rfq.weight_payment > 0) && (
              <div className="mt-3 pt-3 border-t border-grey-100">
                <p className="text-xs font-medium text-text-secondary mb-2">Weighted Ranking</p>
                <div className="flex gap-3">
                  <WeightPill label="Price" value={rfq.weight_price} />
                  <WeightPill label="Delivery" value={rfq.weight_delivery} />
                  <WeightPill label="Payment" value={rfq.weight_payment} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Suppliers Table */}
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-3">Assigned Suppliers</h3>
        <div className="border border-grey-200 rounded-DEFAULT overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-subtle">
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Company</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Code</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Status</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Credibility</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Accepted At</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {rfq.suppliers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-secondary">
                    Suppliers will appear here as they respond to invitations.
                  </td>
                </tr>
              ) : (
                rfq.suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-bg-subtle/50">
                    <td className="px-4 py-2.5 text-text-primary">{s.company_name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-text-secondary">{s.supplier_code}</td>
                    <td className="px-4 py-2.5"><Badge variant={s.status} /></td>
                    <td className="px-4 py-2.5">
                      {s.credibility_class ? <Badge variant={s.credibility_class as 'EXCELLENT' | 'STABLE' | 'RISKY'} /> : '--'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">
                      {(s as unknown as Record<string, unknown>).accepted_at ? String((s as unknown as Record<string, unknown>).accepted_at) : '--'}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-secondary">--</td>
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

function TermRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-text-primary font-medium">{value ?? '--'}</dd>
    </div>
  )
}

function WeightPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-bg-subtle rounded-full text-xs">
      <span className="text-text-secondary">{label}</span>
      <span className="font-semibold text-text-primary">{value}%</span>
    </div>
  )
}
