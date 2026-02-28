import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import { createRfq, publishRfq, assignSuppliers, getAvailableSuppliers } from '../../../api/rfq.api'
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog'
import { useToast } from '../../../store/toastStore'
import type { RfqFormData } from '../rfqFormSchema'

interface StepReviewProps {
  data: RfqFormData
  onBack: () => void
}

export function StepReview({ data, onBack }: StepReviewProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    items: true,
    terms: true,
    rules: true,
    suppliers: true,
  })

  const { data: suppliers } = useQuery({
    queryKey: ['available-suppliers'],
    queryFn: getAvailableSuppliers,
  })

  const selectedSuppliers = (suppliers ?? []).filter((s) => data.supplier_ids.includes(s.id))

  const createMutation = useMutation({
    mutationFn: () => {
      const { supplier_ids, ...payload } = data
      const cleaned: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(payload)) {
        if (val === '' || val === null) continue
        cleaned[key] = val
      }
      if (cleaned.bid_open_at) {
        cleaned.bid_open_at = new Date(cleaned.bid_open_at as string).toISOString()
      }
      if (cleaned.bid_close_at) {
        cleaned.bid_close_at = new Date(cleaned.bid_close_at as string).toISOString()
      }
      return createRfq(cleaned)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] })
    },
  })

  async function handleSaveDraft() {
    try {
      const rfq = await createMutation.mutateAsync()
      toast.success('Enquiry saved as draft.')
      navigate(`/buyer/rfqs/${rfq.id}`)
    } catch {
      toast.error('Failed to save draft.')
    }
  }

  async function handlePublish() {
    try {
      const rfq = await createMutation.mutateAsync()
      if (data.supplier_ids.length > 0) {
        await assignSuppliers(rfq.id, data.supplier_ids)
      }
      await publishRfq(rfq.id)
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] })
      toast.success('Enquiry published — suppliers will be notified.')
      navigate(`/buyer/rfqs/${rfq.id}`)
    } catch {
      toast.error('Failed to publish enquiry.')
    } finally {
      setShowPublishConfirm(false)
    }
  }

  function toggleSection(key: string) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const bidOpenFormatted = data.bid_open_at
    ? new Date(data.bid_open_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <div>
      {/* Title */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6 mb-5">
        <h2 className="text-base font-semibold text-text-primary mb-2">Review Before Publishing</h2>
        <p className="text-lg font-bold text-text-primary">{data.title || '(Untitled)'}</p>
      </div>

      {/* Items - collapsible */}
      <CollapsibleSection
        title={`Items (${data.items.length} items)`}
        open={openSections.items}
        onToggle={() => toggleSection('items')}
      >
        <table className="w-full text-left">
          <thead>
            <tr className="bg-bg-subtle border-b border-grey-200">
              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">#</th>
              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">Description</th>
              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase">UOM</th>
              <th className="px-4 py-2 text-xs font-semibold text-text-secondary uppercase text-right">Qty</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.sl_no} className="border-b border-grey-100 last:border-0">
                <td className="px-4 py-2 font-mono text-sm text-text-secondary">{item.sl_no}</td>
                <td className="px-4 py-2 text-sm text-text-primary">{item.description}</td>
                <td className="px-4 py-2 text-sm text-text-secondary">{item.uom}</td>
                <td className="px-4 py-2 text-sm font-mono text-text-primary text-right">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CollapsibleSection>

      {/* Commercial Terms - collapsible */}
      <CollapsibleSection
        title="Commercial Terms"
        open={openSections.terms}
        onToggle={() => toggleSection('terms')}
      >
        <div className="px-6 py-4">
          <div className="grid grid-cols-2 gap-x-8 gap-y-2">
            {[
              ['Payment Terms', data.payment_terms],
              ['Freight Terms', data.freight_terms],
              ['Delivery Lead Time', data.delivery_lead_time_days ? `${data.delivery_lead_time_days} days` : null],
              ['Taxes & Duties', data.taxes_duties],
              ['Warranty', data.warranty],
              ['Offer Validity', data.offer_validity_days ? `${data.offer_validity_days} days` : null],
              ['Packing & Forwarding', data.packing_forwarding],
            ].map(([label, value]) => (
              <div key={label as string} className="flex justify-between py-1">
                <span className="text-sm text-text-secondary">{label}</span>
                <span className="text-sm font-medium text-text-primary">{value || '--'}</span>
              </div>
            ))}
          </div>
          {data.special_conditions && (
            <div className="mt-3 pt-3 border-t border-grey-200">
              <span className="text-sm text-text-secondary">Special Conditions: </span>
              <span className="text-sm text-text-primary">{data.special_conditions}</span>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Bidding Rules - collapsible, human-readable */}
      <CollapsibleSection
        title="Bidding Rules"
        open={openSections.rules}
        onToggle={() => toggleSection('rules')}
      >
        <div className="px-6 py-4 space-y-2">
          <p className="text-sm text-text-primary">
            Suppliers can revise up to <span className="font-semibold">{data.max_revisions}</span> times
          </p>
          <p className="text-sm text-text-primary">
            Each revision must change prices by at least <span className="font-semibold">{data.min_change_percent}%</span>
          </p>
          <p className="text-sm text-text-primary">
            <span className="font-semibold">{data.cooling_time_minutes}-minute</span> cooling time between revisions
          </p>
          <p className="text-sm text-text-primary">
            Anti-snipe: bids in final <span className="font-semibold">{data.anti_snipe_window_minutes} minutes</span> extend window by <span className="font-semibold">{data.anti_snipe_extension_minutes} minutes</span>
          </p>
          {data.bid_open_at && (
            <p className="text-sm text-text-primary">
              Bid window opens <span className="font-semibold">{new Date(data.bid_open_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </p>
          )}
          {data.bid_close_at && (
            <p className="text-sm text-text-primary">
              Bid window closes <span className="font-semibold">{new Date(data.bid_close_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </p>
          )}
          {((data.weight_delivery ?? 0) > 0 || (data.weight_payment ?? 0) > 0) && (
            <div className="mt-2 pt-2 border-t border-grey-200">
              <p className="text-sm text-text-primary">
                Weighted ranking: Price {data.weight_price}% · Delivery {data.weight_delivery}% · Payment {data.weight_payment}%
              </p>
            </div>
          )}
        </div>
      </CollapsibleSection>

      {/* Suppliers - collapsible */}
      <CollapsibleSection
        title={`Suppliers (${selectedSuppliers.length} invited)`}
        open={openSections.suppliers}
        onToggle={() => toggleSection('suppliers')}
      >
        <div className="px-6 py-4">
          <div className="flex flex-wrap gap-2">
            {selectedSuppliers.length === 0 ? (
              <span className="text-sm text-text-secondary">No suppliers selected.</span>
            ) : (
              selectedSuppliers.map((s) => (
                <span key={s.id} className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-blue-light text-blue rounded-full">
                  {s.company_name}
                  <span className="font-mono text-blue/60">{s.unique_code}</span>
                </span>
              ))
            )}
          </div>
        </div>
      </CollapsibleSection>

      {/* Actions - sticky */}
      <div className="sticky bottom-0 bg-white border-t border-grey-200 shadow-card -mx-6 px-6 py-4 mt-6 flex items-center justify-between">
        <button onClick={onBack} className="h-9 px-4 rounded-DEFAULT border border-grey-200 text-sm font-medium text-text-secondary hover:bg-bg-subtle transition-colors">
          Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={createMutation.isPending}
            className="h-9 px-5 rounded-DEFAULT border border-grey-200 text-sm font-medium text-text-secondary hover:bg-bg-subtle transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>
          <button
            onClick={() => setShowPublishConfirm(true)}
            disabled={!data.title || data.items.length === 0 || data.supplier_ids.length < 2}
            className="h-9 px-5 rounded-DEFAULT bg-blue text-white text-sm font-medium hover:bg-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Publish Enquiry
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showPublishConfirm}
        title="Publish this enquiry?"
        message={`This will notify ${selectedSuppliers.length} suppliers and open the bid window${bidOpenFormatted ? ` on ${bidOpenFormatted}` : ''}.`}
        detail="Commercial terms will lock once the first supplier accepts."
        confirmLabel="Publish"
        confirmVariant="primary"
        onConfirm={handlePublish}
        onCancel={() => setShowPublishConfirm(false)}
      />
    </div>
  )
}

function CollapsibleSection({ title, open, onToggle, children }: {
  title: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden mb-5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-bg-subtle transition-colors"
      >
        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">{title}</h3>
        {open ? <CaretUp size={16} className="text-text-secondary" /> : <CaretDown size={16} className="text-text-secondary" />}
      </button>
      {open && <div className="border-t border-grey-200">{children}</div>}
    </div>
  )
}
