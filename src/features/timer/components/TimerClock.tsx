import { useEffect, useState, type CSSProperties } from 'react'
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
  const accent = accentColor ?? '#8bd5ca'

  return (
    <div
      className="relative mx-auto flex h-56 w-full max-w-[23rem] flex-col items-center justify-center overflow-hidden rounded-xl border border-surface-border bg-surface-raised px-8"
      style={{ '--timer-accent': accent } as CSSProperties}
    >
      <p className="relative text-7xl font-light tabular-nums tracking-[-0.06em] text-ink-primary md:text-8xl">
        {formatClock(seconds)}
      </p>
      <p className="relative mt-4 text-xs uppercase tracking-[0.2em] text-ink-tertiary">
        {phase === 'working' ? 'Focus' : phase === 'breaking' ? 'Recover' : 'Ready'}
      </p>
      <progress
        aria-label={phase === 'breaking' ? 'Break progress' : 'Focus timer active'}
        className="timer-progress relative mt-5 h-1.5 w-full"
        max={phase === 'breaking' ? breakTotal : undefined}
        value={progress}
      />
    </div>
  )
}
