import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Clock,
  TrendDown,
  UsersThree,
  ChartLine,
  ChartBar,
} from '@phosphor-icons/react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { getBuyerKpis, getBuyerRfqs } from '../../api/rfq.api'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatNumber, formatDateTime } from '../../utils/format'

function getDefaultDates() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 90)
  return {
    from: start.toISOString().slice(0, 10),
    to: end.toISOString().slice(0, 10),
  }
}

function KpiCard({ label, value, unit, subtitle, icon: Icon, isLoading }: {
  label: string
  value: string | number | null
  unit?: string
  subtitle?: string
  icon: React.ElementType
  isLoading: boolean
}) {
  return (
    <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm font-medium text-text-secondary">{label}</span>
        <Icon size={20} className="text-text-secondary" aria-hidden="true" />
      </div>
      {isLoading ? (
        <Skeleton width={80} height={36} borderRadius={6} />
      ) : (
        <>
          <div className="font-mono text-2xl font-bold text-text-primary tracking-tight">
            {value != null ? value : '--'}
            {value != null && unit && <span className="text-sm font-normal text-text-secondary ml-1">{unit}</span>}
          </div>
          {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </>
      )}
    </div>
  )
}

export function KpiDashboard() {
  const navigate = useNavigate()
  const defaults = getDefaultDates()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [appliedParams, setAppliedParams] = useState<{ from?: string; to?: string }>({
    from: defaults.from,
    to: defaults.to,
  })

  const { data: kpis, isLoading } = useQuery({
    queryKey: ['buyer-kpis', appliedParams.from, appliedParams.to],
    queryFn: () => getBuyerKpis(appliedParams),
  })

  const { data: rfqs } = useQuery({
    queryKey: ['buyer-rfqs'],
    queryFn: () => getBuyerRfqs(),
  })

  function applyDates() {
    setAppliedParams({ from: from || undefined, to: to || undefined })
  }

  function setPreset(days: number) {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - days)
    const f = start.toISOString().slice(0, 10)
    const t = end.toISOString().slice(0, 10)
    setFrom(f)
    setTo(t)
    setAppliedParams({ from: f, to: t })
  }

  const trendData = useMemo(() => {
    if (!rfqs || rfqs.length === 0) return []
    const sorted = [...rfqs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    return sorted.slice(-12).map((r) => ({
      name: new Date(r.created_at).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }),
      rfq_number: r.rfq_number,
      value: kpis?.cycle_time_hours ?? null,
    }))
  }, [rfqs, kpis])

  return (
    <div>
      <h1 className="text-xl font-bold text-text-primary tracking-tight mb-6">Procurement Analytics</h1>

      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-4 mb-6">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-blue/20 focus:border-blue"
            />
          </div>
          <button
            onClick={applyDates}
            className="h-9 px-4 rounded-DEFAULT bg-blue text-white text-sm font-medium hover:bg-blue-hover transition-colors"
          >
            Apply
          </button>
          <div className="flex gap-2 ml-auto">
            {[
              { label: '30d', days: 30 },
              { label: '90d', days: 90 },
              { label: 'Year', days: 365 },
            ].map((preset) => (
              <button
                key={preset.label}
                onClick={() => setPreset(preset.days)}
                className="h-9 px-3 rounded-DEFAULT border border-grey-200 text-sm text-text-secondary hover:bg-bg-subtle transition-colors"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label="Cycle Time"
          value={kpis?.cycle_time_hours != null ? formatNumber(kpis.cycle_time_hours, 1) : null}
          unit="hrs"
          subtitle="average"
          icon={Clock}
          isLoading={isLoading}
        />
        <KpiCard
          label="Savings"
          value={kpis?.savings_pct != null ? formatNumber(kpis.savings_pct, 1) : null}
          unit="%"
          subtitle="vs reference prices"
          icon={TrendDown}
          isLoading={isLoading}
        />
        <KpiCard
          label="Participation"
          value={kpis?.participation_ratio_pct != null ? formatNumber(kpis.participation_ratio_pct, 1) : null}
          unit="%"
          subtitle="of invited suppliers accepted"
          icon={UsersThree}
          isLoading={isLoading}
        />
        <KpiCard
          label="Price Convergence"
          value={kpis?.price_convergence_cv != null ? formatNumber(kpis.price_convergence_cv, 2) : null}
          unit="CV"
          subtitle="lower = more competitive"
          icon={ChartLine}
          isLoading={isLoading}
        />
      </div>

      <div className="bg-white rounded-lg border border-grey-200 shadow-card p-6 mb-6">
        <h2 className="text-base font-semibold text-text-primary mb-4">Cycle Time Trend</h2>
        {trendData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F5F5F7" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#6E6E73' }} />
              <YAxis tick={{ fontSize: 12, fill: '#6E6E73' }} />
              <Tooltip
                contentStyle={{
                  borderRadius: 8,
                  border: '1px solid #E5E5EA',
                  boxShadow: '0 4px 12px rgb(0 0 0 / 0.08)',
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#0071E3"
                strokeWidth={2}
                dot={{ r: 3, fill: '#0071E3' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-12 text-center">
            <ChartBar size={40} weight="duotone" className="mx-auto text-grey-300 mb-3" />
            <p className="text-sm text-text-secondary">No data available for the selected period.</p>
          </div>
        )}
      </div>

      {/* Per-RFQ Table */}
      <div className="bg-white rounded-lg border border-grey-200 shadow-card overflow-hidden">
        <div className="px-6 py-4 border-b border-grey-200">
          <h2 className="text-base font-semibold text-text-primary">
            Enquiry Breakdown
            {kpis && <span className="text-sm font-normal text-text-secondary ml-2">({kpis.rfq_count} enquiries)</span>}
          </h2>
        </div>
        {rfqs && rfqs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-subtle border-b border-grey-200">
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">RFQ Number</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider">Date</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Cycle Time</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Savings %</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">Participation</th>
                  <th className="px-5 py-2.5 text-xs font-semibold text-text-secondary uppercase tracking-wider text-right">CV</th>
                </tr>
              </thead>
              <tbody>
                {[...rfqs]
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((rfq) => (
                    <tr
                      key={rfq.id}
                      onClick={() => navigate(`/buyer/rfqs/${rfq.id}`)}
                      className="border-b border-grey-100 last:border-0 hover:bg-bg-subtle transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 font-mono text-sm text-blue hover:text-blue-hover">{rfq.rfq_number}</td>
                      <td className="px-5 py-3 text-sm text-text-secondary">{formatDateTime(rfq.created_at)}</td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-text-primary">
                        {kpis?.cycle_time_hours != null ? `${formatNumber(kpis.cycle_time_hours, 1)}h` : '--'}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-text-primary">
                        {kpis?.savings_pct != null ? `${formatNumber(kpis.savings_pct, 1)}%` : '--'}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-text-primary">
                        {kpis?.participation_ratio_pct != null ? `${formatNumber(kpis.participation_ratio_pct, 1)}%` : '--'}
                      </td>
                      <td className="px-5 py-3 text-sm text-right font-mono text-text-primary">
                        {kpis?.price_convergence_cv != null ? formatNumber(kpis.price_convergence_cv, 2) : '--'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center text-sm text-text-secondary">
            No enquiries found for the selected date range.
          </div>
        )}
      </div>
    </div>
  )
}
