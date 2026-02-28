import { useEffect, useRef, useState } from 'react'
import {
  Trophy,
  ArrowUp,
  ArrowDown,
  WarningCircle,
} from '@phosphor-icons/react'
import { cn } from '../../utils/cn'

// ─── Types ───────────────────────────────────────────
type RankColor = 'GREEN' | 'YELLOW' | 'RED'
type ProximityLabel = 'VERY_CLOSE' | 'CLOSE' | 'FAR' | null

interface RankDisplayWidgetProps {
  rankColor: RankColor
  proximityLabel: ProximityLabel
  revisionsRemaining: number
  maxRevisions: number
  coolingSecondsRemaining: number
  className?: string
}

// ─── Config Maps ─────────────────────────────────────
const ZONE_CONFIG: Record<RankColor, {
  bg: string; text: string; borderAccent: string
  icon: typeof Trophy; primary: string; secondary: string
}> = {
  GREEN: {
    bg: 'bg-[#1A9E3F]',
    text: 'text-white',
    borderAccent: 'border-[#1A9E3F]/20',
    icon: Trophy,
    primary: 'You are the most competitive',
    secondary: 'L1 · Best price across all items',
  },
  YELLOW: {
    bg: 'bg-[#FEF3C7]',
    text: 'text-[#92400E]',
    borderAccent: 'border-[#F5A623]/20',
    icon: ArrowUp,
    primary: 'You are close to the lead',
    secondary: 'L2 · Room to improve your position',
  },
  RED: {
    bg: 'bg-[#FDECEA]',
    text: 'text-[#7F1D1D]',
    borderAccent: 'border-[#D32F2F]/20',
    icon: ArrowDown,
    primary: 'You need to revise lower',
    secondary: 'L3+ · Consider a significant revision',
  },
}

const PROXIMITY_TEXT: Record<string, string> = {
  VERY_CLOSE: 'Very close · within 2%',
  CLOSE: 'Close · within 10%',
  FAR: 'Far · more than 10% gap',
}

// ─── Cooling Timer Hook ──────────────────────────────
function useCoolingCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(initialSeconds)

  useEffect(() => {
    setSeconds(initialSeconds)
  }, [initialSeconds])

  useEffect(() => {
    if (seconds <= 0) return
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [seconds > 0]) // eslint-disable-line react-hooks/exhaustive-deps

  const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
  const ss = (seconds % 60).toString().padStart(2, '0')
  return { seconds, display: `${mm}:${ss}` }
}

// ─── Component ───────────────────────────────────────
export function RankDisplayWidget({
  rankColor,
  proximityLabel,
  revisionsRemaining,
  maxRevisions,
  coolingSecondsRemaining,
  className,
}: RankDisplayWidgetProps) {
  const prevRankRef = useRef(rankColor)
  const prevProximityRef = useRef(proximityLabel)
  const [showUpdated, setShowUpdated] = useState(false)
  const [textVisible, setTextVisible] = useState(true)
  const cooling = useCoolingCountdown(coolingSecondsRemaining)

  const config = ZONE_CONFIG[rankColor]
  const Icon = config.icon

  // Detect rank changes → trigger "Updated" flash and text fade-in
  useEffect(() => {
    if (
      prevRankRef.current !== rankColor ||
      prevProximityRef.current !== proximityLabel
    ) {
      // text fade-in
      setTextVisible(false)
      requestAnimationFrame(() => setTextVisible(true))

      // "UPDATED" badge flash
      setShowUpdated(true)
      const timeout = setTimeout(() => setShowUpdated(false), 1500)

      prevRankRef.current = rankColor
      prevProximityRef.current = proximityLabel
      return () => clearTimeout(timeout)
    }
  }, [rankColor, proximityLabel])

  // Revision dots
  const dots = Array.from({ length: maxRevisions }, (_, i) => {
    const isFilled = i < revisionsRemaining
    return (
      <span
        key={i}
        className={cn(
          'inline-block w-2 h-2 rounded-full transition-colors duration-300',
          isFilled ? 'bg-blue' : 'bg-grey-300'
        )}
      />
    )
  })

  return (
    <div
      className={cn('relative rounded-lg min-h-[128px] overflow-hidden', className)}
      aria-live="polite"
      role="status"
    >
      {/* Updated flash badge */}
      <div
        className={cn(
          'absolute top-3 right-3 z-10 px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold tracking-wider',
          'bg-white/90 text-text-secondary',
          'transition-opacity duration-200',
          showUpdated ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
      >
        Updated
      </div>

      <div className="flex flex-col sm:flex-row">
        {/* ─── Left Zone (primary message) ──────────── */}
        <div
          className={cn(
            'flex-shrink-0 sm:w-[62%] p-6 flex flex-col justify-center gap-1 transition-colors duration-[400ms] ease-in-out',
            config.bg,
            config.text,
          )}
        >
          <Icon size={28} weight="duotone" className="mb-1" />
          <p
            className={cn(
              'text-lg font-bold leading-tight transition-opacity duration-300',
              textVisible ? 'opacity-100' : 'opacity-0'
            )}
          >
            {config.primary}
          </p>
          <p
            className={cn(
              'text-sm opacity-70 transition-opacity duration-300',
              textVisible ? 'opacity-70' : 'opacity-0'
            )}
          >
            {config.secondary}
          </p>
        </div>

        {/* ─── Right Zone (context) ─────────────────── */}
        <div
          className={cn(
            'flex-1 bg-white border-l-2 p-5 flex flex-col gap-4 transition-colors duration-[400ms] ease-in-out',
            config.borderAccent,
          )}
        >
          {/* Proximity (not shown for L1) */}
          {rankColor !== 'GREEN' && proximityLabel && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
                Distance from L1
              </span>
              <p className={cn('text-base font-semibold mt-0.5', config.text)}>
                {PROXIMITY_TEXT[proximityLabel] ?? proximityLabel}
              </p>
            </div>
          )}

          {/* Revisions remaining */}
          <div>
            <span className="text-[10px] uppercase tracking-wider text-text-secondary font-medium">
              Revisions left
            </span>
            <div className="flex items-center gap-2 mt-1">
              {revisionsRemaining === 0 ? (
                <span className="text-sm font-medium text-red flex items-center gap-1">
                  <WarningCircle size={14} weight="fill" />
                  No revisions remaining
                </span>
              ) : (
                <>
                  <span
                    className={cn(
                      'text-base font-semibold',
                      revisionsRemaining === 1 ? 'text-yellow' : 'text-text-primary'
                    )}
                  >
                    {revisionsRemaining} of {maxRevisions}
                  </span>
                  {revisionsRemaining === 1 && (
                    <WarningCircle size={14} weight="fill" className="text-yellow" />
                  )}
                </>
              )}
            </div>
            <div className="flex gap-1.5 mt-1.5">{dots}</div>
          </div>

          {/* Cooling countdown */}
          {cooling.seconds > 0 && (
            <div>
              <span className="text-[10px] uppercase tracking-wider text-[#C0392B] font-medium">
                Next revision in
              </span>
              <p className="font-mono text-2xl font-semibold text-[#C0392B] mt-0.5 tabular-nums">
                {cooling.display}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
