import { useEffect } from 'react'
import { MAX_SESSION_SECONDS, useTimerStore } from '@/features/timer/stores/timerStore'
import { prepareChimeAudio, scheduleDoneChime } from '@/lib/audio'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'

export function useTimer(enabled: boolean) {
  const breakDivisor = useTimerSettingsStore((state) => state.breakDivisor)
  const chimeEnabled = useTimerSettingsStore((state) => state.chimeEnabled)
  const chimeId = useTimerSettingsStore((state) => state.chimeId)
  const phase = useTimerStore((state) => state.phase)
  const startedAt = useTimerStore((state) => state.startedAt)
  const breakEndAt = useTimerStore((state) => state.breakEndAt)
  const setWorkSeconds = useTimerStore((state) => state.setWorkSeconds)
  const finishBreak = useTimerStore((state) => state.finishBreak)
  const triggerRunaway = useTimerStore((state) => state.triggerRunaway)

  useEffect(() => {
    // Unlock audio during a user gesture, before the browser goes into the background.
    document.addEventListener('pointerdown', prepareChimeAudio)
    document.addEventListener('keydown', prepareChimeAudio)
    return () => {
      document.removeEventListener('pointerdown', prepareChimeAudio)
      document.removeEventListener('keydown', prepareChimeAudio)
    }
  }, [])

  useEffect(() => {
    if (!enabled || !chimeEnabled || phase !== 'breaking' || !breakEndAt) return
    return scheduleDoneChime(breakEndAt, chimeId)
  }, [enabled, chimeEnabled, phase, breakEndAt, chimeId])

  useEffect(() => {
    if (!enabled || (phase !== 'working' && phase !== 'breaking')) return

    const tick = () => {
      if (phase === 'working' && startedAt) {
        const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)

        if (elapsed >= MAX_SESSION_SECONDS) {
          triggerRunaway({ breakDivisor })
          return
        }

        setWorkSeconds(elapsed)
      } else if (phase === 'breaking' && breakEndAt) {
        const remaining = Math.ceil((breakEndAt.getTime() - Date.now()) / 1000)
        if (remaining <= 0) {
          finishBreak()
        }
      }
    }

    tick()

    const interval = window.setInterval(tick, 1000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [
    enabled,
    phase,
    startedAt,
    breakEndAt,
    setWorkSeconds,
    finishBreak,
    triggerRunaway,
    breakDivisor,
  ])
}
