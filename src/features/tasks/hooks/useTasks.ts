import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_TASK_COLOR, POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { getNextPosition, requireUserId, shouldRenormalizeById } from '@/lib/ordering'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/utils/supabase'
import type { Task, TaskWithCategory } from '@/types'

interface ReorderTaskContext {
  previous: TaskWithCategory[]
  userId: string
}

export function tasksQueryKey(userId?: string) {
  return queryKeys.tasks(userId)
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
          'id, user_id, category_id, name, color, position, completed_at, created_at, categories(id, name, color, archived_at)'
        )
        .eq('user_id', user!.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as TaskWithCategory[]
    },
    enabled: !!user,
  })

  const addTask = useMutation({
    mutationFn: async ({ name, categoryId }: { name: string; categoryId: string | null }) => {
      const userId = requireUserId(user?.id)
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
          'id, user_id, category_id, name, color, position, completed_at, created_at, categories(id, name, color, archived_at)'
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
      const userId = requireUserId(user?.id)
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
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasksRoot() })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasksRoot() })
    },
  })

  const restoreTask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: null })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.subtasksRoot() })
    },
  })

  const moveTask = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const userId = requireUserId(user?.id)
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
      const userId = requireUserId(user?.id)

      const { error } = await supabase
        .from('tasks')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<TaskWithCategory[]>(tasksQueryKey(userId)) ?? []
      const movedTask = cached.find((task) => task.id === id)
      if (!movedTask) return

      const bucket = cached.filter(
        (task) =>
          task.completed_at === null &&
          task.category_id === movedTask.category_id &&
          task.user_id === movedTask.user_id
      )

      const reordered = bucket
        .map((task) => (task.id === id ? { ...task, position: newPosition } : task))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

      if (!shouldRenormalizeById(reordered, id, POSITION_RENORMALIZE_THRESHOLD)) return

      const renormalized = reordered.map((task, index) => toTaskRow(task, index))
      const { error: renormalizeError } = await supabase.from('tasks').upsert(renormalized, {
        onConflict: 'id',
      })

      if (renormalizeError) throw renormalizeError
    },
    onMutate: async ({ id, newPosition }): Promise<ReorderTaskContext> => {
      const userId = requireUserId(user?.id)
      await queryClient.cancelQueries({ queryKey: tasksQueryKey(userId) })

      const previous = queryClient.getQueryData<TaskWithCategory[]>(tasksQueryKey(userId)) ?? []
      const optimistic = previous
        .map((task) => (task.id === id ? { ...task, position: newPosition } : task))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

      queryClient.setQueryData(tasksQueryKey(userId), optimistic)
      return { previous, userId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(tasksQueryKey(context.userId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey(user?.id) })
    },
  })

  const allTasks = tasksQuery.data ?? []
  const activeTasks = allTasks.filter((task) => task.completed_at === null)
  const completedTasks = allTasks
    .filter((task) => task.completed_at !== null)
    .sort((a, b) => {
      const aValue = a.completed_at ?? a.created_at
      const bValue = b.completed_at ?? b.created_at
      return bValue.localeCompare(aValue)
    })

  return {
    tasks: activeTasks,
    activeTasks,
    completedTasks,
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    addTask,
    updateTask,
    completeTask,
    restoreTask,
    deleteTask,
    moveTask,
    reorderTask,
  }
}
