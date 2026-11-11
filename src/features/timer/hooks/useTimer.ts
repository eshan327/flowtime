import { timerNow, serverClock } from '@/features/timer/lib/serverClock'
import { useEffect } from 'react'
import { MAX_SESSION_SECONDS, useTimerStore } from '@/features/timer/stores/timerStore'
import { prepareChimeAudio, scheduleDoneChime } from '@/lib/audio'
import { sendTimerCommand } from './useTimerSync'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'

export function useTimer(enabled: boolean, showClock: boolean) {
  const chimeEnabled = useTimerSettingsStore((state) => state.chimeEnabled)
  const chimeId = useTimerSettingsStore((state) => state.chimeId)
  const phase = useTimerStore((state) => state.phase)
  const revision = useTimerStore((state) => state.syncRevision)
  const startedAt = useTimerStore((state) => state.startedAt)
  const breakEndAt = useTimerStore((state) => state.breakEndAt)
  const setWorkSeconds = useTimerStore((state) => state.setWorkSeconds)

  useEffect(() => {
    if (!enabled || !chimeEnabled) return
    // Unlock audio during a user gesture, before the browser goes into the background.
    document.addEventListener('pointerdown', prepareChimeAudio)
    document.addEventListener('keydown', prepareChimeAudio)
    return () => {
      document.removeEventListener('pointerdown', prepareChimeAudio)
      document.removeEventListener('keydown', prepareChimeAudio)
    }
  }, [enabled, chimeEnabled])

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
          void sendTimerCommand('stop_work', undefined, revision)
          return
        }

        setWorkSeconds(Math.max(0, elapsed))
      } else if (phase === 'breaking' && breakEndAt) {
        const remaining = Math.ceil((breakEndAt.getTime() - timerNow()) / 1000)
        if (remaining <= 0) {
          void sendTimerCommand('finish_break', undefined, revision)
        }
      }
    }

    let interval: number | undefined
    let deadlineTimeout: number | undefined
    // Expiry and the six-hour cap must still run when there is no visible clock.
    const deadline =
      phase === 'working' && startedAt
        ? new Date(useTimerStore.getState().runStartedAt ?? startedAt).getTime() +
          MAX_SESSION_SECONDS * 1000
        : breakEndAt?.getTime()
    const updateClock = () => {
      window.clearInterval(interval)
      interval = undefined
      tick()
      if (phase === 'working' && showClock && document.visibilityState === 'visible')
        interval = window.setInterval(tick, 1000)
    }
    const checkDeadline = () => {
      tick()
      if (deadline !== undefined && deadline > timerNow()) {
        deadlineTimeout = window.setTimeout(checkDeadline, deadline - timerNow())
      }
    }
    updateClock()
    if (deadline !== undefined)
      deadlineTimeout = window.setTimeout(checkDeadline, Math.max(0, deadline - timerNow()))
    document.addEventListener('visibilitychange', updateClock)
    window.addEventListener('pageshow', updateClock)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(deadlineTimeout)
      document.removeEventListener('visibilitychange', updateClock)
      window.removeEventListener('pageshow', updateClock)
    }
  }, [enabled, showClock, phase, revision, startedAt, breakEndAt, setWorkSeconds])
}
