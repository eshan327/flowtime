import { timerNow, serverClock } from '@/features/timer/lib/serverClock'
import { useEffect } from 'react'
import { MAX_SESSION_SECONDS, useTimerStore } from '@/features/timer/stores/timerStore'
import { prepareChimeAudio, scheduleDoneChime } from '@/lib/audio'
import { sendTimerCommand } from './useTimerSync'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'

export function useTimer(enabled: boolean) {
  const chimeEnabled = useTimerSettingsStore((state) => state.chimeEnabled)
  const chimeId = useTimerSettingsStore((state) => state.chimeId)
  const phase = useTimerStore((state) => state.phase)
  const startedAt = useTimerStore((state) => state.startedAt)
  const breakEndAt = useTimerStore((state) => state.breakEndAt)
  const setWorkSeconds = useTimerStore((state) => state.setWorkSeconds)

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
    if (serverClock().uncertain) return
    return scheduleDoneChime(new Date(Date.now() + breakEndAt.getTime() - timerNow()), chimeId)
  }, [enabled, chimeEnabled, phase, breakEndAt, chimeId])

  useEffect(() => {
    if (!enabled || (phase !== 'working' && phase !== 'breaking')) return

    const tick = () => {
      if (phase === 'working' && startedAt) {
        const elapsed = Math.floor(
          (timerNow() - new Date(useTimerStore.getState().runStartedAt ?? startedAt).getTime()) /
            1000
        )

        if (elapsed >= MAX_SESSION_SECONDS) {
          void sendTimerCommand('stop_work')
          return
        }

        setWorkSeconds(Math.max(0, elapsed))
      } else if (phase === 'breaking' && breakEndAt) {
        const remaining = Math.ceil((breakEndAt.getTime() - timerNow()) / 1000)
        if (remaining <= 0) {
          void sendTimerCommand('finish_break')
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
  }, [enabled, phase, startedAt, breakEndAt, setWorkSeconds])
}
