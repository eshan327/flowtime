import { useEffect, useRef } from 'react'
import { getBreakSeconds } from '@/features/timer/stores/timerSettingsStore'
import { MAX_SESSION_SECONDS } from '@/features/timer/stores/timerStore'
import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'
import type { TimerSessionSavePayload } from '@/features/timer/hooks/useTimerSessionPipeline'

interface UseRunawayProtectionOptions {
  runawayDetected: boolean
  startedAt: Date | null
  userId: string | undefined
  isSavingSession: boolean
  selectedTaskId: string | null
  breakDivisor: number
  buildSessionSnapshot: () => SessionSnapshotInput
  saveTimerSession: (
    payload: TimerSessionSavePayload,
    snapshot: SessionSnapshotInput
  ) => Promise<void>
  setLastSessionId: (sessionId: string | null) => void
}

export function useRunawayProtection({
  runawayDetected,
  startedAt,
  userId,
  isSavingSession,
  selectedTaskId,
  breakDivisor,
  buildSessionSnapshot,
  saveTimerSession,
  setLastSessionId,
}: UseRunawayProtectionOptions) {
  const runawaySaveKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!runawayDetected) {
      runawaySaveKeyRef.current = null
      return
    }

    if (!startedAt || !userId || isSavingSession) {
      return
    }

    const saveKey = `${userId}:${startedAt.toISOString()}`
    if (runawaySaveKeyRef.current === saveKey) {
      return
    }

    runawaySaveKeyRef.current = saveKey

    const snapshot = buildSessionSnapshot()
    void saveTimerSession(
      {
        user_id: userId,
        task_id: selectedTaskId,
        work_seconds: MAX_SESSION_SECONDS,
        break_seconds: getBreakSeconds(MAX_SESSION_SECONDS, breakDivisor),
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
      },
      snapshot
    ).catch(() => {
      setLastSessionId(null)
    })
  }, [
    breakDivisor,
    buildSessionSnapshot,
    isSavingSession,
    runawayDetected,
    saveTimerSession,
    selectedTaskId,
    setLastSessionId,
    startedAt,
    userId,
  ])
}
