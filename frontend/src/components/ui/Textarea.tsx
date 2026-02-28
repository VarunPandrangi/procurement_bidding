import React from 'react'
import { cn } from '../../utils/cn'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
  helperText?: string
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, helperText, required, disabled, id, ...props }, ref) => {
    const textareaId = id || React.useId()
    const errorId = `${textareaId}-error`
    const helperId = `${textareaId}-helper`

    return (
      <div className="flex flex-col w-full">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-text-primary mb-1.5">
            {label}
            {required && (
              <span className="text-red ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          aria-describedby={cn(error && errorId, !error && helperText && helperId) || undefined}
          className={cn(
            'min-h-[80px] p-3 rounded-DEFAULT border bg-white text-base transition-all duration-150 ease-out outline-none resize-y',
            'placeholder:text-text-tertiary',
            'focus:border-blue focus:ring-[3px] focus:ring-blue/30',
            error ? 'border-red focus:border-red focus:ring-red/30' : 'border-border',
            disabled && 'bg-bg-subtle text-text-tertiary cursor-not-allowed',
            className
          )}
          {...props}
        />
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-red">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={helperId} className="mt-1.5 text-xs text-text-secondary">
            {helperText}
          </p>
        )}
      </div>
    )
  }
)

Textarea.displayName = 'Textarea'
