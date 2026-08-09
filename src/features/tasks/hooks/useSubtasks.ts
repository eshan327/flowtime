import { useMemo } from 'react'
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

export function useSubtasks(taskId: string | null) {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const requireCurrentUserId = () => requireUserId(user?.id)
  const requireSafeTaskId = () => requireTaskId(taskId ?? undefined)

  const subtasksQuery = useQuery({
    queryKey: queryKeys.subtasks(taskId ?? undefined),
    queryFn: async () => {
      const userId = requireCurrentUserId()
      const safeTaskId = requireSafeTaskId()
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('user_id', userId)
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
      const userId = requireCurrentUserId()
      const safeTaskId = requireSafeTaskId()
      const existing = queryClient.getQueryData<Subtask[]>(queryKeys.subtasks(safeTaskId)) ?? []

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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(taskId ?? undefined) }),
  })

  const renameSubtask = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase
        .from('subtasks')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(taskId ?? undefined) }),
  })

  const completeSubtask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const completedAt = new Date().toISOString()
      const { error } = await supabase
        .from('subtasks')
        .update({ completed_at: completedAt })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(taskId ?? undefined) }),
  })

  const deleteSubtask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase.from('subtasks').delete().eq('id', id).eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(taskId ?? undefined) }),
  })

  const reorderSubtask = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = requireCurrentUserId()
      const safeTaskId = requireSafeTaskId()

      const { error } = await supabase
        .from('subtasks')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<Subtask[]>(queryKeys.subtasks(safeTaskId)) ?? []
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
      const safeTaskId = requireSafeTaskId()
      await queryClient.cancelQueries({ queryKey: queryKeys.subtasks(safeTaskId) })

      const previous = queryClient.getQueryData<Subtask[]>(queryKeys.subtasks(safeTaskId)) ?? []
      const optimistic = applyOptimisticReorder(previous, id, newPosition)

      queryClient.setQueryData(queryKeys.subtasks(safeTaskId), optimistic)
      return { previous, safeTaskId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(queryKeys.subtasks(context.safeTaskId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(taskId ?? undefined) })
    },
  })

  const allSubtasks = useMemo(() => subtasksQuery.data ?? [], [subtasksQuery.data])
  const { subtasks, completedCount } = useMemo(() => {
    const activeSubtasks: Subtask[] = []
    let nextCompletedCount = 0

    for (const subtask of allSubtasks) {
      if (subtask.completed_at === null) {
        activeSubtasks.push(subtask)
      } else {
        nextCompletedCount += 1
      }
    }

    return {
      subtasks: activeSubtasks,
      completedCount: nextCompletedCount,
    }
  }, [allSubtasks])

  return {
    subtasks,
    totalCount: allSubtasks.length,
    completedCount,
    isLoading: subtasksQuery.isLoading,
    error: subtasksQuery.error,
    addSubtask,
    renameSubtask,
    completeSubtask,
    deleteSubtask,
    reorderSubtask,
  }
}
