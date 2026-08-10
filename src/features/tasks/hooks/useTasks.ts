import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DEFAULT_TASK_COLOR, POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import {
  applyOptimisticReorder,
  getNextPosition,
  requireUserId,
  shouldRenormalizeById,
  sortByPositionAndCreatedAt,
} from '@/lib/ordering'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabaseClient'
import type { Task, TaskWithCategory } from '@/types'

interface ReorderTaskContext {
  previous: TaskWithCategory[]
  userId: string
}

const TASK_WITH_CATEGORY_SELECT =
  'id, user_id, category_id, name, color, position, completed_at, created_at, categories(id, name, color, archived_at)'

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

  const requireCurrentUserId = () => requireUserId(user?.id)

  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select(TASK_WITH_CATEGORY_SELECT)
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
      const userId = requireCurrentUserId()
      const existing = queryClient.getQueryData<TaskWithCategory[]>(queryKeys.tasks(userId)) ?? []
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
        .select(TASK_WITH_CATEGORY_SELECT)
        .single()

      if (error) throw error
      return data as TaskWithCategory
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, name, color }: { id: string; name?: string; color?: string }) => {
      const userId = requireCurrentUserId()
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) }),
  })

  const completeTask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const completedAt = new Date().toISOString()
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: completedAt })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.subtasks(id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase.from('tasks').delete().eq('id', id).eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: (_result, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.subtasks(id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const restoreTask = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: null })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) }),
  })

  const moveTask = useMutation({
    mutationFn: async ({ id, categoryId }: { id: string; categoryId: string | null }) => {
      const userId = requireCurrentUserId()
      const existing = queryClient.getQueryData<TaskWithCategory[]>(queryKeys.tasks(userId)) ?? []
      const currentTask = existing.find((task) => task.id === id)
      const tasksInTargetCategory = existing.filter(
        (task) => task.id !== id && task.category_id === categoryId
      )
      const nextPosition = getNextPosition(tasksInTargetCategory)

      const updates: Partial<Pick<Task, 'category_id' | 'position' | 'color'>> = {
        category_id: categoryId,
        position: nextPosition,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) }),
  })

  const reorderTask = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = requireCurrentUserId()

      const { error } = await supabase
        .from('tasks')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<TaskWithCategory[]>(queryKeys.tasks(userId)) ?? []
      const movedTask = cached.find((task) => task.id === id)
      if (!movedTask) return

      const bucket = cached.filter(
        (task) =>
          task.completed_at === null &&
          task.category_id === movedTask.category_id &&
          task.user_id === movedTask.user_id
      )

      const reordered = applyOptimisticReorder(bucket, id, newPosition)

      if (!shouldRenormalizeById(reordered, id, POSITION_RENORMALIZE_THRESHOLD)) return

      const renormalized = reordered.map((task, index) => toTaskRow(task, index))
      const { error: renormalizeError } = await supabase.from('tasks').upsert(renormalized, {
        onConflict: 'id',
      })

      if (renormalizeError) throw renormalizeError
    },
    onMutate: async ({ id, newPosition }): Promise<ReorderTaskContext> => {
      const userId = requireCurrentUserId()
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks(userId) })

      const previous = queryClient.getQueryData<TaskWithCategory[]>(queryKeys.tasks(userId)) ?? []
      const movedTask = previous.find((task) => task.id === id)
      if (!movedTask) {
        return { previous, userId }
      }

      const bucket = previous.filter(
        (task) =>
          task.completed_at === null &&
          task.category_id === movedTask.category_id &&
          task.user_id === movedTask.user_id
      )
      const optimisticBucket = applyOptimisticReorder(bucket, id, newPosition)
      const optimisticBucketById = new Map(optimisticBucket.map((task) => [task.id, task]))

      const optimistic = sortByPositionAndCreatedAt(
        previous.map((task) => optimisticBucketById.get(task.id) ?? task)
      )

      queryClient.setQueryData(queryKeys.tasks(userId), optimistic)
      return { previous, userId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(queryKeys.tasks(context.userId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data])
  const { activeTasks, completedTasks } = useMemo(() => {
    const nextActiveTasks: TaskWithCategory[] = []
    const nextCompletedTasks: TaskWithCategory[] = []

    for (const task of allTasks) {
      if (task.completed_at === null) {
        nextActiveTasks.push(task)
        continue
      }

      nextCompletedTasks.push(task)
    }

    nextCompletedTasks.sort((a, b) => {
      const aValue = a.completed_at ?? a.created_at
      const bValue = b.completed_at ?? b.created_at
      return bValue.localeCompare(aValue)
    })

    return {
      activeTasks: nextActiveTasks,
      completedTasks: nextCompletedTasks,
    }
  }, [allTasks])

  return {
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
