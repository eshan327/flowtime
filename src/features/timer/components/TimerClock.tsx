import { useEffect, useState, type CSSProperties } from 'react'
import { FileText } from 'lucide-react'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/formatting'

interface TimerClockProps {
  phase: TimerPhase
  workSeconds: number
  breakTotal: number
  breakEndAt: Date | null
  accentColor?: string | null
  taskName?: string | null
  supportingLabel?: string | null
  supportingValue?: string | null
}

export function TimerClock({
  phase,
  workSeconds,
  breakTotal,
  breakEndAt,
  accentColor,
  taskName,
  supportingLabel,
  supportingValue,
}: TimerClockProps) {
  const [now, setNow] = useState(Date.now)

  useEffect(() => {
    if (phase !== 'working' && phase !== 'breaking') return
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

  return (
    <div
      className={`timer-dial relative mx-auto flex h-[min(21rem,82vw)] w-[min(21rem,82vw)] shrink-0 items-center justify-center rounded-full sm:h-96 sm:w-96 lg:h-[min(31rem,58vh)] lg:w-[min(31rem,58vh)] ${phase === 'working' ? 'is-running' : ''}`}
      style={
        {
          '--timer-accent': accent,
          '--timer-progress': `${progress * 360}deg`,
        } as CSSProperties
      }
    >
      {phase === 'working' || phase === 'breaking' ? (
        <span aria-hidden="true" className="timer-orbit" />
      ) : null}
      <div className="relative z-[1] flex w-[78%] flex-col items-center">
        <p className="rounded-full border border-surface-border px-5 py-2 text-xs font-medium tracking-wide text-ink-primary">
          <span
            className="mr-2 inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {phase === 'working' ? 'Focus' : phase === 'breaking' ? 'Recover' : 'Ready'}
        </p>
        <p
          className={`mt-7 whitespace-nowrap font-semibold leading-none tabular-nums text-ink-primary ${clock.length > 5 ? 'text-[48px] tracking-[-0.055em] sm:text-[70px] lg:text-[86px]' : 'text-[72px] tracking-[-0.07em] sm:text-[104px] lg:text-[118px]'}`}
        >
          {clock}
        </p>
        {taskName ? (
          <p className="mt-7 flex w-full items-center justify-center gap-2 border-y border-surface-border-subtle py-4 text-sm font-medium text-ink-secondary sm:text-base">
            <FileText className="h-4 w-4 text-ink-tertiary" />
            <span className="truncate">{taskName}</span>
          </p>
        ) : null}
        {supportingLabel && supportingValue ? (
          <div className="mt-6 text-center">
            <p className="text-xs text-ink-tertiary sm:text-sm">{supportingLabel}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-accent-primary sm:text-3xl">
              {supportingValue}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
