import React, { useState, useRef, useEffect } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { cn } from '../../utils/cn'

export interface SelectOption {
  value: string
  label: string
}

export interface SelectProps {
  options: SelectOption[]
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  label?: string
  error?: string
  helperText?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = 'Select an option',
      label,
      error,
      helperText,
      required,
      disabled,
      className,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const containerRef = useRef<HTMLDivElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)

    const selectId = React.useId()
    const errorId = `${selectId}-error`
    const helperId = `${selectId}-helper`

    const showSearch = options.length > 8
    const filteredOptions = options.filter((opt) =>
      opt.label.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const selectedOption = options.find((opt) => opt.value === value)

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setIsOpen(false)
        }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Handle dropdown positioning
    const [dropdownPosition, setDropdownPosition] = useState<'bottom' | 'top'>('bottom')
    useEffect(() => {
      if (isOpen && containerRef.current && dropdownRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        const dropdownHeight = dropdownRef.current.offsetHeight
        const spaceBelow = window.innerHeight - containerRect.bottom
        
        if (spaceBelow < dropdownHeight && containerRect.top > dropdownHeight) {
          setDropdownPosition('top')
        } else {
          setDropdownPosition('bottom')
        }
      }
    }, [isOpen, filteredOptions.length])

    return (
      <div className="flex flex-col w-full relative" ref={containerRef}>
        {label && (
          <label className="text-sm font-medium text-text-primary mb-1.5">
            {label}
            {required && (
              <span className="text-red ml-1" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <div
          ref={ref}
          className={cn(
            'relative flex items-center justify-between h-10 px-3 rounded-DEFAULT border bg-white text-base transition-all duration-150 ease-out outline-none cursor-pointer',
            isOpen ? 'border-blue ring-[3px] ring-blue/30' : error ? 'border-red' : 'border-border',
            disabled && 'bg-bg-subtle text-text-tertiary cursor-not-allowed',
            className
          )}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          tabIndex={disabled ? -1 : 0}
          role="combobox"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (!disabled) setIsOpen(!isOpen)
            }
          }}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
          aria-invalid={!!error}
          aria-describedby={cn(error && errorId, !error && helperText && helperId) || undefined}
        >
          <span className={cn('truncate', !selectedOption && 'text-text-tertiary')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
          <CaretDown
            size={16}
            className={cn('text-text-secondary transition-transform duration-200', isOpen && 'rotate-180')}
          />
        </div>

        {isOpen && (
          <div
            ref={dropdownRef}
            className={cn(
              'absolute z-50 w-full bg-white rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.12),0_1px_4px_rgba(0,0,0,0.08)] border border-border overflow-hidden',
              dropdownPosition === 'top' ? 'bottom-full mb-1' : 'top-full mt-1'
            )}
          >
            {showSearch && (
              <div className="p-2 border-b border-border">
                <input
                  type="text"
                  className="w-full h-8 px-2 text-sm border border-border rounded outline-none focus:border-blue focus:ring-1 focus:ring-blue"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              </div>
            )}
            <ul
              className="max-h-[280px] overflow-y-auto py-1"
              role="listbox"
            >
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-text-secondary text-center">
                  No results found
                </li>
              ) : (
                filteredOptions.map((option) => (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={option.value === value}
                    className={cn(
                      'flex items-center justify-between h-10 px-3 text-sm cursor-pointer transition-colors',
                      option.value === value
                        ? 'bg-blue-light text-blue font-medium'
                        : 'text-text-primary hover:bg-bg-subtle'
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      onChange?.(option.value)
                      setIsOpen(false)
                      setSearchQuery('')
                    }}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value && <Check size={16} weight="bold" />}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}

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

Select.displayName = 'Select'
