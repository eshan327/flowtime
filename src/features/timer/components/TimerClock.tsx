import { useEffect, useMemo, useState } from 'react'
import { MAX_SESSION_SECONDS } from '@/features/timer/stores/timerStore'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/utils'

interface TimerClockProps {
  phase: TimerPhase
  workSeconds: number
  breakTotal: number
  breakEndAt: Date | null
}

const RING_SIZE = 244
const RING_RADIUS = 108
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function TimerClock({ phase, workSeconds, breakTotal, breakEndAt }: TimerClockProps) {
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (phase !== 'breaking') return

    const update = () => {
      setNow(Date.now())
    }

    update()
    const interval = window.setInterval(update, 1000)
    return () => {
      window.clearInterval(interval)
    }
  }, [phase])

  const seconds = useMemo(() => {
    if (phase === 'working') return workSeconds

    if (phase === 'breaking' && breakEndAt) {
      return Math.max(0, Math.ceil((breakEndAt.getTime() - now) / 1000))
    }

    return 0
  }, [phase, workSeconds, breakEndAt, now])

  const colorClass = phase === 'breaking' ? 'text-[#4ec9b0]' : 'text-ink-primary'
  const breakProgress =
    phase === 'breaking' && breakTotal > 0 ? Math.min(1, Math.max(0, 1 - seconds / breakTotal)) : 0
  const breakDashOffset = RING_CIRCUMFERENCE * (1 - breakProgress)
  const workProgress = Math.min(1, workSeconds / MAX_SESSION_SECONDS)

  return (
    <div className="relative flex w-full flex-col items-center">
      {phase === 'breaking' ? (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2"
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          width={RING_SIZE}
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            opacity={0.25}
            r={RING_RADIUS}
            stroke="#4ec9b0"
            strokeWidth={6}
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            fill="none"
            r={RING_RADIUS}
            stroke="#4ec9b0"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={breakDashOffset}
            strokeLinecap="round"
            strokeWidth={6}
            style={{ transition: 'stroke-dashoffset 300ms linear' }}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>
      ) : null}

      <p
        className={`text-7xl font-light tracking-tight transition-colors duration-400 md:text-8xl ${colorClass}`}
      >
        {formatClock(seconds)}
      </p>

      {phase === 'working' ? (
        <span className="absolute -right-4 top-1/2 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-amber-700/80" />
      ) : null}

      {phase === 'working' ? (
        <div className="mt-4 w-full max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-surface-border/70">
            <div
              className="h-full rounded-full bg-amber-600/80 transition-all duration-500"
              style={{ width: `${workProgress * 100}%` }}
            />
          </div>
          <p className="mt-1 text-center text-[11px] uppercase tracking-[0.08em] text-ink-tertiary">
            Session progress toward 6h cap
          </p>
        </div>
      ) : null}
    </div>
  )
}
