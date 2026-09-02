import { useEffect, useState, type CSSProperties } from 'react'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { getBreakSeconds } from '@/features/timer/stores/timerSettingsStore'
import { useTimerStore } from '@/features/timer/stores/timerStore'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/formatting'

interface TimerClockProps {
  phase: TimerPhase
  breakDivisor: number
  breakTotal: number
  breakEndAt: Date | null
  accentColor?: string | null
}

export function TimerClock({
  phase,
  breakDivisor,
  breakTotal,
  breakEndAt,
  accentColor,
}: TimerClockProps) {
  const [now, setNow] = useState(Date.now)
  const workSeconds = useTimerStore((state) => state.workSeconds)

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
  const progress =
    phase === 'breaking' && breakTotal > 0
      ? (breakTotal - seconds) / breakTotal
      : phase === 'working'
        ? (workSeconds % 60) / 60
        : 0
  const accent = accentColor ?? DEFAULT_TASK_COLOR
  const clock = formatClock(seconds)
  const supportingValue =
    phase === 'working'
      ? formatClock(getBreakSeconds(workSeconds, breakDivisor))
      : phase === 'breaking'
        ? formatClock(breakTotal)
        : null

  return (
    <div
      className={`timer-dial relative mx-auto flex h-[min(21rem,82vw)] w-[min(21rem,82vw)] shrink-0 items-center justify-center rounded-full sm:h-96 sm:w-96 lg:h-[min(31rem,59vh)] lg:w-[min(31rem,59vh)] ${phase === 'working' ? 'is-running' : ''}`}
      style={
        {
          '--timer-accent': accent,
          '--timer-progress': `${progress * 360}deg`,
        } as CSSProperties
      }
    >
      <div className="relative z-[1] flex w-[78%] flex-col items-center">
        <p
          className={`whitespace-nowrap font-medium leading-none tabular-nums text-ink-primary ${clock.length > 5 ? 'text-[48px] tracking-[-0.055em] sm:text-[70px] lg:text-[86px]' : 'text-[72px] tracking-[-0.065em] sm:text-[104px] lg:text-[118px]'}`}
        >
          {clock}
        </p>
        {phase === 'working' || phase === 'breaking' ? (
          <div className="mt-6 flex flex-col items-center gap-3">
            <span aria-hidden="true" className="h-4 w-px bg-accent-primary" />
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-accent-primary">
              {phase === 'working' ? 'Focus' : 'Recover'}
            </p>
          </div>
        ) : null}
        {supportingValue ? (
          <div className="mt-6 text-center">
            <p className="text-xs text-ink-tertiary sm:text-sm">Break earned</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-accent-primary sm:text-3xl">
              {supportingValue}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
