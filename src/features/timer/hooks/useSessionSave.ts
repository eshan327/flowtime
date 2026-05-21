import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateSessionQueries } from '@/lib/sessionQueryInvalidation'
import { toSessionSnapshotColumns } from '@/lib/sessionSnapshot'
import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'
import type { Session } from '@/types'
import { supabase } from '@/lib/supabaseClient'

interface SaveSessionInput {
  user_id: string
  task_id: string | null
  work_seconds: number
  break_seconds: number
  started_at: string
  ended_at: string
  notes?: string | null
  snapshot: SessionSnapshotInput
}

export function useSessionSave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SaveSessionInput) => {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          user_id: payload.user_id,
          task_id: payload.task_id,
          work_seconds: payload.work_seconds,
          break_seconds: payload.break_seconds,
          started_at: payload.started_at,
          ended_at: payload.ended_at,
          notes: payload.notes ?? null,
          ...toSessionSnapshotColumns(payload.snapshot),
        })
        .select('*')
        .single()

      if (error) throw error
      return data as Session
    },
    onSuccess: (_data, variables) => {
      void invalidateSessionQueries(queryClient, variables.user_id)
    },
  })
}
