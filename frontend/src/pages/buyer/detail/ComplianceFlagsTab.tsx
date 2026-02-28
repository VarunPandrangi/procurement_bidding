import { useQuery } from '@tanstack/react-query'
import { ShieldCheck, Warning, WarningCircle } from '@phosphor-icons/react'
import { getFlags, type ComplianceFlag } from '../../../api/rfq.api'
import { Badge } from '../../../components/ui/Badge'
import { Skeleton } from '../../../components/ui/Skeleton'
import { formatDateTime } from '../../../utils/format'
import { cn } from '../../../utils/cn'

interface ComplianceFlagsTabProps {
  rfqId: string
}

export function ComplianceFlagsTab({ rfqId }: ComplianceFlagsTabProps) {
  const { data: flags, isLoading } = useQuery({
    queryKey: ['rfq-flags', rfqId],
    queryFn: () => getFlags(rfqId),
  })

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} width="100%" height={80} borderRadius={8} />
        ))}
      </div>
    )
  }

  const activeFlags = flags?.filter((f) => f.is_active) ?? []

  if (activeFlags.length === 0) {
    return (
      <div className="py-16 text-center">
        <ShieldCheck size={48} weight="duotone" className="mx-auto mb-3" style={{ color: '#B8D4B8' }} />
        <p className="text-base font-medium text-text-primary">All clear</p>
        <p className="text-sm text-text-secondary mt-1">No compliance concerns identified.</p>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Active Flags ({activeFlags.length})
      </h3>
      <div className="space-y-3">
        {activeFlags.map((flag) => (
          <FlagCard key={flag.id} flag={flag} />
        ))}
      </div>
    </div>
  )
}

function FlagCard({ flag }: { flag: ComplianceFlag }) {
  const isWarning = flag.flag_type.toLowerCase().includes('warning')
  const isCritical = flag.flag_type.toLowerCase().includes('critical') || flag.flag_type.toLowerCase().includes('error')

  return (
    <div className={cn(
      'border rounded-DEFAULT p-4 border-l-4',
      isCritical ? 'border-l-red bg-red-light/20' :
      isWarning ? 'border-l-yellow bg-yellow-light/20' :
      'border-l-blue bg-blue-light/20',
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {isCritical ? (
            <WarningCircle size={20} weight="fill" className="text-red" />
          ) : (
            <Warning size={20} weight="fill" className={isWarning ? 'text-yellow' : 'text-blue'} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs text-text-secondary">{flag.flag_id}</span>
            <Badge variant={isCritical ? 'DECLINED' : isWarning ? 'PENDING' : 'PUBLISHED'}>
              {flag.flag_type}
            </Badge>
            {flag.affected_supplier_code && (
              <span className="text-xs text-text-secondary">
                Supplier: <span className="font-mono">{flag.affected_supplier_code}</span>
              </span>
            )}
            <span className="text-xs text-text-secondary ml-auto flex-shrink-0">
              {formatDateTime(flag.created_at)}
            </span>
          </div>
          <p className="text-sm text-text-primary">{flag.detail_text}</p>
          {flag.recommendation_text && (
            <p className="text-sm italic text-text-secondary mt-2">{flag.recommendation_text}</p>
          )}
        </div>
      </div>
    </div>
  )
}
