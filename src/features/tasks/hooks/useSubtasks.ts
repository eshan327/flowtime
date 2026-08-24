import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import {
  getNextPosition,
  requireTaskId,
  requireUserId,
  sortByPositionAndCreatedAt,
} from '@/lib/ordering'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabaseClient'
import type { Subtask } from '@/types'

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

  const updateSubtask = useMutation({
    mutationFn: async ({
      id,
      name,
      completedAt,
    }: {
      id: string
      name?: string
      completedAt?: string | null
    }) => {
      const userId = requireCurrentUserId()
      const updates: Partial<Pick<Subtask, 'name' | 'completed_at'>> = {}
      if (name !== undefined) updates.name = name.trim()
      if (completedAt !== undefined) updates.completed_at = completedAt
      const { error } = await supabase
        .from('subtasks')
        .update(updates)
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
      const safeTaskId = requireSafeTaskId()

      const cached = queryClient.getQueryData<Subtask[]>(queryKeys.subtasks(safeTaskId)) ?? []
      const reordered = sortByPositionAndCreatedAt(
        cached
          .filter((subtask) => subtask.completed_at === null)
          .map((subtask) => (subtask.id === id ? { ...subtask, position: newPosition } : subtask))
      ).map((subtask, position) => ({ ...subtask, position }))
      const { error } = await supabase.from('subtasks').upsert(reordered, {
        onConflict: 'id',
      })
      if (error) throw error
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasks(taskId ?? undefined) }),
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
    updateSubtask,
    deleteSubtask,
    reorderSubtask,
  }
}
