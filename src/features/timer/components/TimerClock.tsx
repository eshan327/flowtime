import { useEffect, useMemo, useState } from 'react'
import type { TimerPhase } from '@/features/timer/stores/timerStore'
import { formatClock } from '@/lib/utils'

interface TimerClockProps {
  phase: TimerPhase
  workSeconds: number
  breakTotal: number
  breakEndAt: Date | null
  accentColor?: string | null
}

const REST_FILL_RISE_MS = 780
const DEFAULT_ACCENT_RGB = { r: 120, g: 154, b: 223 }

function parseAccentColor(input: string | null | undefined) {
  if (!input) return DEFAULT_ACCENT_RGB

  const trimmed = input.trim()
  const normalized = trimmed.startsWith('#') ? trimmed.slice(1) : trimmed

  if (normalized.length === 3) {
    const parsed = Number.parseInt(
      normalized
        .split('')
        .map((char) => `${char}${char}`)
        .join(''),
      16
    )

    if (Number.isNaN(parsed)) return DEFAULT_ACCENT_RGB

    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    }
  }

  if (normalized.length === 6) {
    const parsed = Number.parseInt(normalized, 16)
    if (Number.isNaN(parsed)) return DEFAULT_ACCENT_RGB

    return {
      r: (parsed >> 16) & 255,
      g: (parsed >> 8) & 255,
      b: parsed & 255,
    }
  }

  return DEFAULT_ACCENT_RGB
}

function toRgba(rgb: { r: number; g: number; b: number }, alpha: number) {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
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
  const accentRgb = useMemo(() => parseAccentColor(accentColor), [accentColor])

  const workBlobGradient = useMemo(
    () =>
      `radial-gradient(circle at 34% 24%, ${toRgba(accentRgb, 0.74)}, ${toRgba(accentRgb, 0.42)} 54%, rgba(24, 20, 18, 0) 100%)`,
    [accentRgb]
  )

  const workHaloGradient = useMemo(
    () =>
      `radial-gradient(circle, ${toRgba(accentRgb, 0.34)} 0%, ${toRgba(accentRgb, 0.14)} 48%, rgba(18, 15, 13, 0) 80%)`,
    [accentRgb]
  )

  const workAtmosphereGradient = useMemo(
    () =>
      `radial-gradient(circle at 50% 52%, ${toRgba(accentRgb, 0.22)} 0%, ${toRgba(accentRgb, 0.07)} 46%, rgba(17, 14, 13, 0) 72%)`,
    [accentRgb]
  )

  const colorClass = isBreaking ? 'text-[#f6efe6]' : 'text-ink-primary'
  const breakProgress =
    isBreaking && breakTotal > 0 ? Math.min(1, Math.max(0, 1 - seconds / breakTotal)) : 0
  const breakProgressPercent = Math.round(breakProgress * 100)

  return (
    <div className="relative isolate w-full max-w-md">
      <div className="relative mx-auto h-56 w-full max-w-[23rem] overflow-hidden rounded-3xl border border-surface-border/80 bg-[#171614]">
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b1a18] via-[#171614] to-[#151311]" />

        {isWorking ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
          >
            <div className="absolute inset-0" style={{ background: workAtmosphereGradient }} />
            <span
              className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 animate-focus-blob-main blur-[34px]"
              style={{
                borderRadius: '42% 58% 60% 40% / 45% 42% 58% 55%',
                background: workBlobGradient,
              }}
            />
            <span
              className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 animate-focus-blob-accent border blur-[14px]"
              style={{
                borderRadius: '58% 42% 41% 59% / 61% 48% 52% 39%',
                borderColor: toRgba(accentRgb, 0.36),
                backgroundColor: toRgba(accentRgb, 0.24),
              }}
            />
            <span
              className="absolute left-1/2 top-1/2 h-[21rem] w-[21rem] -translate-x-1/2 -translate-y-1/2 animate-focus-blob-halo rounded-full blur-3xl"
              style={{ background: workHaloGradient }}
            />
          </div>
        ) : null}

        {isBreaking ? (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-[1] overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-b from-[#efe2d10d] via-[#63534730] to-[#2f282260]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(249,239,228,0.09),rgba(43,36,31,0.48)_58%,rgba(16,14,12,0.82)_100%)]" />
            <div className="absolute inset-x-0 top-0 h-[42%] bg-gradient-to-b from-[#14110ea8] to-transparent" />
            <div className="absolute left-1/2 top-1/2 z-[2] h-36 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#12100fcf] blur-[18px]" />

            <div
              className="absolute inset-x-0 bottom-0 z-[3] transition-[height] ease-linear"
              style={{
                height: `${breakProgressPercent}%`,
                transitionDuration: `${REST_FILL_RISE_MS}ms`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-[#42362ddc] via-[#6b5d50ab] to-[#c5b3a384]" />
              <div className="absolute inset-x-0 top-0 h-[52%] bg-gradient-to-b from-[#f0dfce24] to-transparent" />
              <div className="absolute -left-[20%] right-[-20%] top-[-17px] h-10 animate-liquid-wave-terracotta rounded-[44%] bg-[#d7c5b29e]" />
              <div className="absolute -left-[14%] right-[-14%] top-[-13px] h-8 animate-liquid-wave-terracotta-reverse rounded-[49%] bg-[#f2e6d988]" />
            </div>
          </div>
        ) : null}

        <p
          className={`absolute inset-0 z-10 flex items-center justify-center text-7xl font-light tracking-tight transition-colors duration-400 md:text-8xl ${colorClass} ${isBreaking ? 'drop-shadow-[0_5px_18px_rgba(12,10,9,0.88)]' : ''}`}
        >
          {formatClock(seconds)}
        </p>
      </div>
    </div>
  )
}
