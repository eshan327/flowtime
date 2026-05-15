import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/hooks/useUser'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/utils/supabase'

export interface SessionSnapshotInput {
  taskIdSnapshot: string | null
  taskNameSnapshot: string | null
  taskColorSnapshot: string | null
  categoryIdSnapshot: string | null
  categoryNameSnapshot: string | null
  categoryColorSnapshot: string | null
}

export interface SessionUpdateInput {
  id: string
  taskId: string | null
  workSeconds: number
  breakSeconds: number
  startedAt: string
  endedAt: string
  snapshot: SessionSnapshotInput
}

export function useSessionMutations() {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const invalidateSessionQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.sessions(user?.id) })
  }

  const updateSession = useMutation({
    mutationFn: async (payload: SessionUpdateInput) => {
      const userId = user?.id
      if (!userId) {
        throw new Error('User is not authenticated')
      }

      const { error } = await supabase
        .from('sessions')
        .update({
          task_id: payload.taskId,
          task_id_snapshot: payload.snapshot.taskIdSnapshot,
          task_name_snapshot: payload.snapshot.taskNameSnapshot,
          task_color_snapshot: payload.snapshot.taskColorSnapshot,
          category_id_snapshot: payload.snapshot.categoryIdSnapshot,
          category_name_snapshot: payload.snapshot.categoryNameSnapshot,
          category_color_snapshot: payload.snapshot.categoryColorSnapshot,
          work_seconds: payload.workSeconds,
          break_seconds: payload.breakSeconds,
          started_at: payload.startedAt,
          ended_at: payload.endedAt,
          edited_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: invalidateSessionQueries,
  })

  const softDeleteSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const userId = user?.id
      if (!userId) {
        throw new Error('User is not authenticated')
      }

      const { error } = await supabase
        .from('sessions')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: invalidateSessionQueries,
  })

  const restoreSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const userId = user?.id
      if (!userId) {
        throw new Error('User is not authenticated')
      }

      const { error } = await supabase
        .from('sessions')
        .update({ deleted_at: null })
        .eq('id', sessionId)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: invalidateSessionQueries,
  })

  return {
    updateSession,
    softDeleteSession,
    restoreSession,
  }
}
