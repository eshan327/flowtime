import { useEffect, useRef } from 'react'
import { getBreakSeconds, useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { MAX_SESSION_SECONDS, useTimerStore } from '@/features/timer/stores/timerStore'
import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'
import type { TimerSessionSavePayload } from '@/features/timer/hooks/useTimerSessionPipeline'

interface UseRunawayProtectionOptions {
  enabled: boolean
  userId: string | undefined
  isSavingSession: boolean
  saveTimerSession: (
    payload: TimerSessionSavePayload,
    snapshot: SessionSnapshotInput
  ) => Promise<void>
}

export function useRunawayProtection({
  enabled,
  userId,
  isSavingSession,
  saveTimerSession,
}: UseRunawayProtectionOptions) {
  const runawayDetected = useTimerStore((state) => state.runawayDetected)
  const breakDivisor = useTimerSettingsStore((state) => state.breakDivisor)
  const runawaySaveKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!runawayDetected) {
      runawaySaveKeyRef.current = null
      return
    }
    const timer = useTimerStore.getState()
    if (!enabled || !timer.startedAt || !userId || timer.ownerUserId !== userId || isSavingSession)
      return

    const saveKey = `${userId}:${timer.sessionId ?? timer.startedAt.toISOString()}`
    if (runawaySaveKeyRef.current === saveKey) return
    runawaySaveKeyRef.current = saveKey

    void saveTimerSession(
      {
        id: timer.sessionId ?? undefined,
        user_id: userId,
        task_id: timer.selectedTaskId,
        work_seconds: MAX_SESSION_SECONDS,
        break_seconds: getBreakSeconds(MAX_SESSION_SECONDS, breakDivisor),
        started_at: timer.startedAt.toISOString(),
        ended_at: new Date(timer.startedAt.getTime() + MAX_SESSION_SECONDS * 1000).toISOString(),
      },
      {
        taskIdSnapshot: timer.selectedTaskId,
        taskNameSnapshot: timer.selectedTaskName,
        taskColorSnapshot: timer.selectedTaskColor,
        categoryIdSnapshot: timer.selectedCategoryId,
        categoryNameSnapshot: timer.selectedCategoryName,
        categoryColorSnapshot: timer.selectedCategoryColor,
      }
    ).catch(() => undefined)
  }, [enabled, userId, isSavingSession, saveTimerSession, runawayDetected, breakDivisor])
}
