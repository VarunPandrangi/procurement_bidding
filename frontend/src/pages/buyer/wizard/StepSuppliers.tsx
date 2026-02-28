import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Buildings, MagnifyingGlass, X } from '@phosphor-icons/react'
import { getAvailableSuppliers } from '../../../api/rfq.api'
import { Badge, type BadgeVariant } from '../../../components/ui/Badge'
import { Skeleton } from '../../../components/ui/Skeleton'
import type { RfqFormData } from '../rfqFormSchema'

interface StepSuppliersProps {
  data: RfqFormData
  onChange: (partial: Partial<RfqFormData>) => void
  onNext: () => void
  onBack: () => void
}

export function StepSuppliers({ data, onChange, onNext, onBack }: StepSuppliersProps) {
  const [search, setSearch] = useState('')

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['available-suppliers'],
    queryFn: getAvailableSuppliers,
  })

  const filtered = useMemo(() => {
    if (!suppliers) return []
    if (!search.trim()) return suppliers
    const q = search.toLowerCase()
    return suppliers.filter(
      (s) =>
        s.company_name.toLowerCase().includes(q) ||
        s.unique_code.toLowerCase().includes(q),
    )
  }, [suppliers, search])

  const selected = data.supplier_ids

  function toggleSupplier(id: string) {
    if (selected.includes(id)) {
      onChange({ supplier_ids: selected.filter((s) => s !== id) })
    } else {
      onChange({ supplier_ids: [...selected, id] })
    }
  }

  function removeSupplier(id: string) {
    onChange({ supplier_ids: selected.filter((s) => s !== id) })
  }

  const selectedSuppliers = (suppliers ?? []).filter((s) => selected.includes(s.id))
  const isValid = selected.length >= 2

  return (
    <div>
      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-200 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Invite Suppliers</h2>
            <p className="text-sm text-text-secondary mt-1">Choose at least 2 suppliers to invite.</p>
          </div>
          <span className="text-sm text-text-secondary">{selected.length} selected</span>
        </div>

        {/* Selected chips */}
        {selectedSuppliers.length > 0 && (
          <div className="px-6 py-3 border-b border-grey-200 flex flex-wrap gap-2">
            {selectedSuppliers.map((s) => (
              <span
                key={s.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-blue-light text-blue rounded-full"
              >
                {s.company_name}
                <button onClick={() => removeSupplier(s.id)} className="hover:text-blue-hover">
                  <X size={12} weight="bold" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-3 border-b border-grey-200">
          <div className="relative">
            <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grey-400" />
            <input
              type="text"
              placeholder="Search suppliers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 rounded-DEFAULT border border-grey-200 bg-white text-sm text-text-primary placeholder:text-grey-400 focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
            />
          </div>
        </div>

        {/* List */}
        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton width={20} height={20} borderRadius={4} />
                  <Skeleton width={200} height={14} />
                  <Skeleton width={60} height={20} borderRadius={999} />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Buildings size={32} className="mx-auto text-grey-300 mb-2" />
              <p className="text-sm text-text-secondary">No suppliers found.</p>
            </div>
          ) : (
            filtered.map((supplier) => {
              const isChecked = selected.includes(supplier.id)
              return (
                <label
                  key={supplier.id}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-bg-subtle transition-colors cursor-pointer border-b border-grey-100 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleSupplier(supplier.id)}
                    className="w-4 h-4 rounded border-grey-200 text-blue focus:ring-blue/20"
                  />
                  <Buildings size={18} className="text-grey-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-text-primary">{supplier.company_name}</span>
                  </div>
                  <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-bg-subtle text-text-secondary">
                    {supplier.unique_code}
                  </span>
                  {supplier.credibility_class && (
                    <Badge variant={supplier.credibility_class as BadgeVariant} />
                  )}
                </label>
              )
            })
          )}
        </div>
      </div>

      {selected.length > 0 && (
        <p className="text-sm text-text-secondary mt-2">{selected.length} supplier{selected.length !== 1 ? 's' : ''} selected</p>
      )}
      {!isValid && selected.length > 0 && (
        <p className="text-sm text-red mt-2">Minimum 2 suppliers required to publish</p>
      )}

      <div className="flex items-center justify-between mt-6">
        <button onClick={onBack} className="h-9 px-4 rounded-DEFAULT border border-grey-200 text-sm font-medium text-text-secondary hover:bg-bg-subtle transition-colors">
          Back
        </button>
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
