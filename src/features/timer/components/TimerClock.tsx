import { useEffect, useMemo, useState } from 'react'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/utils'

interface TimerClockProps {
  phase: TimerPhase
  workSeconds: number
  breakTotal: number
  breakEndAt: Date | null
}

const REST_FILL_RISE_MS = 780

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

  const isWorking = phase === 'working'
  const isBreaking = phase === 'breaking'

  const colorClass = isBreaking ? 'text-[#f4d2b8]' : 'text-ink-primary'
  const breakProgress =
    isBreaking && breakTotal > 0 ? Math.min(1, Math.max(0, 1 - seconds / breakTotal)) : 0
  const breakProgressPercent = Math.round(breakProgress * 100)

  return (
    <div className="relative isolate flex w-full flex-col items-center">
      {isWorking ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2"
        >
          <span
            className="absolute inset-[-8%] animate-focus-blob-main blur-[34px]"
            style={{
              borderRadius: '42% 58% 60% 40% / 45% 42% 58% 55%',
              background:
                'radial-gradient(circle at 36% 24%, rgba(120, 154, 223, 0.66), rgba(70, 103, 173, 0.46) 56%, rgba(27, 43, 74, 0) 100%)',
            }}
          />
          <span
            className="absolute inset-9 animate-focus-blob-accent border border-[#7ea3f055] bg-[#3d5f9e4f] blur-[14px]"
            style={{ borderRadius: '58% 42% 41% 59% / 61% 48% 52% 39%' }}
          />
          <span
            className="absolute inset-[-24%] animate-focus-blob-halo rounded-full blur-3xl"
            style={{
              background:
                'radial-gradient(circle, rgba(107, 141, 214, 0.42) 0%, rgba(64, 92, 154, 0.2) 46%, rgba(17, 24, 40, 0) 78%)',
            }}
          />
        </div>
      ) : null}

      {isBreaking ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-56 w-[min(92vw,23rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-[#d78a5961] bg-[#2a1b13]/58 shadow-[0_0_64px_rgba(196,111,61,0.16)]"
        >
          <div className="absolute inset-0 bg-gradient-to-b from-[#fbe3d314] via-[#8d522f30] to-[#ba6f413d]" />
          <div className="absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-[#140d0991] to-transparent" />

          <div
            className="absolute inset-x-0 bottom-0 transition-[height] ease-linear"
            style={{
              height: `${breakProgressPercent}%`,
              transitionDuration: `${REST_FILL_RISE_MS}ms`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-t from-[#874323b8] via-[#b86134a0] to-[#e39a6c73]" />
            <div className="absolute -left-[20%] right-[-20%] top-[-17px] h-10 animate-liquid-wave-terracotta rounded-[44%] bg-[#e8a97f9f]" />
            <div className="absolute -left-[14%] right-[-14%] top-[-13px] h-8 animate-liquid-wave-terracotta-reverse rounded-[49%] bg-[#f4c59d6e]" />
          </div>
        </div>
      ) : null}

      <p
        className={`relative z-10 text-7xl font-light tracking-tight transition-colors duration-400 md:text-8xl ${colorClass} ${isBreaking ? 'drop-shadow-[0_3px_14px_rgba(28,16,11,0.58)]' : ''}`}
      >
        {formatClock(seconds)}
      </p>

      {isWorking ? (
        <span className="absolute -right-4 top-1/2 z-10 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-[#6f8abf]/75" />
      ) : null}
    </div>
  )
}
