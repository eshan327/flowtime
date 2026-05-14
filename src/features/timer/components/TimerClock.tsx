import { useEffect, useMemo, useState } from 'react'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/utils'

interface TimerClockProps {
  phase: TimerPhase
  workSeconds: number
  breakEndAt: Date | null
}

export function TimerClock({ phase, workSeconds, breakEndAt }: TimerClockProps) {
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

  return (
    <div className="relative flex flex-col items-center">
      <p
        className={`text-7xl font-light tracking-tight transition-colors duration-400 md:text-8xl ${colorClass}`}
      >
        {formatClock(seconds)}
      </p>

      {phase === 'working' ? (
        <span className="absolute -right-4 top-1/2 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-amber-700/80" />
      ) : null}
    </div>
  )
}
