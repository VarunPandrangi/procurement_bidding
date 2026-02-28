import React from 'react'
import { Spinner } from './Spinner'
import { cn } from '../../utils/cn'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = 'relative inline-flex items-center justify-center rounded-DEFAULT font-medium transition-all duration-150 ease-out focus:outline-none focus:ring-2 focus:ring-blue-DEFAULT/30 focus:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-inherit disabled:hover:text-inherit disabled:active:scale-100'
    
    const variants = {
      primary: 'bg-blue text-white hover:bg-blue-hover active:scale-[0.98]',
      secondary: 'bg-white text-text-primary border border-border hover:bg-bg-subtle active:scale-[0.98]',
      danger: 'bg-white text-red border border-red hover:bg-red-light active:scale-[0.98]',
      ghost: 'bg-transparent text-blue hover:bg-blue-light active:scale-[0.98]',
    }

    const sizes = {
      sm: 'h-[30px] px-3 text-sm',
      md: 'h-[36px] px-4 text-sm',
      lg: 'h-[44px] px-6 text-base',
    }

    return (
      <button
        ref={ref}
        className={cn(baseStyles, variants[variant], sizes[size], isLoading && 'pointer-events-none', className)}
        disabled={disabled || isLoading}
        aria-disabled={disabled || isLoading}
        aria-busy={isLoading}
        {...props}
      >
        {isLoading && <Spinner size="sm" className="absolute" color={variant === 'primary' ? 'white' : 'current'} />}
        <span className={cn('flex items-center justify-center gap-2', isLoading && 'opacity-0')}>{children}</span>
      </button>
    )
  }
)

Button.displayName = 'Button'
