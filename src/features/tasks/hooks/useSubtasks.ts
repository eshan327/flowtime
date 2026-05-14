import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import {
  getNextPosition,
  requireTaskId,
  requireUserId,
  shouldRenormalizeById,
} from '@/lib/ordering'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/utils/supabase'
import type { Subtask } from '@/types'

export function subtasksQueryKey(taskId?: string) {
  return queryKeys.subtasks(taskId)
}

export function useSubtasks(taskId: string | null) {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const subtasksQuery = useQuery({
    queryKey: subtasksQueryKey(taskId ?? undefined),
    queryFn: async () => {
      const safeTaskId = requireTaskId(taskId ?? undefined)
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('task_id', safeTaskId)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Subtask[]
    },
    enabled: !!user && !!taskId,
  })

  const addSubtask = useMutation({
    mutationFn: async (name: string) => {
      const userId = requireUserId(user?.id)
      const safeTaskId = requireTaskId(taskId ?? undefined)
      const existing = queryClient.getQueryData<Subtask[]>(subtasksQueryKey(safeTaskId)) ?? []

      const { data, error } = await supabase
        .from('subtasks')
        .insert({
          user_id: userId,
          task_id: safeTaskId,
          name: name.trim(),
          position: getNextPosition(existing),
        })
        .select('*')
        .single()

      if (error) throw error
      return data as Subtask
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey(taskId ?? undefined) })
    },
  })

  const renameSubtask = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('subtasks')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey(taskId ?? undefined) })
    },
  })

  const completeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('subtasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey(taskId ?? undefined) })
    },
  })

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase.from('subtasks').delete().eq('id', id).eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey(taskId ?? undefined) })
    },
  })

  const reorderSubtask = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = requireUserId(user?.id)
      const safeTaskId = requireTaskId(taskId ?? undefined)

      const { error } = await supabase
        .from('subtasks')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<Subtask[]>(subtasksQueryKey(safeTaskId)) ?? []
      const reordered = cached
        .map((subtask) => (subtask.id === id ? { ...subtask, position: newPosition } : subtask))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

      if (!shouldRenormalizeById(reordered, id, POSITION_RENORMALIZE_THRESHOLD)) return

      const renormalized = reordered.map((subtask, index) => ({
        ...subtask,
        position: index,
      }))

      const { error: renormalizeError } = await supabase.from('subtasks').upsert(renormalized, {
        onConflict: 'id',
      })

      if (renormalizeError) throw renormalizeError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey(taskId ?? undefined) })
    },
  })

  return {
    subtasks: (subtasksQuery.data ?? []).filter((subtask) => subtask.completed_at === null),
    totalCount: (subtasksQuery.data ?? []).length,
    completedCount: (subtasksQuery.data ?? []).filter((subtask) => subtask.completed_at !== null)
      .length,
    isLoading: subtasksQuery.isLoading,
    error: subtasksQuery.error,
    addSubtask,
    renameSubtask,
    completeSubtask,
    deleteSubtask,
    reorderSubtask,
  }
}
