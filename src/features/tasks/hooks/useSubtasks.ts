import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/utils/supabase'
import type { Subtask } from '@/types'

export function subtasksQueryKey(taskId?: string) {
  return ['subtasks', taskId] as const
}

function assertUserId(userId?: string): string {
  if (!userId) {
    throw new Error('User is not authenticated')
  }

  return userId
}

function assertTaskId(taskId?: string): string {
  if (!taskId) {
    throw new Error('Task is required for subtask operations')
  }

  return taskId
}

function getNextPosition(items: Array<{ position: number }>) {
  const maxPosition = items.length > 0 ? Math.max(...items.map((item) => item.position)) : -1
  return maxPosition + 1
}

function shouldRenormalize(items: Subtask[], movedSubtaskId: string) {
  const movedIndex = items.findIndex((item) => item.id === movedSubtaskId)
  if (movedIndex === -1) return false

  const moved = items[movedIndex]
  const previous = items[movedIndex - 1]
  const next = items[movedIndex + 1]

  const previousGap = previous
    ? Math.abs(moved.position - previous.position)
    : Number.POSITIVE_INFINITY
  const nextGap = next ? Math.abs(next.position - moved.position) : Number.POSITIVE_INFINITY

  return Math.min(previousGap, nextGap) < POSITION_RENORMALIZE_THRESHOLD
}

export function useSubtasks(taskId: string | null) {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const subtasksQuery = useQuery({
    queryKey: subtasksQueryKey(taskId ?? undefined),
    queryFn: async () => {
      const safeTaskId = assertTaskId(taskId ?? undefined)
      const { data, error } = await supabase
        .from('subtasks')
        .select('*')
        .eq('user_id', user!.id)
        .eq('task_id', safeTaskId)
        .is('completed_at', null)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Subtask[]
    },
    enabled: !!user && !!taskId,
  })

  const addSubtask = useMutation({
    mutationFn: async (name: string) => {
      const userId = assertUserId(user?.id)
      const safeTaskId = assertTaskId(taskId ?? undefined)
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
      const userId = assertUserId(user?.id)
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
      const userId = assertUserId(user?.id)
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
      const userId = assertUserId(user?.id)
      const { error } = await supabase.from('subtasks').delete().eq('id', id).eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: subtasksQueryKey(taskId ?? undefined) })
    },
  })

  const reorderSubtask = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = assertUserId(user?.id)
      const safeTaskId = assertTaskId(taskId ?? undefined)

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

      if (!shouldRenormalize(reordered, id)) return

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
    subtasks: subtasksQuery.data ?? [],
    isLoading: subtasksQuery.isLoading,
    error: subtasksQuery.error,
    addSubtask,
    renameSubtask,
    completeSubtask,
    deleteSubtask,
    reorderSubtask,
  }
}
