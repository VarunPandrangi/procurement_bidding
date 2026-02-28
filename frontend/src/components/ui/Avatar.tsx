import React from 'react'
import { User } from '@phosphor-icons/react'
import { cn } from '../../utils/cn'

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string
  size?: 'sm' | 'md' | 'lg'
  color?: string
}

const sizeMap = {
  sm: 'w-8 h-8 text-[13px]',
  md: 'w-10 h-10 text-[15px]',
  lg: 'w-12 h-12 text-[17px]',
}

const iconSizeMap = {
  sm: 16,
  md: 20,
  lg: 24,
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ name, size = 'sm', color, className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-full flex items-center justify-center shrink-0 font-bold text-white',
          sizeMap[size],
          !color && 'bg-blue',
          className
        )}
        style={color ? { backgroundColor: color, ...style } : style}
        {...props}
      >
        {name ? (
          getInitials(name)
        ) : (
          <User size={iconSizeMap[size]} weight="bold" aria-hidden="true" />
        )}
      </div>
    )
  }
)

Avatar.displayName = 'Avatar'
