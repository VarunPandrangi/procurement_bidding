import React from 'react'
import { cn } from '../../utils/cn'

export type BadgeVariant = 
  | 'DRAFT' | 'PUBLISHED' | 'ACTIVE' | 'CLOSED' | 'AWARDED'
  | 'PENDING' | 'ACCEPTED' | 'DECLINED'
  | 'EXCELLENT' | 'STABLE' | 'RISKY'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant: BadgeVariant
  children?: React.ReactNode
}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, children, ...props }, ref) => {
    const variants: Record<BadgeVariant, string> = {
      // RFQ Status
      DRAFT: 'bg-bg-subtle text-grey-600',
      PUBLISHED: 'bg-blue-light text-blue',
      ACTIVE: 'bg-green-light text-green',
      CLOSED: 'bg-bg-subtle text-grey-800',
      AWARDED: 'bg-[#EDE7F6] text-[#5E35B1]',
      
      // Supplier Participation
      PENDING: 'bg-yellow-light text-yellow',
      ACCEPTED: 'bg-green-light text-green',
      DECLINED: 'bg-red-light text-red',
      
      // Credibility
      EXCELLENT: 'bg-green-light text-green',
      STABLE: 'bg-yellow-light text-yellow',
      RISKY: 'bg-red-light text-red',
    }

    return (
      <span
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center px-2.5 py-[3px] rounded-full text-xs font-medium uppercase tracking-[0.05em]',
          variants[variant],
          className
        )}
        {...props}
      >
        {children ?? variant}
      </span>
    )
  }
)

Badge.displayName = 'Badge'
