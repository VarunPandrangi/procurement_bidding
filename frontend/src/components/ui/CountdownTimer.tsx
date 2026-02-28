import { useState, useEffect } from 'react'
import { cn } from '../../utils/cn'

interface CountdownTimerProps {
  targetDate: string | Date
  size?: 'sm' | 'md' | 'lg'
  compact?: boolean
  onExpired?: () => void
  className?: string
}

export function CountdownTimer({ targetDate, size = 'md', compact = false, onExpired, className }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => getRemaining(targetDate, compact))

  useEffect(() => {
    const interval = setInterval(() => {
      const r = getRemaining(targetDate, compact)
      setRemaining(r)
      if (r.total <= 0) {
        clearInterval(interval)
        onExpired?.()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [targetDate, onExpired, compact])

  if (remaining.total <= 0) {
    return (
      <span className={cn(
        'font-mono font-semibold text-red',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        size === 'lg' && 'text-lg',
        className,
      )}>
        Expired
      </span>
    )
  }

  const isWarning = remaining.total < 300_000 // < 5 min
  const isCritical = remaining.total < 60_000  // < 1 min

  return (
    <span className={cn(
      'font-mono font-semibold tabular-nums',
      size === 'sm' && 'text-xs',
      size === 'md' && 'text-sm',
      size === 'lg' && 'text-lg',
      isCritical ? 'text-red animate-[pulse_1s_ease-in-out_infinite]' :
      isWarning ? 'text-yellow animate-[pulse_2s_ease-in-out_infinite]' :
      'text-text-primary',
      className,
    )}>
      {remaining.display}
    </span>
  )
}

function getRemaining(target: string | Date, compact = false) {
  const end = new Date(target).getTime()
  const total = Math.max(0, end - Date.now())

  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1_000)

  let display: string
  if (compact) {
    if (total >= 3_600_000) {
      // >= 60 min: show HH:MM
      display = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    } else {
      // < 60 min: show MM:SS
      display = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
    }
  } else {
    display = [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':')
  }

  return { total, display }
}
