import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import {
  applyOptimisticReorder,
  getNextPosition,
  requireTaskId,
  requireUserId,
  shouldRenormalizeById,
} from '@/lib/ordering'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabaseClient'
import type { Subtask } from '@/types'

interface ReorderSubtaskContext {
  previous: Subtask[]
  safeTaskId: string
}

export function subtasksQueryKey(taskId?: string) {
  return queryKeys.subtasks(taskId)
}

export function useSubtasks(taskId: string | null) {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const updateSubtasksCache = (safeTaskId: string, updater: (current: Subtask[]) => Subtask[]) => {
    queryClient.setQueryData<Subtask[]>(subtasksQueryKey(safeTaskId), (current) =>
      updater(current ?? [])
    )
  }

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
    onSuccess: (createdSubtask) => {
      const safeTaskId = requireTaskId(taskId ?? undefined)
      updateSubtasksCache(safeTaskId, (current) => [...current, createdSubtask])
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
    onSuccess: (_result, variables) => {
      const safeTaskId = requireTaskId(taskId ?? undefined)
      updateSubtasksCache(safeTaskId, (current) =>
        current.map((subtask) =>
          subtask.id === variables.id ? { ...subtask, name: variables.name.trim() } : subtask
        )
      )
    },
  })

  const completeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const completedAt = new Date().toISOString()
      const { error } = await supabase
        .from('subtasks')
        .update({ completed_at: completedAt })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return { id, completedAt }
    },
    onSuccess: ({ id, completedAt }) => {
      const safeTaskId = requireTaskId(taskId ?? undefined)
      updateSubtasksCache(safeTaskId, (current) =>
        current.map((subtask) =>
          subtask.id === id ? { ...subtask, completed_at: completedAt } : subtask
        )
      )
    },
  })

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase.from('subtasks').delete().eq('id', id).eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: (_result, id) => {
      const safeTaskId = requireTaskId(taskId ?? undefined)
      updateSubtasksCache(safeTaskId, (current) => current.filter((subtask) => subtask.id !== id))
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
      const reordered = applyOptimisticReorder(cached, id, newPosition)

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
    onMutate: async ({ id, newPosition }): Promise<ReorderSubtaskContext> => {
      const safeTaskId = requireTaskId(taskId ?? undefined)
      await queryClient.cancelQueries({ queryKey: subtasksQueryKey(safeTaskId) })

      const previous = queryClient.getQueryData<Subtask[]>(subtasksQueryKey(safeTaskId)) ?? []
      const optimistic = applyOptimisticReorder(previous, id, newPosition)

      queryClient.setQueryData(subtasksQueryKey(safeTaskId), optimistic)
      return { previous, safeTaskId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(subtasksQueryKey(context.safeTaskId), context.previous)
    },
    onSettled: () => {
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
