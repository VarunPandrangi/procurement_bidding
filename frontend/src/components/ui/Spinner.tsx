import React from 'react'
import { cn } from '../../utils/cn'

export interface SpinnerProps extends React.SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg'
  color?: 'current' | 'white' | 'blue'
}

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ className, size = 'md', color = 'current', ...props }, ref) => {
    const sizes = {
      sm: 'w-4 h-4', // 16px
      md: 'w-6 h-6', // 24px
      lg: 'w-8 h-8', // 32px
    }

    const colors = {
      current: 'text-current',
      white: 'text-white',
      blue: 'text-blue',
    }

    return (
      <svg
        ref={ref}
        className={cn('animate-spin', sizes[size], colors[color], className)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        {...props}
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        ></circle>
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
    )
  }
)

Spinner.displayName = 'Spinner'
