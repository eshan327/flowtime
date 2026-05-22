import type { QueryClient } from '@tanstack/react-query'
import { getRangeDatesForAnchor } from '@/lib/dateRange'
import { measureAsync } from '@/lib/perf'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabaseClient'
import type { TimeRange } from '@/types'

const TASK_WITH_CATEGORY_SELECT =
  'id, user_id, category_id, name, color, position, completed_at, created_at, categories(id, name, color, archived_at)'

const SESSION_WITH_CATEGORY_SELECT =
  '*, tasks(id, name, color, category_id, categories(id, name, color, archived_at))'

function normalizeRoutePath(route: string): '/' | '/tasks' | '/stats' | '/history' | null {
  if (route === '/' || route.startsWith('/?')) return '/'
  if (route.startsWith('/tasks')) return '/tasks'
  if (route.startsWith('/stats')) return '/stats'
  if (route.startsWith('/history')) return '/history'
  return null
}

function prefetchCategories(queryClient: QueryClient, userId: string) {
  return measureAsync('prefetch:categories', () =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.categories(userId),
      staleTime: 60_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', userId)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true })

        if (error) throw error
        return data
      },
    })
  )
}

function prefetchTasks(queryClient: QueryClient, userId: string) {
  return measureAsync('prefetch:tasks', () =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.tasks(userId),
      staleTime: 60_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('tasks')
          .select(TASK_WITH_CATEGORY_SELECT)
          .eq('user_id', userId)
          .order('position', { ascending: true })
          .order('created_at', { ascending: true })

        if (error) throw error
        return data
      },
    })
  )
}

function prefetchStatsRange(queryClient: QueryClient, userId: string, range: TimeRange = 'week') {
  const { from, to } = getRangeDatesForAnchor(range, new Date())
  return measureAsync(`prefetch:stats-range:${range}`, () =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.sessionsStatsRange(userId, range, from.toISOString(), to.toISOString()),
      staleTime: 60_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('sessions')
          .select(SESSION_WITH_CATEGORY_SELECT)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('started_at', from.toISOString())
          .lte('started_at', to.toISOString())
          .order('started_at', { ascending: true })

        if (error) throw error
        return data
      },
    })
  )
}

function prefetchHeatmap(queryClient: QueryClient, userId: string) {
  const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)

  return measureAsync('prefetch:heatmap', () =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.sessionsHeatmap(userId),
      staleTime: 60_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('sessions')
          .select(SESSION_WITH_CATEGORY_SELECT)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('started_at', yearAgo.toISOString())
          .order('started_at', { ascending: true })

        if (error) throw error
        return data
      },
    })
  )
}

function prefetchStreak(queryClient: QueryClient, userId: string) {
  return measureAsync('prefetch:streak', () =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.sessionsStreak(userId),
      staleTime: 60_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('sessions')
          .select('id, started_at, work_seconds')
          .eq('user_id', userId)
          .is('deleted_at', null)
          .order('started_at', { ascending: true })

        if (error) throw error
        return data
      },
    })
  )
}

function prefetchHistoryMonth(queryClient: QueryClient, userId: string) {
  const { from, to } = getRangeDatesForAnchor('month', new Date())

  return measureAsync('prefetch:history-month', () =>
    queryClient.prefetchQuery({
      queryKey: queryKeys.sessionsHistoryRange(userId, from.toISOString(), to.toISOString()),
      staleTime: 60_000,
      queryFn: async () => {
        const { data, error } = await supabase
          .from('sessions')
          .select(SESSION_WITH_CATEGORY_SELECT)
          .eq('user_id', userId)
          .is('deleted_at', null)
          .gte('started_at', from.toISOString())
          .lte('started_at', to.toISOString())
          .order('started_at', { ascending: false })

        if (error) throw error
        return data
      },
    })
  )
}

function prefetchRouteTasksData(queryClient: QueryClient, userId: string) {
  return Promise.all([prefetchCategories(queryClient, userId), prefetchTasks(queryClient, userId)])
}

function prefetchRouteStatsData(queryClient: QueryClient, userId: string) {
  return Promise.all([
    prefetchStatsRange(queryClient, userId),
    prefetchHeatmap(queryClient, userId),
    prefetchStreak(queryClient, userId),
  ])
}

function prefetchRouteHistoryData(queryClient: QueryClient, userId: string) {
  return Promise.all([
    prefetchRouteTasksData(queryClient, userId),
    prefetchHistoryMonth(queryClient, userId),
  ])
}

export async function prefetchDataForRoute(
  route: string,
  queryClient: QueryClient,
  userId: string
) {
  const normalizedRoute = normalizeRoutePath(route)
  if (!normalizedRoute) return

  if (normalizedRoute === '/') {
    await prefetchTasks(queryClient, userId)
    return
  }

  if (normalizedRoute === '/tasks') {
    await prefetchRouteTasksData(queryClient, userId)
    return
  }

  if (normalizedRoute === '/stats') {
    await prefetchRouteStatsData(queryClient, userId)
    return
  }

  await prefetchRouteHistoryData(queryClient, userId)
}

export async function prefetchInitialAppData(queryClient: QueryClient, userId: string) {
  await Promise.all([
    prefetchRouteTasksData(queryClient, userId),
    prefetchRouteStatsData(queryClient, userId),
    prefetchHistoryMonth(queryClient, userId),
  ])
}
