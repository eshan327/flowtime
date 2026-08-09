import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
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
import type { Category } from '@/types'

interface ReorderCategoryContext {
  previous: Category[]
  userId: string
}

export function useCategories() {
  const queryClient = useQueryClient()
  const { user } = useUser()

  const requireCurrentUserId = () => requireUserId(user?.id)

  const categoriesQuery = useQuery({
    queryKey: queryKeys.categories(user?.id),
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
      const userId = requireCurrentUserId()
      const existing = queryClient.getQueryData<Category[]>(queryKeys.categories(userId)) ?? []

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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) }),
  })

  const renameCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) })
    },
  })

  const recolorCategory = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase
        .from('categories')
        .update({ color })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) })
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) })
    },
  })

  const reorderCategory = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = requireCurrentUserId()

      const { error } = await supabase
        .from('categories')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<Category[]>(queryKeys.categories(userId)) ?? []
      const activeCategories = cached.filter((category) => category.archived_at === null)

      const reordered = applyOptimisticReorder(activeCategories, id, newPosition)

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
      const userId = requireCurrentUserId()
      await queryClient.cancelQueries({ queryKey: queryKeys.categories(userId) })

      const previous = queryClient.getQueryData<Category[]>(queryKeys.categories(userId)) ?? []
      const optimistic = sortByPositionAndCreatedAt(
        applyOptimisticReorder(previous, id, newPosition)
      )

      queryClient.setQueryData(queryKeys.categories(userId), optimistic)

      return { previous, userId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(queryKeys.categories(context.userId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) })
    },
  })

  const archiveCategory = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const archivedAt = new Date().toISOString()
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: archivedAt })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
      return { id, archivedAt }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) })
    },
  })

  const unarchiveCategory = useMutation({
    mutationFn: async (id: string) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: null })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tasks(user?.id) })
      return queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) })
    },
  })

  const allCategories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const { categories, archivedCategories } = useMemo(() => {
    const nextCategories: Category[] = []
    const nextArchivedCategories: Category[] = []

    for (const category of allCategories) {
      if (category.archived_at == null) {
        nextCategories.push(category)
        continue
      }

      nextArchivedCategories.push(category)
    }

    return {
      categories: nextCategories,
      archivedCategories: nextArchivedCategories,
    }
  }, [allCategories])

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
