import { useEffect, useMemo, useState } from 'react'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/utils'

interface TimerClockProps {
  phase: TimerPhase
  workSeconds: number
  breakTotal: number
  breakEndAt: Date | null
}

type RestVisualPreset = 'ultra-subtle' | 'juicy'

const REST_VISUAL_PRESET: RestVisualPreset = 'ultra-subtle'

const REST_VISUAL_CONFIG: Record<
  RestVisualPreset,
  {
    textClass: string
    containerClass: string
    overlayClass: string
    topShadeClass: string
    fillClass: string
    primaryWaveClass: string
    secondaryWaveClass: string
    fillRiseMs: number
  }
> = {
  'ultra-subtle': {
    textClass: 'text-[#f0d2bc]',
    containerClass:
      'pointer-events-none absolute left-1/2 top-1/2 -z-10 h-56 w-[min(92vw,23rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-[#c8804f44] bg-[#241a15]/55 shadow-[0_0_56px_rgba(184,104,58,0.12)]',
    overlayClass:
      'absolute inset-0 bg-gradient-to-b from-[#f7dfcc0d] via-[#7c4b2b26] to-[#9f5e3833]',
    topShadeClass:
      'absolute inset-x-0 top-0 h-[45%] bg-gradient-to-b from-[#120e0c8c] to-transparent',
    fillClass: 'absolute inset-0 bg-gradient-to-t from-[#7d3f22a1] via-[#a45c3491] to-[#d38a5a54]',
    primaryWaveClass:
      'absolute -left-[18%] right-[-18%] top-[-16px] h-9 animate-liquid-wave-terracotta-subtle rounded-[45%] bg-[#e2a37e8f]',
    secondaryWaveClass:
      'absolute -left-[12%] right-[-12%] top-[-12px] h-7 animate-liquid-wave-terracotta-subtle-reverse rounded-[50%] bg-[#f3c29a5e]',
    fillRiseMs: 900,
  },
  juicy: {
    textClass: 'text-[#ffd7ba]',
    containerClass:
      'pointer-events-none absolute left-1/2 top-1/2 -z-10 h-56 w-[min(92vw,23rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-[#dd8f5e66] bg-[#2a1b13]/60 shadow-[0_0_72px_rgba(205,116,62,0.2)]',
    overlayClass:
      'absolute inset-0 bg-gradient-to-b from-[#fce6d81a] via-[#a35f362e] to-[#c270423b]',
    topShadeClass:
      'absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-[#140d0994] to-transparent',
    fillClass: 'absolute inset-0 bg-gradient-to-t from-[#8f4524bd] via-[#bf6635a8] to-[#e09a6b7d]',
    primaryWaveClass:
      'absolute -left-[22%] right-[-22%] top-[-19px] h-11 animate-liquid-wave-terracotta-juicy rounded-[40%] bg-[#eba97caa]',
    secondaryWaveClass:
      'absolute -left-[16%] right-[-16%] top-[-14px] h-8 animate-liquid-wave-terracotta-juicy-reverse rounded-[46%] bg-[#f7c39a78]',
    fillRiseMs: 700,
  },
}

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
  const restVisual = REST_VISUAL_CONFIG[REST_VISUAL_PRESET]

  const colorClass = isBreaking ? restVisual.textClass : 'text-ink-primary'
  const breakProgress =
    isBreaking && breakTotal > 0 ? Math.min(1, Math.max(0, 1 - seconds / breakTotal)) : 0
  const breakProgressPercent = Math.round(breakProgress * 100)

  return (
    <div className="relative flex w-full flex-col items-center">
      {isWorking ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-52 w-52 -translate-x-1/2 -translate-y-1/2"
        >
          <span
            className="absolute inset-0 animate-focus-blob-main blur-2xl"
            style={{
              borderRadius: '42% 58% 60% 40% / 45% 42% 58% 55%',
              background:
                'radial-gradient(circle at 35% 25%, rgba(108, 136, 196, 0.42), rgba(59, 86, 138, 0.3) 54%, rgba(22, 34, 59, 0) 100%)',
            }}
          />
          <span
            className="absolute inset-5 animate-focus-blob-accent border border-[#6f8abf33] bg-[#304a7d22] blur-xl"
            style={{ borderRadius: '58% 42% 41% 59% / 61% 48% 52% 39%' }}
          />
        </div>
      ) : null}

      {isBreaking ? (
        <div aria-hidden="true" className={restVisual.containerClass}>
          <div className={restVisual.overlayClass} />
          <div className={restVisual.topShadeClass} />

          <div
            className="absolute inset-x-0 bottom-0 transition-[height] ease-linear"
            style={{
              height: `${breakProgressPercent}%`,
              transitionDuration: `${restVisual.fillRiseMs}ms`,
            }}
          >
            <div className={restVisual.fillClass} />
            <div className={restVisual.primaryWaveClass} />
            <div className={restVisual.secondaryWaveClass} />
          </div>
        </div>
      ) : null}

      <p
        className={`text-7xl font-light tracking-tight transition-colors duration-400 md:text-8xl ${colorClass} ${isBreaking ? 'drop-shadow-[0_3px_14px_rgba(28,16,11,0.58)]' : ''}`}
      >
        {formatClock(seconds)}
      </p>

      {isWorking ? (
        <span className="absolute -right-4 top-1/2 h-2 w-2 -translate-y-1/2 animate-pulse rounded-full bg-[#6f8abf]/75" />
      ) : null}
    </div>
  )
}
