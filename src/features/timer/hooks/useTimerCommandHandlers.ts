import { useCallback, type Dispatch, type SetStateAction } from 'react'
import type { SessionEditValues } from '@/features/stats/components/SessionEditModal'
import type { SessionUpdateInput } from '@/features/stats/hooks/useSessionMutations'
import { getBreakSeconds } from '@/features/timer/stores/timerSettingsStore'
import { requestNotificationPermission } from '@/lib/notifications'
import {
  createSessionSnapshotForTaskId,
  toSessionWithTask,
  type SessionSnapshotInput,
} from '@/lib/sessionSnapshot'
import type { Session, SessionWithTask, TaskWithCategory } from '@/types'
import type { TimerSessionSavePayload } from '@/features/timer/hooks/useTimerSessionPipeline'

interface SessionTaskSnapshot {
  name: string | null
  color: string | null
  categoryId: string | null
  categoryName: string | null
  categoryColor: string | null
}

interface StopWorkHandler {
  (options?: { sessionTask?: SessionTaskSnapshot | null; breakDivisor?: number }): void
}

interface UpdateSessionMutation {
  mutateAsync: (payload: SessionUpdateInput) => Promise<unknown>
}

interface SoftDeleteSessionMutation {
  mutateAsync: (sessionId: string) => Promise<unknown>
}

interface UseTimerCommandHandlersOptions {
  notificationsEnabled: boolean
  canStartWork: boolean
  isSavingSession: boolean
  startedAt: Date | null
  userId: string | undefined
  selectedTaskId: string | null
  selectableTasks: TaskWithCategory[]
  lastSavedSession: SessionWithTask | null
  lastSessionId: string | null
  workSeconds: number
  breakDivisor: number
  setLastSessionId: (sessionId: string | null) => void
  setLastSavedSession: Dispatch<SetStateAction<SessionWithTask | null>>
  setIsSessionEditOpen: (isOpen: boolean) => void
  startWork: () => void
  stopWork: StopWorkHandler
  saveTimerSession: (
    payload: TimerSessionSavePayload,
    snapshot: SessionSnapshotInput
  ) => Promise<void>
  buildSessionSnapshot: () => SessionSnapshotInput
  updateSession: UpdateSessionMutation
  softDeleteSession: SoftDeleteSessionMutation
}

export function useTimerCommandHandlers({
  notificationsEnabled,
  canStartWork,
  isSavingSession,
  startedAt,
  userId,
  selectedTaskId,
  selectableTasks,
  lastSavedSession,
  lastSessionId,
  workSeconds,
  breakDivisor,
  setLastSessionId,
  setLastSavedSession,
  setIsSessionEditOpen,
  startWork,
  stopWork,
  saveTimerSession,
  buildSessionSnapshot,
  updateSession,
  softDeleteSession,
}: UseTimerCommandHandlersOptions) {
  const handleStopWork = useCallback(() => {
    if (notificationsEnabled) {
      void requestNotificationPermission()
    }

    if (isSavingSession) {
      return
    }

    const snapshot = buildSessionSnapshot()

    const sessionTask: SessionTaskSnapshot = {
      name: snapshot.taskNameSnapshot,
      color: snapshot.taskColorSnapshot,
      categoryId: snapshot.categoryIdSnapshot,
      categoryName: snapshot.categoryNameSnapshot,
      categoryColor: snapshot.categoryColorSnapshot,
    }

    if (!startedAt || !userId) {
      stopWork({ sessionTask, breakDivisor })
      return
    }

    const payload: TimerSessionSavePayload = {
      user_id: userId,
      task_id: selectedTaskId,
      work_seconds: workSeconds,
      break_seconds: getBreakSeconds(workSeconds, breakDivisor),
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
    }

    void saveTimerSession(payload, snapshot).catch(() => {
      setLastSessionId(null)
    })

    stopWork({ sessionTask, breakDivisor })
  }, [
    breakDivisor,
    buildSessionSnapshot,
    isSavingSession,
    notificationsEnabled,
    saveTimerSession,
    selectedTaskId,
    setLastSessionId,
    startedAt,
    stopWork,
    userId,
    workSeconds,
  ])

  const handleStartWork = useCallback(() => {
    if (!canStartWork) {
      return
    }

    setLastSavedSession(null)
    startWork()
  }, [canStartWork, setLastSavedSession, startWork])

  const handleSaveSessionEdit = useCallback(
    async (values: SessionEditValues) => {
      if (!lastSavedSession) return

      const selectedEditTask = values.taskId
        ? (selectableTasks.find((task) => task.id === values.taskId) ?? null)
        : null

      const snapshot = createSessionSnapshotForTaskId(
        values.taskId,
        selectedEditTask,
        lastSavedSession
      )

      await updateSession.mutateAsync({
        id: values.id,
        taskId: values.taskId,
        workSeconds: values.workSeconds,
        breakSeconds: values.breakSeconds,
        startedAt: values.startedAt,
        endedAt: values.endedAt,
        notes: values.notes,
        snapshot,
      })

      setLastSavedSession((current) => {
        if (!current) return current

        const updated: Session = {
          ...current,
          task_id: values.taskId,
          work_seconds: values.workSeconds,
          break_seconds: values.breakSeconds,
          started_at: values.startedAt,
          ended_at: values.endedAt,
          notes: values.notes,
        }

        return toSessionWithTask(updated, snapshot)
      })

      setIsSessionEditOpen(false)
    },
    [lastSavedSession, selectableTasks, setLastSavedSession, setIsSessionEditOpen, updateSession]
  )

  const handleDeleteLastSession = useCallback(async () => {
    const sessionId = lastSavedSession?.id ?? lastSessionId
    if (!sessionId) return

    await softDeleteSession.mutateAsync(sessionId)
    setLastSavedSession(null)
    setLastSessionId(null)
  }, [
    lastSavedSession?.id,
    lastSessionId,
    setLastSavedSession,
    setLastSessionId,
    softDeleteSession,
  ])

  return {
    handleStopWork,
    handleStartWork,
    handleSaveSessionEdit,
    handleDeleteLastSession,
  }
}
