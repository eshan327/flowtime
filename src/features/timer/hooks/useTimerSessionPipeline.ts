import { createContext, useCallback, useEffect, useState } from 'react'
import { useSessionSave } from '@/features/sessions/hooks/useSessionSave'
import {
  getQueuedSessions,
  queueSession,
  removeQueuedSession,
} from '@/features/sessions/lib/sessionOutbox'
import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'

export interface TimerSessionSavePayload {
  id?: string
  user_id: string
  task_id: string | null
  work_seconds: number
  break_seconds: number
  started_at: string
  ended_at: string
}

interface UseTimerSessionPipelineOptions {
  userId?: string
}

export function useTimerSessionPipeline({ userId }: UseTimerSessionPipelineOptions) {
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

  const saveTimerSession = useCallback(
    async (payload: TimerSessionSavePayload, snapshot: SessionSnapshotInput) => {
      const pendingSession = {
        ...payload,
        id: payload.id ?? crypto.randomUUID(),
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
        await mutateSession(pendingSession)
        if (wasQueued) {
          await removeQueuedSession(pendingSession.id)
          await refreshQueuedSessionCount()
        }
        setLastSaveQueued(false)
      } catch (error) {
        setLastSaveQueued(wasQueued)
        throw error
      }
    },
    [mutateSession, refreshQueuedSessionCount]
  )

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

  const retryLastSessionSave = useCallback(async () => {
    try {
      const queuedSessions = await refreshQueuedSessionCount()
      if (queuedSessions.length > 0) {
        await flushQueuedSessions()
        return
      }
      if (!saveSession.isError || !saveSession.variables) return
      await mutateSession(saveSession.variables)
      setLastSaveQueued(false)
    } catch {
      setLastSaveQueued(true)
      // The mutation retains the error so the retry control remains visible.
    }
  }, [
    flushQueuedSessions,
    mutateSession,
    refreshQueuedSessionCount,
    saveSession.isError,
    saveSession.variables,
  ])

  useEffect(() => {
    if (!userId) return

    const handleOnline = () => {
      void flushQueuedSessions().catch(setOutboxError)
    }

    const initialSyncTimeout = window.setTimeout(() => {
      void refreshQueuedSessionCount()
        .then((queuedSessions) => {
          if (queuedSessions.length > 0 && navigator.onLine) {
            void flushQueuedSessions().catch(setOutboxError)
          }
        })
        .catch(setOutboxError)
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

export const TimerSessionContext = createContext<ReturnType<typeof useTimerSessionPipeline> | null>(
  null
)
