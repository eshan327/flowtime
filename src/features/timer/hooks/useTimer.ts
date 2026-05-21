import { useEffect, useRef } from 'react'
import { MAX_SESSION_SECONDS, useTimerStore } from '@/features/timer/stores/timerStore'
import { playDoneChime, type ChimeOptionId } from '@/lib/audio'
import { sendNotification } from '@/lib/notifications'

interface UseTimerOptions {
  breakDivisor: number
  notificationsEnabled: boolean
  chimeEnabled: boolean
  chimeId: ChimeOptionId
}

export function useTimer({
  breakDivisor,
  notificationsEnabled,
  chimeEnabled,
  chimeId,
}: UseTimerOptions) {
  const breakCompletionKeyRef = useRef<string | null>(null)
  const phase = useTimerStore((state) => state.phase)
  const startedAt = useTimerStore((state) => state.startedAt)
  const breakEndAt = useTimerStore((state) => state.breakEndAt)
  const setWorkSeconds = useTimerStore((state) => state.setWorkSeconds)
  const finishBreak = useTimerStore((state) => state.finishBreak)
  const triggerRunaway = useTimerStore((state) => state.triggerRunaway)

  useEffect(() => {
    if (phase !== 'working' && phase !== 'breaking') {
      breakCompletionKeyRef.current = null
      return
    }

    if (phase !== 'breaking') {
      breakCompletionKeyRef.current = null
    }

    const breakCompletionKey =
      phase === 'breaking' && breakEndAt ? String(breakEndAt.getTime()) : null

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
          if (breakCompletionKey && breakCompletionKeyRef.current !== breakCompletionKey) {
            breakCompletionKeyRef.current = breakCompletionKey
            if (notificationsEnabled) {
              sendNotification('Break complete', 'Time to focus again.')
            }

            if (chimeEnabled) {
              playDoneChime(chimeId)
            }
          }

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
    phase,
    startedAt,
    breakEndAt,
    setWorkSeconds,
    finishBreak,
    triggerRunaway,
    breakDivisor,
    notificationsEnabled,
    chimeEnabled,
    chimeId,
  ])
}
