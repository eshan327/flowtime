import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { getNextPosition, requireUserId, sortByPositionAndCreatedAt } from '@/lib/ordering'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabaseClient'
import type { Category } from '@/types'

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

  const updateCategory = useMutation({
    mutationFn: async ({
      id,
      name,
      color,
      archivedAt,
    }: {
      id: string
      name?: string
      color?: string
      archivedAt?: string | null
    }) => {
      const userId = requireCurrentUserId()
      const updates: Partial<Pick<Category, 'name' | 'color' | 'archived_at'>> = {}
      if (name !== undefined) updates.name = name.trim()
      if (color !== undefined) updates.color = color
      if (archivedAt !== undefined) updates.archived_at = archivedAt
      const { error } = await supabase
        .from('categories')
        .update(updates)
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

      const cached = queryClient.getQueryData<Category[]>(queryKeys.categories(userId)) ?? []
      const activeCategories = cached.filter((category) => category.archived_at === null)
      const reordered = sortByPositionAndCreatedAt(
        activeCategories.map((category) =>
          category.id === id ? { ...category, position: newPosition } : category
        )
      ).map((category, position) => ({ ...category, position }))
      const { error } = await supabase.from('categories').upsert(reordered, { onConflict: 'id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.categories(user?.id) }),
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
    updateCategory,
    deleteCategory,
    reorderCategory,
  }
}
