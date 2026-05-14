import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { POSITION_RENORMALIZE_THRESHOLD } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { supabase } from '@/utils/supabase'
import type { Category } from '@/types'

export function categoriesQueryKey(userId?: string) {
  return ['categories', userId] as const
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

function shouldRenormalize(items: Category[], movedCategoryId: string) {
  const movedIndex = items.findIndex((item) => item.id === movedCategoryId)
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
      const userId = assertUserId(user?.id)
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
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] })
    },
  })

  const renameCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const userId = assertUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] })
    },
  })

  const recolorCategory = useMutation({
    mutationFn: async ({ id, color }: { id: string; color: string }) => {
      const userId = assertUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .update({ color })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] })
    },
  })

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const userId = assertUserId(user?.id)
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] })
    },
  })

  const reorderCategory = useMutation({
    mutationFn: async ({ id, newPosition }: { id: string; newPosition: number }) => {
      const userId = assertUserId(user?.id)

      const { error } = await supabase
        .from('categories')
        .update({ position: newPosition })
        .eq('id', id)
        .eq('user_id', userId)

      if (error) throw error

      const cached = queryClient.getQueryData<Category[]>(categoriesQueryKey(userId)) ?? []
      const reordered = cached
        .map((category) => (category.id === id ? { ...category, position: newPosition } : category))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

      if (!shouldRenormalize(reordered, id)) return

      const renormalized = reordered.map((category, index) => ({
        ...category,
        position: index,
      }))

      const { error: renormalizeError } = await supabase
        .from('categories')
        .upsert(renormalized, { onConflict: 'id' })

      if (renormalizeError) throw renormalizeError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: categoriesQueryKey(user?.id) })
      queryClient.invalidateQueries({ queryKey: ['tasks', user?.id] })
    },
  })

  return {
    categories: categoriesQuery.data ?? [],
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    addCategory,
    renameCategory,
    recolorCategory,
    deleteCategory,
    reorderCategory,
  }
}
