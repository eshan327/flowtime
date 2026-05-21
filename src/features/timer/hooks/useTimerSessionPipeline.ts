import { useCallback, type Dispatch, type SetStateAction } from 'react'
import { useSessionSave } from '@/features/timer/hooks/useSessionSave'
import { toSessionWithTask } from '@/lib/sessionSnapshot'
import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'
import type { SessionWithTask } from '@/types'

export interface TimerSessionSavePayload {
  user_id: string
  task_id: string | null
  work_seconds: number
  break_seconds: number
  started_at: string
  ended_at: string
}

interface UseTimerSessionPipelineOptions {
  setLastSessionId: (sessionId: string | null) => void
  setLastSavedSession: Dispatch<SetStateAction<SessionWithTask | null>>
}

export function useTimerSessionPipeline({
  setLastSessionId,
  setLastSavedSession,
}: UseTimerSessionPipelineOptions) {
  const saveSession = useSessionSave()

  const saveTimerSession = useCallback(
    async (payload: TimerSessionSavePayload, snapshot: SessionSnapshotInput) => {
      const savedSession = await saveSession.mutateAsync({
        ...payload,
        notes: null,
        snapshot,
      })

      setLastSessionId(savedSession.id)
      setLastSavedSession(toSessionWithTask(savedSession, snapshot))
    },
    [saveSession, setLastSessionId, setLastSavedSession]
  )

  return {
    saveSession,
    saveTimerSession,
    isSavingSession: saveSession.isPending,
  }
}
