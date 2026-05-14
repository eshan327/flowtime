import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_TASK_COLOR, POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/utils/supabase'
import type { Task, TaskWithCategory } from '@/types'

export function tasksQueryKey(userId?: string) {
  return ['tasks', userId] as const
}

function assertUserId(userId?: string): string {
  if (!userId) {
    throw new Error('User is not authenticated')
  }

  return userId
}

function getNextPosition(items: Array<{ position: number }>) {
  const maxPosition = items.length > 0 ? Math.max(...items.map((item) => item.position)) : -1
  return maxPosition + 1
}

function shouldRenormalize(items: TaskWithCategory[], movedTaskId: string) {
  const movedIndex = items.findIndex((item) => item.id === movedTaskId)
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

function toTaskRow(task: TaskWithCategory, position: number): Task {
  return {
    id: task.id,
    user_id: task.user_id,
    category_id: task.category_id,
    name: task.name,
    color: task.color,
    position,
    completed_at: task.completed_at,
    created_at: task.created_at,
  }
}

export function useTasks() {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const tasksQuery = useQuery({
    queryKey: tasksQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(
          'id, user_id, category_id, name, color, position, completed_at, created_at, categories(name, color)'
        )
        .eq('user_id', user!.id)
        .is('completed_at', null)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as TaskWithCategory[]
    },
    enabled: !!user,
  })

  const addTask = useMutation({
    mutationFn: async ({ name, categoryId }: { name: string; categoryId: string | null }) => {
      const userId = assertUserId(user?.id)
      const existing = queryClient.getQueryData<TaskWithCategory[]>(tasksQueryKey(userId)) ?? []
      const tasksInCategory = existing.filter((task) => task.category_id === categoryId)

      const { data, error } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          category_id: categoryId,
          name: name.trim(),
          position: getNextPosition(tasksInCategory),
          color: categoryId ? null : DEFAULT_TASK_COLOR,
        })
        .select(
          'id, user_id, category_id, name, color, position, completed_at, created_at, categories(name, color)'
        )
        .single()

      if (error) throw error
      return data as TaskWithCategory
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
    },
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const userId = assertUserId(user?.id)
      const updates: Partial<Pick<Task, 'name' | 'color'>> = {}

      if (name !== undefined) {
        updates.name = name.trim()
      }

      if (color !== undefined) {
        updates.color = color
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
    },
  })

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const userId = assertUserId(user?.id)
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const userId = assertUserId(user?.id)
      const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
    },
  })

  const moveTask = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const userId = assertUserId(user?.id)
      const existing = queryClient.getQueryData<TaskWithCategory[]>(tasksQueryKey(userId)) ?? []
      const currentTask = existing.find((task) => task.id === id)
      const tasksInTargetCategory = existing.filter(
        (task) => task.id !== id && task.category_id === categoryId
      )

      const updates: Partial<Pick<Task, 'category_id' | 'position' | 'color'>> = {
        category_id: categoryId,
        position: getNextPosition(tasksInTargetCategory),
      }

      if (categoryId !== null) {
        updates.color = null
      }

      if (categoryId === null && !currentTask?.color) {
        updates.color = DEFAULT_TASK_COLOR
      }

      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
    },
  })

  const reorderTask = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = assertUserId(user?.id)

      const { error } = await supabase
        .from('tasks')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<TaskWithCategory[]>(tasksQueryKey(userId)) ?? []
      const reordered = cached
        .map((task) => (task.id === id ? { ...task, position: newPosition } : task))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

      if (!shouldRenormalize(reordered, id)) return

      const renormalized = reordered.map((task, index) => toTaskRow(task, index))
      const { error: renormalizeError } = await supabase.from('tasks').upsert(renormalized, {
        onConflict: 'id',
      })

      if (renormalizeError) throw renormalizeError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
    },
  })

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    addTask,
    updateTask,
    completeTask,
    deleteTask,
    moveTask,
    reorderTask,
  }
}
