import { useState, useMemo } from 'react'
import { Info, CheckCircle, WarningCircle } from '@phosphor-icons/react'
import { cn } from '../../../utils/cn'
import type { RfqFormData } from '../rfqFormSchema'

interface StepBiddingRulesProps {
  data: RfqFormData
  onChange: (partial: Partial<RfqFormData>) => void
  onNext: () => void
  onBack: () => void
}

export function StepBiddingRules({ data, onChange, onNext, onBack }: StepBiddingRulesProps) {
  const [useWeights, setUseWeights] = useState(
    (data.weight_delivery ?? 0) > 0 || (data.weight_payment ?? 0) > 0
  )

  const weightSum = (data.weight_price ?? 0) + (data.weight_delivery ?? 0) + (data.weight_payment ?? 0)
  const isWeightValid = !useWeights || weightSum === 100

  const dateErrors = useMemo(() => {
    const errors: string[] = []
    if (data.bid_open_at) {
      const openDate = new Date(data.bid_open_at)
      if (openDate <= new Date()) {
        errors.push('Bid open time must be in the future')
      }
      if (data.bid_close_at) {
        const closeDate = new Date(data.bid_close_at)
        if (closeDate <= openDate) {
          errors.push('Close time must be after open time')
        }
      }
    }
    return errors
  }, [data.bid_open_at, data.bid_close_at])

  return (
    <div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Revision Controls */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
          <h2 className="text-base font-semibold text-text-primary mb-4">Revision Controls</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Max Revisions
                <InfoTooltip text="Number of times each supplier can revise their bid after initial submission" />
              </label>
              <input
                type="number"
                value={data.max_revisions ?? 5}
                onChange={(e) => onChange({ max_revisions: parseInt(e.target.value) || 5 })}
                min="1"
                max="20"
                className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Min Change %
                <InfoTooltip text="Each revision must change at least this % from their previous bid" />
              </label>
              <input
                type="number"
                value={data.min_change_percent ?? 1}
                onChange={(e) => onChange({ min_change_percent: parseFloat(e.target.value) || 1 })}
                min="0.01"
                max="100"
                step="0.01"
                className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Cooling Time (min)
                <InfoTooltip text="Suppliers must wait this many minutes between revisions" />
              </label>
              <input
                type="number"
                value={data.cooling_time_minutes ?? 15}
                onChange={(e) => onChange({ cooling_time_minutes: parseInt(e.target.value) || 0 })}
                min="0"
                max="1440"
                className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Bid Timing */}
        <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
          <h2 className="text-base font-semibold text-text-primary mb-4">Bid Timing</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Bid Opens</label>
              <input
                type="datetime-local"
                value={data.bid_open_at || ''}
                onChange={(e) => onChange({ bid_open_at: e.target.value })}
                className={cn(
                  'w-full h-9 px-3 rounded-DEFAULT border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 transition-colors',
                  data.bid_open_at && new Date(data.bid_open_at) <= new Date()
                    ? 'border-red focus:border-red'
                    : 'border-grey-200 focus:border-blue',
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Bid Closes</label>
              <input
                type="datetime-local"
                value={data.bid_close_at || ''}
                onChange={(e) => onChange({ bid_close_at: e.target.value })}
                className={cn(
                  'w-full h-9 px-3 rounded-DEFAULT border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 transition-colors',
                  data.bid_open_at && data.bid_close_at && new Date(data.bid_close_at) <= new Date(data.bid_open_at)
                    ? 'border-red focus:border-red'
                    : 'border-grey-200 focus:border-blue',
                )}
              />
            </div>
            {dateErrors.length > 0 && (
              <div className="space-y-1">
                {dateErrors.map((err) => (
                  <p key={err} className="text-xs text-red">{err}</p>
                ))}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Anti-Snipe Window (min)
                <InfoTooltip text="If a bid is submitted within this many minutes of closing, the window extends" />
              </label>
              <input
                type="number"
                value={data.anti_snipe_window_minutes ?? 5}
                onChange={(e) => onChange({ anti_snipe_window_minutes: parseInt(e.target.value) || 0 })}
                min="0"
                max="120"
                className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">
                Anti-Snipe Extension (min)
                <InfoTooltip text="Extension added when anti-snipe triggers" />
              </label>
              <input
                type="number"
                value={data.anti_snipe_extension_minutes ?? 3}
                onChange={(e) => onChange({ anti_snipe_extension_minutes: parseInt(e.target.value) || 0 })}
                min="0"
                max="60"
                className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Weighted Ranking */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6 mt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-text-primary">Weighted Ranking</h2>
            <p className="text-sm text-text-secondary mt-0.5">Rank suppliers on more than just price.</p>
          </div>
          <button
            onClick={() => {
              setUseWeights(!useWeights)
              if (!useWeights) {
                onChange({ weight_price: 60, weight_delivery: 25, weight_payment: 15 })
              } else {
                onChange({ weight_price: 100, weight_delivery: 0, weight_payment: 0 })
              }
            }}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              useWeights ? 'bg-blue' : 'bg-grey-200',
            )}
          >
            <div className={cn(
              'absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform',
              useWeights && 'translate-x-5',
            )} />
          </button>
        </div>

        {useWeights && (
          <div className="pt-4 border-t border-grey-200">
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Price Weight</label>
                <input
                  type="number"
                  value={data.weight_price ?? 60}
                  onChange={(e) => onChange({ weight_price: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Delivery Weight</label>
                <input
                  type="number"
                  value={data.weight_delivery ?? 25}
                  onChange={(e) => onChange({ weight_delivery: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Payment Weight</label>
                <input
                  type="number"
                  value={data.weight_payment ?? 15}
                  onChange={(e) => onChange({ weight_payment: parseFloat(e.target.value) || 0 })}
                  min="0"
                  max="100"
                  className="w-full h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary font-mono focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue transition-colors"
                />
              </div>
            </div>
            <div className={cn(
              'flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold',
              weightSum === 100
                ? 'bg-green-light text-green'
                : 'bg-red-light text-red',
            )}>
              {weightSum === 100 ? (
                <CheckCircle size={20} weight="fill" />
              ) : (
                <WarningCircle size={20} weight="fill" />
              )}
              <span className="font-mono text-lg">{weightSum}%</span>
              <span className="text-sm font-medium ml-1">
                {weightSum === 100 ? 'Weights balanced' : 'Must total exactly 100%'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-6">
        <button onClick={onBack} className="h-9 px-4 rounded-DEFAULT border border-grey-200 text-sm font-medium text-text-secondary hover:bg-bg-subtle transition-colors">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!isWeightValid || dateErrors.length > 0}
          className="h-9 px-6 rounded-DEFAULT bg-blue text-white text-sm font-medium hover:bg-blue-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  )
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative ml-1 group inline-block align-middle">
      <Info size={14} className="inline text-grey-400 cursor-help" />
      <span className="absolute left-full top-0 ml-2 hidden group-hover:block w-52 px-3 py-2 text-xs font-normal text-text-primary bg-white border border-grey-200 rounded-lg shadow-md z-20">
        {text}
      </span>
    </span>
  )
}
