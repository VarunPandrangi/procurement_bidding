import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { WarningCircle, Gavel, ArrowLeft } from '@phosphor-icons/react'
import {
  getBuyerRfq,
  finaliseAward,
  type AwardInput,
} from '../../api/rfq.api'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../store/toastStore'

export function AwardFinalization() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [showConfirm, setShowConfirm] = useState(false)
  const [notes, setNotes] = useState('')

  const { data: rfq, isLoading } = useQuery({
    queryKey: ['buyer-rfq', id],
    queryFn: () => getBuyerRfq(id!),
    enabled: !!id,
  })

  const awardMutation = useMutation({
    mutationFn: (payload: AwardInput) => finaliseAward(id!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['buyer-rfq', id] })
      queryClient.invalidateQueries({ queryKey: ['buyer-rfqs'] })
      toast.success('Award Finalised', 'The award has been confirmed and suppliers have been notified.')
      navigate(`/buyer/rfqs/${id}`)
    },
    onError: () => toast.error('Award Failed', 'Something went wrong. Please try again.'),
  })

  async function handleConfirm() {
    if (!rfq) return
    // Default: award all to first supplier (single award)
    const payload: AwardInput = {
      type: rfq.suppliers.length === 1 ? 'single' : 'split',
      allocations: rfq.suppliers
        .filter((s) => s.status === 'ACCEPTED')
        .map((s) => ({
          supplier_id: s.supplier_id,
          item_ids: rfq.items.map((item) => item.id),
        })),
    }
    await awardMutation.mutateAsync(payload)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton width="100%" height={48} borderRadius={8} />
        <Skeleton width="100%" height={300} borderRadius={8} />
      </div>
    )
  }

  if (!rfq) {
    return (
      <div className="py-20 text-center text-text-secondary">
        Enquiry not found.
        <Link to="/buyer/rfqs" className="text-blue ml-2">Back to Enquiries</Link>
      </div>
    )
  }

  const acceptedSuppliers = rfq.suppliers.filter((s) => s.status === 'ACCEPTED')

  return (
    <div className="max-w-3xl mx-auto">
      {/* Breadcrumb */}
      <Link
        to={`/buyer/rfqs/${id}`}
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-4"
      >
        <ArrowLeft size={14} /> Back to {rfq.rfq_number}
      </Link>

      <h1 className="text-xl font-bold text-text-primary tracking-tight mb-6">Finalise Award</h1>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 mb-6 bg-yellow-light border border-yellow/30 rounded-lg">
        <WarningCircle size={24} weight="fill" className="text-yellow flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-text-primary">This decision is permanent</p>
          <p className="text-sm text-text-secondary mt-0.5">
            Once you confirm the award, suppliers will be notified and the decision cannot be reversed.
          </p>
        </div>
      </div>

      {/* Allocation Summary */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6 mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">Award Allocation</h2>
        <div className="border border-grey-200 rounded-DEFAULT overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-subtle">
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Supplier Code</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Company</th>
                <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Items Awarded</th>
                <th className="px-4 py-2.5 text-right font-medium text-text-secondary">Total Value</th>
                <th className="px-4 py-2.5 text-left font-medium text-text-secondary">Credibility</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-grey-100">
              {acceptedSuppliers.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2.5 font-mono text-xs text-text-primary">{s.supplier_code}</td>
                  <td className="px-4 py-2.5 text-text-primary">{s.company_name}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-primary">{rfq.items.length}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-primary">--</td>
                  <td className="px-4 py-2.5">
                    {s.credibility_class ? (
                      <Badge variant={s.credibility_class as 'EXCELLENT' | 'STABLE' | 'RISKY'} />
                    ) : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-grey-200 bg-bg-subtle">
                <td className="px-4 py-2.5 font-semibold text-text-primary" colSpan={2}>Total Procurement Cost</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold text-text-primary">
                  {rfq.items.length} items
                </td>
                <td className="px-4 py-2.5 text-right font-mono font-bold text-text-primary">--</td>
                <td className="px-4 py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6 mb-6">
        <label className="block text-sm font-medium text-text-primary mb-2">
          Award justification <span className="text-text-secondary font-normal">(optional)</span>
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value.slice(0, 1000))}
          placeholder="Add any notes about this award decision..."
          rows={3}
          className="w-full px-3 py-2 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue resize-none"
        />
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-text-secondary">These notes will be recorded in the audit trail alongside the award decision.</p>
          <span className="text-xs text-text-secondary">{notes.length}/1000</span>
        </div>
      </div>

      {/* Action */}
      <Button
        variant="danger"
        className="w-full"
        onClick={() => setShowConfirm(true)}
      >
        <Gavel size={18} className="mr-2" /> Confirm and Finalise Award
      </Button>

      <ConfirmDialog
        isOpen={showConfirm}
        title="Confirm award finalisation"
        message={`${acceptedSuppliers.map((s) => s.company_name).join(', ')} will be awarded ${rfq.items.length} item(s). This action cannot be undone.`}
        detail="All parties will be notified. The decision will be permanently recorded in the immutable audit trail."
        confirmLabel="Yes, finalise award"
        confirmVariant="danger"
        onConfirm={handleConfirm}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}
