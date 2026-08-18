import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/formatting'

interface TimerClockProps {
  phase: TimerPhase
  workSeconds: number
  breakTotal: number
  breakEndAt: Date | null
  accentColor?: string | null
}

export function TimerClock({
  phase,
  workSeconds,
  breakTotal,
  breakEndAt,
  accentColor,
}: TimerClockProps) {
  const [now, setNow] = useState(0)

  useEffect(() => {
    if (phase !== 'breaking') return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [phase])

  const seconds =
    phase === 'working'
      ? workSeconds
      : phase === 'breaking' && breakEndAt
        ? Math.max(0, Math.ceil((breakEndAt.getTime() - now) / 1000))
        : 0
  const progress = phase === 'breaking' && breakTotal > 0 ? breakTotal - seconds : undefined
  const accent = accentColor ?? DEFAULT_TASK_COLOR

  return (
    <div
      className="mx-auto flex w-full flex-col items-center justify-center py-7 md:py-8"
      style={{ '--timer-accent': accent } as CSSProperties}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-accent-primary">
        {phase === 'working' ? 'Focus' : phase === 'breaking' ? 'Recover' : 'Ready'}
      </p>
      <p className="mt-3 text-[80px] font-extralight leading-none tabular-nums tracking-[-0.07em] text-ink-primary sm:text-[88px] md:text-[96px]">
        {formatClock(seconds)}
      </p>
      {phase === 'breaking' ? (
        <progress
          aria-label="Break progress"
          className="timer-progress mt-6 h-1 w-40"
          max={breakTotal}
          value={progress}
        />
      ) : null}
    </div>
  )
}
