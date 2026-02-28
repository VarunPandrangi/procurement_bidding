import { useState } from 'react'
import { CaretDown, CaretUp } from '@phosphor-icons/react'
import type { RfqFormData } from '../rfqFormSchema'

const FREIGHT_OPTIONS = ['FOB', 'CIF', 'EXW', 'DDP', 'FCA', 'CPT', 'DAP']

interface StepCommercialTermsProps {
  data: RfqFormData
  onChange: (partial: Partial<RfqFormData>) => void
  onNext: () => void
  onBack: () => void
}

export function StepCommercialTerms({ data, onChange, onNext, onBack }: StepCommercialTermsProps) {
  const isOtherFreight = data.freight_terms ? !FREIGHT_OPTIONS.includes(data.freight_terms) : false
  const [freightMode, setFreightMode] = useState<'preset' | 'other'>(isOtherFreight && data.freight_terms ? 'other' : 'preset')
  const [refPricesOpen, setRefPricesOpen] = useState(false)

  function handleFreightSelect(value: string) {
    if (value === '__other__') {
      setFreightMode('other')
      onChange({ freight_terms: '' })
    } else {
      setFreightMode('preset')
      onChange({ freight_terms: value })
    }
  }

  return (
    <div>
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
        <h2 className="text-base font-semibold text-text-primary mb-1">Commercial Terms</h2>
        <p className="text-sm text-text-secondary mb-6">Define the commercial conditions for this enquiry.</p>

        {/* Title input at top */}
        <div className="mb-5">
          <label className="block text-sm font-medium text-text-primary mb-1.5">Enquiry Title *</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder="e.g. Q1 2026 Steel Procurement"
            className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Payment Terms</label>
            <input
              type="text"
              value={data.payment_terms || ''}
              onChange={(e) => onChange({ payment_terms: e.target.value })}
              placeholder="e.g. Net 30 days"
              className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Freight Terms</label>
            <select
              value={freightMode === 'other' ? '__other__' : (data.freight_terms || '')}
              onChange={(e) => handleFreightSelect(e.target.value)}
              className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
            >
              <option value="">Select freight terms</option>
              {FREIGHT_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
              <option value="__other__">Other</option>
            </select>
            {freightMode === 'other' && (
              <input
                type="text"
                value={data.freight_terms || ''}
                onChange={(e) => onChange({ freight_terms: e.target.value })}
                placeholder="Specify freight terms"
                className="w-full h-9 px-3 mt-2 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Delivery Lead Time</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={data.delivery_lead_time_days ?? ''}
                onChange={(e) => onChange({ delivery_lead_time_days: e.target.value ? parseInt(e.target.value) : null })}
                min="1"
                max="365"
                placeholder="e.g. 30"
                className="flex-1 h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
              <span className="text-sm text-text-secondary font-medium">days</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Taxes & Duties</label>
            <input
              type="text"
              value={data.taxes_duties || ''}
              onChange={(e) => onChange({ taxes_duties: e.target.value })}
              placeholder="e.g. GST 18% extra"
              className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Warranty</label>
            <input
              type="text"
              value={data.warranty || ''}
              onChange={(e) => onChange({ warranty: e.target.value })}
              placeholder="e.g. 12 months from delivery"
              className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Offer Validity</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={data.offer_validity_days ?? ''}
                onChange={(e) => onChange({ offer_validity_days: e.target.value ? parseInt(e.target.value) : null })}
                min="1"
                max="365"
                placeholder="e.g. 60"
                className="flex-1 h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
              <span className="text-sm text-text-secondary font-medium">days</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">Packing & Forwarding</label>
            <input
              type="text"
              value={data.packing_forwarding || ''}
              onChange={(e) => onChange({ packing_forwarding: e.target.value })}
              placeholder="e.g. Extra at actual"
              className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
            />
          </div>
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-text-primary mb-1.5">Special Conditions</label>
          <textarea
            value={data.special_conditions || ''}
            onChange={(e) => onChange({ special_conditions: e.target.value })}
            placeholder="Any special conditions or notes..."
            rows={3}
            className="w-full px-3 py-2 rounded-DEFAULT border border-grey-200 text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors resize-none"
          />
        </div>
      </div>

      {/* Collapsible Reference Prices */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card mt-5 overflow-hidden">
        <button
          type="button"
          onClick={() => setRefPricesOpen(!refPricesOpen)}
          className="w-full flex items-center justify-between px-6 py-4 hover:bg-bg-subtle transition-colors"
        >
          <span className="text-sm font-medium text-text-primary">Reference prices (optional)</span>
          {refPricesOpen ? <CaretUp size={16} className="text-text-secondary" /> : <CaretDown size={16} className="text-text-secondary" />}
        </button>
        {refPricesOpen && (
          <div className="px-6 pb-4 border-t border-grey-200">
            <p className="text-xs text-text-secondary mt-3 mb-3">
              Used to calculate savings % in KPI analytics. Not shown to suppliers.
            </p>
            {data.items.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-grey-200">
                    <th className="text-left py-2 text-xs font-medium text-text-secondary">Item</th>
                    <th className="text-right py-2 text-xs font-medium text-text-secondary">Last Purchase Price</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-grey-100 last:border-0">
                      <td className="py-2 text-text-primary">{item.description || `Item ${item.sl_no}`}</td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          value={item.last_price ?? ''}
                          onChange={(e) => {
                            const updated = [...data.items]
                            updated[idx] = { ...updated[idx], last_price: e.target.value ? parseFloat(e.target.value) : null }
                            onChange({ items: updated })
                          }}
                          min="0"
                          step="any"
                          placeholder="--"
                          className="w-28 h-8 px-2 text-right rounded-DEFAULT border border-grey-200 text-sm font-mono text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-text-secondary">Add items in Step 1 first.</p>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button onClick={onBack} className="h-9 px-4 rounded-DEFAULT border border-grey-200 text-sm font-medium text-text-secondary hover:bg-bg-subtle transition-colors">
          Back
        </button>
        <button onClick={onNext} className="h-9 px-6 rounded-DEFAULT bg-blue text-white text-sm font-medium hover:bg-blue-hover transition-colors">
          Continue
        </button>
      </div>
    </div>
  )
}
