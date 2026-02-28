import { Check } from '@phosphor-icons/react'
import { cn } from '../../utils/cn'

interface StepProgressIndicatorProps {
  steps: { label: string }[]
  currentStep: number
  completedSteps: number[]
  className?: string
}

export function StepProgressIndicator({ steps, currentStep, completedSteps, className }: StepProgressIndicatorProps) {
  return (
    <div className={cn(
      'sticky top-0 z-10 bg-white border-b border-grey-200 py-4 px-6',
      className,
    )}>
      <div className="flex items-center justify-center">
        {steps.map((step, idx) => {
          const isCompleted = completedSteps.includes(idx)
          const isCurrent = idx === currentStep
          const isFuture = !isCompleted && !isCurrent

          return (
            <div key={idx} className="flex items-center">
              {idx > 0 && (
                <div className={cn(
                  'w-12 sm:w-20 h-0.5',
                  completedSteps.includes(idx - 1) && (isCompleted || isCurrent) ? 'bg-green' : 'bg-grey-200'
                )} />
              )}
              <div className="flex flex-col items-center gap-1.5">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all',
                  isCompleted && 'bg-green text-white',
                  isCurrent && 'bg-blue text-white shadow-md ring-4 ring-blue/20',
                  isFuture && 'bg-grey-200 text-grey-400',
                )}>
                  {isCompleted ? <Check size={16} weight="bold" /> : idx + 1}
                </div>
                <span className={cn(
                  'text-[10px] font-medium uppercase tracking-wider whitespace-nowrap',
                  isCompleted ? 'text-green' :
                  isCurrent ? 'text-blue' :
                  'text-grey-400',
                )}>
                  {step.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
