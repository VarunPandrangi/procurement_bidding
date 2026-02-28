import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Play,
  FloppyDisk,
  ArrowRight,
  Flask,
  Buildings,
  Package,
} from '@phosphor-icons/react'
import {
  getBuyerRfq,
  runSimulation,
  type SimulationInput,
  type SimulationResult,
  type RfqDetail,
} from '../../api/rfq.api'
import { Button } from '../../components/ui/Button'
import { Skeleton } from '../../components/ui/Skeleton'
import { useToast } from '../../store/toastStore'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'

type SimMode = 'single_supplier' | 'item_split' | 'category_split'

interface SavedScenario {
  id: number
  label: string
  result: SimulationResult
}

export function AwardSimulation() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()

  const [mode, setMode] = useState<SimMode>('single_supplier')
  const [selectedSupplierId, setSelectedSupplierId] = useState('')
  const [itemAllocations, setItemAllocations] = useState<Record<string, string>>({})
  const [latestResult, setLatestResult] = useState<SimulationResult | null>(null)
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([])

  const { data: rfq, isLoading } = useQuery({
    queryKey: ['buyer-rfq', id],
    queryFn: () => getBuyerRfq(id!),
    enabled: !!id,
  })

  const simMutation = useMutation({
    mutationFn: (payload: SimulationInput) => runSimulation(id!, payload),
    onSuccess: (result) => {
      setLatestResult(result)
      toast.success('Simulation complete')
    },
    onError: () => toast.error('Simulation failed'),
  })

  function handleRun() {
    if (mode === 'single_supplier') {
      if (!selectedSupplierId) {
        toast.error('Select a supplier')
        return
      }
      simMutation.mutate({ mode: 'single_supplier', supplier_id: selectedSupplierId })
    } else if (mode === 'item_split') {
      const items = Object.entries(itemAllocations)
        .filter(([, sid]) => sid)
        .map(([rfq_item_id, supplier_id]) => ({ rfq_item_id, supplier_id }))
      if (items.length === 0) {
        toast.error('Allocate at least one item')
        return
      }
      simMutation.mutate({ mode: 'item_split', items })
    } else {
      const items = Object.entries(itemAllocations)
        .filter(([, sid]) => sid)
        .map(([rfq_item_id, supplier_id]) => ({ rfq_item_id, supplier_id }))
      if (items.length === 0) {
        toast.error('Allocate at least one item')
        return
      }
      // For category_split, group by supplier
      const grouped: Record<string, string[]> = {}
      items.forEach(({ rfq_item_id, supplier_id }) => {
        if (!grouped[supplier_id]) grouped[supplier_id] = []
        grouped[supplier_id].push(rfq_item_id)
      })
      const categories = Object.entries(grouped).map(([supplier_id, item_ids]) => ({
        item_ids,
        supplier_id,
      }))
      simMutation.mutate({ mode: 'category_split', categories })
    }
  }

  function handleSave() {
    if (!latestResult) return
    setSavedScenarios((prev) => [
      ...prev,
      {
        id: Date.now(),
        label: `Scenario ${prev.length + 1} (${latestResult.mode})`,
        result: latestResult,
      },
    ])
    toast.success('Scenario saved')
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton width="100%" height={48} borderRadius={8} />
        <Skeleton width="100%" height={400} borderRadius={8} />
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

  return (
    <div>
      <div className="mb-6">
        <Link to={`/buyer/rfqs/${id}`} className="text-sm text-text-secondary hover:text-text-primary">
          &larr; Back to {rfq.rfq_number}
        </Link>
        <h1 className="text-xl font-bold text-text-primary tracking-tight mt-2">Award Simulation</h1>
      </div>

      <div className="flex gap-6">
        {/* Left Panel */}
        <div className="w-[380px] flex-shrink-0 space-y-4">
          {/* Mode Selector */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-card p-4">
            <h3 className="text-sm font-semibold text-text-primary mb-3">Simulation Mode</h3>
            <div className="flex rounded-DEFAULT border border-grey-200 overflow-hidden">
              {([
                { id: 'single_supplier' as const, label: 'Single Supplier' },
                { id: 'item_split' as const, label: 'Item Split' },
                { id: 'category_split' as const, label: 'Category Split' },
              ]).map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={cn(
                    'flex-1 py-2 text-sm font-medium transition-colors',
                    mode === m.id
                      ? 'bg-blue text-white'
                      : 'bg-white text-text-secondary hover:bg-bg-subtle',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Inputs */}
          <div className="bg-white rounded-lg border border-grey-200 shadow-card p-4">
            {mode === 'single_supplier' ? (
              <SingleSupplierInputs
                rfq={rfq}
                selected={selectedSupplierId}
                onSelect={setSelectedSupplierId}
              />
            ) : (
              <ItemSplitInputs
                rfq={rfq}
                allocations={itemAllocations}
                onAllocate={setItemAllocations}
              />
            )}

            <Button
              className="w-full mt-4"
              onClick={handleRun}
              isLoading={simMutation.isPending}
            >
              <Play size={16} className="mr-1" /> Run Simulation
            </Button>
          </div>
        </div>

        {/* Right Panel */}
        <div className="flex-1 space-y-4">
          {latestResult ? (
            <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-text-primary">Simulation Result</h3>
                <Button variant="secondary" size="sm" onClick={handleSave}>
                  <FloppyDisk size={16} className="mr-1" /> Save Scenario
                </Button>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <ResultStat label="Total Cost" value={formatCurrency(latestResult.total_procurement_cost)} />
                <ResultStat
                  label="vs Best L1"
                  value={`${latestResult.delta_vs_l1_total >= 0 ? '+' : ''}${formatCurrency(latestResult.delta_vs_l1_total)}`}
                />
                <ResultStat
                  label="Delivery"
                  value={latestResult.delivery_outcome_days != null ? `${latestResult.delivery_outcome_days}d` : '--'}
                />
                <ResultStat label="Suppliers" value={String(latestResult.unique_supplier_count)} />
              </div>

              {latestResult.per_supplier_breakdown.length > 0 && (
                <div className="border border-grey-200 rounded-DEFAULT overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-bg-subtle">
                        <th className="px-4 py-2 text-left font-medium text-text-secondary">Supplier</th>
                        <th className="px-4 py-2 text-right font-medium text-text-secondary">Items</th>
                        <th className="px-4 py-2 text-right font-medium text-text-secondary">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-grey-100">
                      {latestResult.per_supplier_breakdown.map((s) => (
                        <tr key={s.supplier_code}>
                          <td className="px-4 py-2 font-mono text-xs">{s.supplier_code}</td>
                          <td className="px-4 py-2 text-right">{s.items_awarded_count}</td>
                          <td className="px-4 py-2 text-right font-mono">{formatCurrency(s.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-grey-200 shadow-card p-12 text-center">
              <Flask size={48} weight="duotone" className="mx-auto text-grey-300 mb-3" />
              <p className="text-base font-medium text-grey-800">No simulation run yet</p>
              <p className="text-sm text-text-secondary mt-1">
                Build a scenario on the left and run simulation to see results.
              </p>
            </div>
          )}

          {/* Saved Scenarios */}
          {savedScenarios.length >= 2 && (
            <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-text-primary">Scenario Comparison</h3>
                <button
                  onClick={() => setSavedScenarios([])}
                  className="text-xs text-red hover:text-red-hover transition-colors"
                >
                  Clear scenarios
                </button>
              </div>
              <div className="border border-grey-200 rounded-DEFAULT overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg-subtle">
                      <th className="px-4 py-2 text-left font-medium text-text-secondary">Scenario</th>
                      <th className="px-4 py-2 text-right font-medium text-text-secondary">Total Cost</th>
                      <th className="px-4 py-2 text-right font-medium text-text-secondary">vs L1</th>
                      <th className="px-4 py-2 text-right font-medium text-text-secondary">Suppliers</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grey-100">
                    {(() => {
                      const lowestCost = Math.min(...savedScenarios.map((s) => s.result.total_procurement_cost))
                      return savedScenarios.map((sc) => (
                        <tr
                          key={sc.id}
                          className={sc.result.total_procurement_cost === lowestCost ? 'bg-green-light/30' : ''}
                        >
                          <td className="px-4 py-2 text-text-primary">{sc.label}</td>
                          <td className="px-4 py-2 text-right font-mono">{formatCurrency(sc.result.total_procurement_cost)}</td>
                          <td className="px-4 py-2 text-right font-mono">{formatCurrency(sc.result.delta_vs_l1_total)}</td>
                          <td className="px-4 py-2 text-right">{sc.result.unique_supplier_count}</td>
                        </tr>
                      ))
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {latestResult && (
            <Button
              className="w-full"
              onClick={() => navigate(`/buyer/rfqs/${id}/award`)}
            >
              Proceed to Award Finalisation <ArrowRight size={16} className="ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

function SingleSupplierInputs({ rfq, selected, onSelect }: {
  rfq: RfqDetail
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-text-primary mb-2">Select Supplier</h4>
      <div className="space-y-1 max-h-[300px] overflow-y-auto">
        {rfq.suppliers.map((s) => (
          <label
            key={s.supplier_id}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-DEFAULT cursor-pointer transition-colors',
              selected === s.supplier_id ? 'bg-blue-light' : 'hover:bg-bg-subtle',
            )}
          >
            <input
              type="radio"
              name="supplier"
              checked={selected === s.supplier_id}
              onChange={() => onSelect(s.supplier_id)}
              className="text-blue"
            />
            <Buildings size={16} className="text-text-secondary" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary truncate">{s.company_name}</p>
              <p className="text-xs text-text-secondary font-mono">{s.supplier_code}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

function ItemSplitInputs({ rfq, allocations, onAllocate }: {
  rfq: RfqDetail
  allocations: Record<string, string>
  onAllocate: (a: Record<string, string>) => void
}) {
  return (
    <div>
      <h4 className="text-sm font-medium text-text-primary mb-2">Allocate Items</h4>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {rfq.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <Package size={14} className="text-text-secondary flex-shrink-0" />
            <span className="text-xs text-text-primary flex-1 truncate">{item.description}</span>
            <select
              value={allocations[item.id] || ''}
              onChange={(e) => onAllocate({ ...allocations, [item.id]: e.target.value })}
              className="h-8 px-2 rounded-DEFAULT border border-grey-200 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20"
            >
              <option value="">--</option>
              {rfq.suppliers.map((s) => (
                <option key={s.supplier_id} value={s.supplier_id}>
                  {s.supplier_code}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-text-secondary mb-1">{label}</p>
      <p className="text-lg font-bold text-text-primary font-mono">{value}</p>
    </div>
  )
}
