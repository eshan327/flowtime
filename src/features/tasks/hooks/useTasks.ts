import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { queryKeys } from '@/lib/queryKeys'
import { commandFlowtime, readAllFlowtime } from '@/lib/flowtimeApi'
import type { TaskWithCategory } from '@/types'
export interface TaskUpdate {
  id: string
  name?: string
  color?: string | null
  categoryId?: string | null
  completedAt?: string | null
  notes?: string | null
  due_date?: string | null
  priority?: string | null
  reference_url?: string | null
}
export function useTasks() {
  const { user } = useUser()
  const client = useQueryClient()
  const tasksQuery = useQuery({
    queryKey: queryKeys.tasks(user?.id),
    queryFn: () => readAllFlowtime<TaskWithCategory>('tasks', { status: 'all' }),
    enabled: !!user,
    refetchInterval: 3000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) }),
      client.invalidateQueries({ queryKey: queryKeys.sessions(user?.id) }),
    ])
  const mutate = async (operation: Record<string, unknown>) => {
    if (!user) throw new Error('Sign in to Flowtime.')
    const result = await commandFlowtime<{ items: TaskWithCategory[] }>('tasks', {
      operations: [operation],
    })
    return result.items[0]
  }
  const addTask = useMutation({
    mutationFn: ({ name, categoryId }: { name: string; categoryId: string | null }) =>
      mutate({ action: 'create', id: crypto.randomUUID(), name, category_id: categoryId }),
    onSuccess: invalidate,
  })
  const updateTask = useMutation({
    mutationFn: ({ id, categoryId, completedAt, ...changes }: TaskUpdate) =>
      mutate({
        action: 'update',
        id,
        ...changes,
        ...(categoryId !== undefined ? { category_id: categoryId } : {}),
        ...(completedAt !== undefined ? { completed: completedAt !== null } : {}),
      }).then(() => undefined),
    onSuccess: invalidate,
  })
  const deleteTask = useMutation({
    mutationFn: (id: string) => mutate({ action: 'trash', id }).then(() => undefined),
    onSuccess: invalidate,
  })
  const reorderTask = useMutation({
    mutationFn: ({ id, newPosition }: { id: string; newPosition: number }) =>
      mutate({ action: 'reorder', id, position: newPosition }).then(() => undefined),
    onSuccess: invalidate,
  })
  const allTasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data])
  return {
    activeTasks: allTasks.filter((t) => t.completed_at === null),
    completedTasks: allTasks
      .filter((t) => t.completed_at !== null)
      .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!)),
    isLoading: tasksQuery.isLoading,
    isFetching: tasksQuery.isFetching,
    error: tasksQuery.error,
    addTask,
    updateTask,
    deleteTask,
    reorderTask,
  }
}
