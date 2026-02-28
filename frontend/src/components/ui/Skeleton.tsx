import React from 'react'
import { cn } from '../../utils/cn'

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  width?: string | number
  height?: string | number
  borderRadius?: string | number
}

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  ({ className, width, height, borderRadius, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative overflow-hidden bg-grey-200',
          !borderRadius && 'rounded-DEFAULT',
          className
        )}
        style={{
          width,
          height,
          borderRadius,
          ...style,
        }}
        {...props}
      >
        <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-grey-200 via-grey-100 to-grey-200" />
      </div>
    )
  }
)

Skeleton.displayName = 'Skeleton'
