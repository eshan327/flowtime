import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { useSessionSave } from '@/features/sessions/hooks/useSessionSave'
import {
  getQueuedSessions,
  queueSession,
  removeQueuedSession,
} from '@/features/sessions/lib/sessionOutbox'
import { toSessionWithTask } from '@/lib/sessionSnapshot'
import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'
import type { Session, SessionWithTask } from '@/types'

export interface TimerSessionSavePayload {
  user_id: string
  task_id: string | null
  work_seconds: number
  break_seconds: number
  started_at: string
  ended_at: string
}

interface UseTimerSessionPipelineOptions {
  userId?: string
  setLastSessionId: (sessionId: string | null) => void
  setLastSavedSession: Dispatch<SetStateAction<SessionWithTask | null>>
}

export function useTimerSessionPipeline({
  userId,
  setLastSessionId,
  setLastSavedSession,
}: UseTimerSessionPipelineOptions) {
  const saveSession = useSessionSave()
  const mutateSession = saveSession.mutateAsync
  const [queuedSessionCount, setQueuedSessionCount] = useState(0)
  const [lastSaveQueued, setLastSaveQueued] = useState(false)
  const [outboxError, setOutboxError] = useState<unknown>(null)

  const refreshQueuedSessionCount = useCallback(async () => {
    if (!userId) {
      setQueuedSessionCount(0)
      return []
    }

    const queuedSessions = await getQueuedSessions(userId)
    setQueuedSessionCount(queuedSessions.length)
    return queuedSessions
  }, [userId])

  const commitSavedSession = useCallback(
    (savedSession: Session, snapshot: SessionSnapshotInput) => {
      setLastSessionId(savedSession.id)
      setLastSavedSession(toSessionWithTask(savedSession, snapshot))
    },
    [setLastSessionId, setLastSavedSession]
  )

  const saveTimerSession = useCallback(
    async (payload: TimerSessionSavePayload, snapshot: SessionSnapshotInput) => {
      const pendingSession = {
        id: crypto.randomUUID(),
        ...payload,
        notes: null,
        snapshot,
      }

      let wasQueued = false
      try {
        wasQueued = await queueSession(pendingSession)
        setOutboxError(null)
        await refreshQueuedSessionCount()
      } catch (error) {
        setOutboxError(error)
      }

      try {
        const savedSession = await mutateSession(pendingSession)
        if (wasQueued) {
          await removeQueuedSession(pendingSession.id)
          await refreshQueuedSessionCount()
        }
        setLastSaveQueued(false)
        commitSavedSession(savedSession, snapshot)
      } catch (error) {
        setLastSaveQueued(wasQueued)
        throw error
      }
    },
    [commitSavedSession, mutateSession, refreshQueuedSessionCount]
  )

  const retryLastSessionSave = useCallback(async () => {
    const queuedSessions = await refreshQueuedSessionCount()
    const pendingSession = saveSession.variables ?? queuedSessions[0]?.payload
    if (!pendingSession) return

    try {
      const savedSession = await mutateSession(pendingSession)
      await removeQueuedSession(pendingSession.id)
      await refreshQueuedSessionCount()
      setLastSaveQueued(false)
      commitSavedSession(savedSession, pendingSession.snapshot)
    } catch {
      setLastSaveQueued(true)
      // The mutation retains the error so the retry control remains visible.
    }
  }, [commitSavedSession, mutateSession, refreshQueuedSessionCount, saveSession.variables])

  const flushQueuedSessions = useCallback(async () => {
    const queuedSessions = await refreshQueuedSessionCount()

    for (const queuedSession of queuedSessions) {
      try {
        await mutateSession(queuedSession.payload)
        await removeQueuedSession(queuedSession.id)
      } catch {
        setLastSaveQueued(true)
        break
      }
    }

    const remainingSessions = await refreshQueuedSessionCount()
    if (remainingSessions.length === 0) {
      setLastSaveQueued(false)
    }
  }, [mutateSession, refreshQueuedSessionCount])

  useEffect(() => {
    if (!userId) return

    const handleOnline = () => {
      void flushQueuedSessions()
    }

    const initialSyncTimeout = window.setTimeout(() => {
      void refreshQueuedSessionCount().then((queuedSessions) => {
        if (queuedSessions.length > 0 && navigator.onLine) {
          void flushQueuedSessions()
        }
      })
    }, 0)

    window.addEventListener('online', handleOnline)
    return () => {
      window.clearTimeout(initialSyncTimeout)
      window.removeEventListener('online', handleOnline)
    }
  }, [flushQueuedSessions, refreshQueuedSessionCount, userId])

  return {
    saveSession,
    saveTimerSession,
    retryLastSessionSave,
    queuedSessionCount,
    lastSaveQueued,
    outboxError,
    isSavingSession: saveSession.isPending,
  }
}
