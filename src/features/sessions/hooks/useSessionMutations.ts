import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/hooks/useUser'
import { queryKeys } from '@/lib/queryKeys'
import { toSessionSnapshotColumns } from '@/lib/sessionSnapshot'
import type { SessionSnapshotInput } from '@/lib/sessionSnapshot'
import { supabase } from '@/lib/supabaseClient'

export interface SessionUpdateInput {
  id: string
  taskId: string | null
  workSeconds: number
  breakSeconds: number
  startedAt: string
  endedAt: string
  notes: string | null
  snapshot: SessionSnapshotInput
}

export function useSessionMutations() {
  const queryClient = useQueryClient()
  const { user } = useUser()

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
          ...toSessionSnapshotColumns(payload.snapshot),
          work_seconds: payload.workSeconds,
          break_seconds: payload.breakSeconds,
          started_at: payload.startedAt,
          ended_at: payload.endedAt,
          notes: payload.notes,
          edited_at: new Date().toISOString(),
        })
        .eq('id', payload.id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      if (user?.id) void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(user.id) })
    },
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
    onSuccess: () => {
      if (user?.id) void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(user.id) })
    },
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
    onSuccess: () => {
      if (user?.id) void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(user.id) })
    },
  })

  return {
    updateSession,
    softDeleteSession,
    restoreSession,
  }
}
