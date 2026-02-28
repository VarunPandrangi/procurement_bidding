import { Plus, Trash } from '@phosphor-icons/react'
import type { RfqFormData } from '../rfqFormSchema'

interface StepItemsProps {
  data: RfqFormData
  onChange: (partial: Partial<RfqFormData>) => void
  onNext: () => void
}

export function StepItems({ data, onChange, onNext }: StepItemsProps) {
  const items = data.items

  function updateItem(index: number, field: string, value: string | number | null) {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    )
    onChange({ items: updated })
  }

  function addItem() {
    onChange({
      items: [
        ...items,
        { sl_no: items.length + 1, description: '', specification: '', uom: '', quantity: 1, last_price: null },
      ],
    })
  }

  function removeItem(index: number) {
    const updated = items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sl_no: i + 1 }))
    onChange({ items: updated })
  }

  const isValid = items.length > 0 && items.every((item) => item.description.trim() && item.uom.trim() && item.quantity > 0)

  return (
    <div>
      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-200">
          <h2 className="text-base font-semibold text-text-primary">What are you procuring?</h2>
          <p className="text-sm text-text-secondary mt-1">Add the items you want suppliers to bid on.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-bg-subtle border-b border-grey-200">
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-16">Sl.</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Description *</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Specification</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-24">UOM *</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-24">Qty *</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-28">Last Price</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-28">Unit Price</th>
                <th className="px-4 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider w-24">Total</th>
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-grey-100 last:border-0">
                  <td className="px-4 py-2 font-mono text-sm text-text-secondary">{item.sl_no}</td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full h-8 px-2 bg-transparent border-b border-transparent text-sm text-text-primary placeholder:text-grey-400 focus:border-blue focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.specification || ''}
                      onChange={(e) => updateItem(idx, 'specification', e.target.value)}
                      placeholder="Optional"
                      className="w-full h-8 px-2 bg-transparent border-b border-transparent text-sm text-text-primary placeholder:text-grey-400 focus:border-blue focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.uom}
                      onChange={(e) => updateItem(idx, 'uom', e.target.value)}
                      placeholder="e.g. KG"
                      className="w-full h-8 px-2 bg-transparent border-b border-transparent text-sm text-text-primary placeholder:text-grey-400 focus:border-blue focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                      min="0"
                      step="any"
                      className="w-full h-8 px-2 bg-transparent border-b border-transparent text-sm text-text-primary font-mono focus:border-blue focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={item.last_price ?? ''}
                      onChange={(e) => updateItem(idx, 'last_price', e.target.value ? parseFloat(e.target.value) : null)}
                      min="0"
                      step="any"
                      placeholder="--"
                      className="w-full h-8 px-2 bg-transparent border-b border-transparent text-sm text-text-primary font-mono placeholder:text-grey-400 focus:border-blue focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs italic text-grey-400">Supplier fills</span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="text-xs italic text-grey-400">Auto</span>
                  </td>
                  <td className="px-4 py-2">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="p-1 rounded text-grey-400 hover:text-red hover:bg-red-light transition-colors"
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          onClick={addItem}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium text-text-secondary bg-[#FAFAFA] border-t border-dashed border-grey-200 hover:bg-bg-subtle transition-colors"
        >
          <Plus size={16} /> Add item
        </button>
      </div>

      <div className="flex items-center justify-between mt-6">
        <span className="text-sm text-text-secondary">
          {items.length} item{items.length !== 1 ? 's' : ''} added
        </span>
        <button
          onClick={onNext}
          disabled={!isValid}
          className="h-9 px-6 rounded-DEFAULT bg-blue text-white text-sm font-medium hover:bg-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
