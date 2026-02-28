import { Check } from '@phosphor-icons/react'
import { cn } from '../../utils/cn'

type RfqStatus = 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'AWARDED'

const STATUSES: RfqStatus[] = ['DRAFT', 'PUBLISHED', 'ACTIVE', 'CLOSED', 'AWARDED']

interface StatusTimelineProps {
  currentStatus: RfqStatus
  variant?: 'full' | 'compact'
  className?: string
}

export function StatusTimeline({ currentStatus, variant = 'full', className }: StatusTimelineProps) {
  const currentIdx = STATUSES.indexOf(currentStatus)

  if (variant === 'compact') {
    return (
      <div className={cn('flex items-center gap-0.5 h-1.5 w-full', className)}>
        {STATUSES.map((status, idx) => (
          <div
            key={status}
            className={cn(
              'flex-1 h-full rounded-full transition-colors',
              idx < currentIdx ? 'bg-green' :
              idx === currentIdx ? 'bg-blue' :
              'bg-grey-200',
            )}
          />
        ))}
      </div>
    )
  }

  return (
    <div className={cn('flex items-center', className)}>
      {STATUSES.map((status, idx) => {
        const isPast = idx < currentIdx
        const isCurrent = idx === currentIdx
        const isFuture = idx > currentIdx

        return (
          <div key={status} className="flex items-center">
            {idx > 0 && (
              <div className={cn(
                'w-8 h-0.5 sm:w-12',
                isPast ? 'bg-green' : isCurrent ? 'bg-blue' : 'bg-grey-200'
              )} />
            )}
            <div className="flex flex-col items-center gap-1.5">
              <div className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                isPast && 'bg-green text-white',
                isCurrent && 'bg-blue text-white shadow-md',
                isFuture && 'bg-grey-200 text-grey-400',
              )}>
                {isPast ? <Check size={16} weight="bold" /> : idx + 1}
              </div>
              <span className={cn(
                'text-[10px] font-medium uppercase tracking-wider',
                isPast ? 'text-green' :
                isCurrent ? 'text-blue' :
                'text-grey-400',
              )}>
                {status}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
