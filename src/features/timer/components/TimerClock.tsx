import { timerNow } from '@/features/timer/lib/serverClock'
import { useEffect, useState } from 'react'
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
  const [now, setNow] = useState(timerNow)
  const workSeconds = useTimerStore((state) => state.workSeconds)

  useEffect(() => {
    if (phase !== 'breaking') return
    let interval: number | undefined
    const updateClock = () => {
      window.clearInterval(interval)
      interval = undefined
      if (document.visibilityState !== 'visible') return
      setNow(timerNow())
      interval = window.setInterval(() => setNow(timerNow()), 1000)
    }
    updateClock()
    document.addEventListener('visibilitychange', updateClock)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', updateClock)
    }
  }, [phase])

  const seconds =
    phase === 'working'
      ? workSeconds
      : phase === 'breaking' && breakEndAt
        ? Math.max(0, Math.ceil((breakEndAt.getTime() - now) / 1000))
        : 0
  const progress = phase === 'breaking' && breakTotal > 0 ? (breakTotal - seconds) / breakTotal : 0
  const accent = accentColor ?? DEFAULT_TASK_COLOR
  const clock = formatClock(seconds)
  const supportingValue =
    phase === 'working'
      ? formatClock(getBreakSeconds(workSeconds, breakDivisor))
      : phase === 'breaking'
        ? formatClock(breakTotal)
        : null

  return (
    <div className="timer-dial relative mx-auto flex aspect-square w-full max-w-[32rem] [container-type:inline-size] [contain:paint] shrink-0 items-center justify-center rounded-full sm:w-[min(32rem,calc(100svh-20rem),100%)]">
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full -rotate-90"
        focusable="false"
        viewBox="0 0 100 100"
      >
        <circle
          cx="50"
          cy="50"
          r="49"
          fill="none"
          stroke={phase === 'working' ? accent : 'rgb(var(--surface-border))'}
          strokeOpacity={phase === 'working' ? 0.7 : 0.58}
          strokeWidth="0.8"
        />
        {phase === 'breaking' ? (
          <circle
            cx="50"
            cy="50"
            r="49"
            fill="none"
            pathLength="1"
            stroke={accent}
            strokeDasharray={`${Math.max(0, Math.min(1, progress))} 1`}
            strokeWidth="0.8"
          />
        ) : null}
      </svg>
      <div className="relative z-[1] flex w-[78%] flex-col items-center">
        <p
          className={`whitespace-nowrap font-medium leading-none tabular-nums text-ink-primary ${clock.length > 5 ? 'text-[19cqw] tracking-[-0.055em]' : 'text-[27cqw] tracking-[-0.065em]'}`}
        >
          {clock}
        </p>
        {phase === 'working' || phase === 'breaking' ? (
          <div className="mt-[5cqw]">
            <p className="text-[clamp(11px,2.8cqw,15px)] font-medium uppercase tracking-[0.32em] text-accent-primary">
              {phase === 'working' ? 'Focus' : 'Recover'}
            </p>
          </div>
        ) : null}
        {supportingValue ? (
          <div className="mt-[6cqw] text-center">
            <p className="text-[clamp(12px,3.2cqw,17px)] text-ink-tertiary">Break earned</p>
            <p className="mt-1 text-[8cqw] font-semibold leading-tight tabular-nums text-accent-primary">
              {supportingValue}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
