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
import type { Category, TaskWithCategory } from '@/types'

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

  const requireCurrentUserId = () => requireUserId(user?.id)

  const updateCategoriesCache = (userId: string, updater: (current: Category[]) => Category[]) => {
    queryClient.setQueryData<Category[]>(categoriesQueryKey(userId), (current) =>
      updater(current ?? [])
    )
  }

  const updateTasksForCategory = (
    userId: string,
    categoryId: string,
    updater: (task: TaskWithCategory) => TaskWithCategory
  ) => {
    queryClient.setQueryData<TaskWithCategory[]>(queryKeys.tasks(userId), (current) =>
      (current ?? []).map((task) => (task.category_id === categoryId ? updater(task) : task))
    )
  }

  const patchCategoryInCache = (
    userId: string,
    categoryId: string,
    updater: (category: Category) => Category
  ) => {
    updateCategoriesCache(userId, (current) =>
      current.map((category) => (category.id === categoryId ? updater(category) : category))
    )
  }

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
    mutationFn: async ({
      name,
      color,
      breakDivisor,
    }: {
      name: string
      color: string
      breakDivisor: number | null
    }) => {
      const userId = requireCurrentUserId()
      const existing = queryClient.getQueryData<Category[]>(categoriesQueryKey(userId)) ?? []

      const { data, error } = await supabase
        .from('categories')
        .insert({
          user_id: userId,
          name: name.trim(),
          color,
          position: getNextPosition(existing),
          break_divisor: breakDivisor,
        })
        .select('*')
        .single()

      if (error) throw error
      return data as Category
    },
    onSuccess: (createdCategory) => {
      const userId = requireCurrentUserId()
      updateCategoriesCache(userId, (current) =>
        sortByPositionAndCreatedAt([...current, createdCategory])
      )
    },
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
    onSuccess: (_result, variables) => {
      const userId = requireCurrentUserId()

      patchCategoryInCache(userId, variables.id, (category) => ({
        ...category,
        name: variables.name.trim(),
      }))

      updateTasksForCategory(userId, variables.id, (task) => ({
        ...task,
        categories: task.categories
          ? {
              ...task.categories,
              name: variables.name.trim(),
            }
          : task.categories,
      }))
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
    onSuccess: (_result, variables) => {
      const userId = requireCurrentUserId()

      patchCategoryInCache(userId, variables.id, (category) => ({
        ...category,
        color: variables.color,
      }))

      updateTasksForCategory(userId, variables.id, (task) => ({
        ...task,
        categories: task.categories
          ? {
              ...task.categories,
              color: variables.color,
            }
          : task.categories,
      }))
    },
  })

  const setCategoryBreakDivisor = useMutation({
    mutationFn: async ({ id, breakDivisor }: { id: string; breakDivisor: number | null }) => {
      const userId = requireCurrentUserId()
      const { error } = await supabase
        .from('categories')
        .update({ break_divisor: breakDivisor })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: (_result, variables) => {
      const userId = requireCurrentUserId()

      patchCategoryInCache(userId, variables.id, (category) => ({
        ...category,
        break_divisor: variables.breakDivisor,
      }))

      updateTasksForCategory(userId, variables.id, (task) => ({
        ...task,
        categories: task.categories
          ? {
              ...task.categories,
              break_divisor: variables.breakDivisor,
            }
          : task.categories,
      }))
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
    onSuccess: (_result, id) => {
      const userId = requireCurrentUserId()

      updateCategoriesCache(userId, (current) => current.filter((category) => category.id !== id))

      updateTasksForCategory(userId, id, (task) => ({
        ...task,
        category_id: null,
        categories: null,
      }))
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

      const cached = queryClient.getQueryData<Category[]>(categoriesQueryKey(userId)) ?? []
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
      await queryClient.cancelQueries({ queryKey: categoriesQueryKey(userId) })

      const previous = queryClient.getQueryData<Category[]>(categoriesQueryKey(userId)) ?? []
      const optimistic = sortByPositionAndCreatedAt(
        applyOptimisticReorder(previous, id, newPosition)
      )

      queryClient.setQueryData(categoriesQueryKey(userId), optimistic)

      return { previous, userId }
    },
    onError: (_error, _variables, context) => {
      if (!context) return
      queryClient.setQueryData(categoriesQueryKey(context.userId), context.previous)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
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
    onSuccess: ({ id, archivedAt }) => {
      const userId = requireCurrentUserId()

      patchCategoryInCache(userId, id, (category) => ({ ...category, archived_at: archivedAt }))

      updateTasksForCategory(userId, id, (task) => ({
        ...task,
        categories: task.categories
          ? {
              ...task.categories,
              archived_at: archivedAt,
            }
          : task.categories,
      }))
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
    onSuccess: (_result, id) => {
      const userId = requireCurrentUserId()

      patchCategoryInCache(userId, id, (category) => ({ ...category, archived_at: null }))

      updateTasksForCategory(userId, id, (task) => ({
        ...task,
        categories: task.categories
          ? {
              ...task.categories,
              archived_at: null,
            }
          : task.categories,
      }))
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
    setCategoryBreakDivisor,
    archiveCategory,
    unarchiveCategory,
    deleteCategory,
    reorderCategory,
  }
}
