import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { toSessionSnapshotColumns } from '@/lib/sessionSnapshot'
import type { Session } from '@/types'
import { supabase } from '@/lib/supabaseClient'
import type { SaveSessionInput } from '@/features/sessions/types'

export function useSessionSave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: SaveSessionInput) => {
      const sessionRow = {
        id: payload.id,
        user_id: payload.user_id,
        task_id: payload.task_id,
        work_seconds: payload.work_seconds,
        break_seconds: payload.break_seconds,
        started_at: payload.started_at,
        ended_at: payload.ended_at,
        notes: payload.notes ?? null,
        ...toSessionSnapshotColumns(payload.snapshot),
      }
      const { data, error } = await supabase
        .from('sessions')
        .insert(sessionRow)
        .select('*')
        .single()

      if (error?.code === '23505') {
        const { data: existing, error: existingError } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', payload.id)
          .eq('user_id', payload.user_id)
          .single()

        if (existingError) throw existingError
        return existing as Session
      }

      if (error) throw error
      return data as Session
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(variables.user_id) })
    },
  })
}
