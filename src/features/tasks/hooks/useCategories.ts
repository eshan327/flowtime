import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { queryKeys } from '@/lib/queryKeys'
import { commandFlowtime, readAllFlowtime } from '@/lib/flowtimeApi'
import type { Category } from '@/types'
export function useCategories() {
  const { user } = useUser()
  const client = useQueryClient()
  const query = useQuery({
    queryKey: queryKeys.categories(user?.id),
    queryFn: () => readAllFlowtime<Category>('categories'),
    enabled: !!user,
    refetchInterval: 3000,
  })
  const invalidate = () =>
    Promise.all([
      client.invalidateQueries({ queryKey: queryKeys.categories(user?.id) }),
      client.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) }),
    ])
  const mutate = async (op: Record<string, unknown>) => {
    if (!user) throw new Error('Sign in to Flowtime.')
    return (await commandFlowtime<{ items: Category[] }>('categories', { operations: [op] }))
      .items[0]
  }
  const addCategory = useMutation({
    mutationFn: ({ name, color }: { name: string; color: string }) =>
      mutate({ action: 'create', id: crypto.randomUUID(), name, color }),
    onSuccess: invalidate,
  })
  const updateCategory = useMutation({
    mutationFn: ({
      id,
      archivedAt,
      ...changes
    }: {
      id: string
      name?: string
      color?: string
      archivedAt?: string | null
    }) =>
      mutate({
        action: 'update',
        id,
        ...changes,
        ...(archivedAt !== undefined ? { archived: archivedAt !== null } : {}),
      }).then(() => undefined),
    onSuccess: invalidate,
  })
  const deleteCategory = useMutation({
    mutationFn: (id: string) => mutate({ action: 'trash', id }).then(() => undefined),
    onSuccess: invalidate,
  })
  const reorderCategory = useMutation({
    mutationFn: ({ id, newPosition }: { id: string; newPosition: number }) =>
      mutate({ action: 'reorder', id, position: newPosition }).then(() => undefined),
    onSuccess: invalidate,
  })
  return {
    categories: (query.data ?? []).filter((c) => c.archived_at === null),
    archivedCategories: (query.data ?? []).filter((c) => c.archived_at !== null),
    isLoading: query.isLoading,
    error: query.error,
    addCategory,
    updateCategory,
    deleteCategory,
    reorderCategory,
  }
}
