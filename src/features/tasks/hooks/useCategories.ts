import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { getNextPosition, requireUserId, shouldRenormalizeById } from '@/lib/ordering'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/utils/supabase'
import type { Category } from '@/types'

interface ReorderCategoryContext {
  previous: Category[]
  userId: string
}

export function categoriesQueryKey(userId?: string) {
  return queryKeys.categories(userId)
}

export function useCategories() {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const categoriesQuery = useQuery({
    queryKey: categoriesQueryKey(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user!.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as Category[]
    },
    enabled: !!user,
  })

  const addCategory = useMutation({
    mutationFn: async ({ name, color }: { name: string; color: string }) => {
      const userId = requireUserId(user?.id)
      const existing = queryClient.getQueryData<Category[]>(categoriesQueryKey(userId)) ?? []

      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: name.trim(),
          color,
          position: getNextPosition(existing),
        })
        .select('*')
        .single()

      if (error) throw error
      return data as Category
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const renameCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const recolorCategory = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .update({ color })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const reorderCategory = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = requireUserId(user?.id)

      const { error } = await supabase
        .from('categories')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<Category[]>(categoriesQueryKey(userId)) ?? []
      const activeCategories = cached.filter((category) => category.archived_at === null)

      const reordered = activeCategories
        .map((category) => (category.id === id ? { ...category, position: newPosition } : category))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

      if (!shouldRenormalizeById(reordered, id, POSITION_RENORMALIZE_THRESHOLD)) return

      const renormalized = reordered.map((category, index) => ({
        ...category,
        position: index,
      }))

      const { error: renormalizeError } = await supabase
        .from('categories')
        .upsert(renormalized, { onConflict: 'id' })

      if (renormalizeError) throw renormalizeError
    },
    onMutate: async ({ id, newPosition }): Promise<ReorderCategoryContext> => {
      const userId = requireUserId(user?.id)
      await queryClient.cancelQueries({ queryKey: categoriesQueryKey(userId) })

      const previous = queryClient.getQueryData<Category[]>(categoriesQueryKey(userId)) ?? []
      const optimistic = previous
        .map((category) => (category.id === id ? { ...category, position: newPosition } : category))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

      queryClient.setQueryData(categoriesQueryKey(userId), optimistic)

      return { previous, userId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(categoriesQueryKey(context.userId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const archiveCategory = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const unarchiveCategory = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: null })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
    },
  })

  const allCategories = categoriesQuery.data ?? []
  const categories = allCategories.filter((category) => category.archived_at == null)
  const archivedCategories = allCategories.filter((category) => category.archived_at != null)

  return {
    categories,
    archivedCategories,
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    addCategory,
    renameCategory,
    recolorCategory,
    archiveCategory,
    unarchiveCategory,
    deleteCategory,
    reorderCategory,
  }
}
