import { useCallback, useEffect, useMemo } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useUser } from '@/hooks/useUser'
import { queryKeys } from '@/lib/queryKeys'
import {
  aggregateByCategory,
  aggregateByDay,
  aggregateByHour,
  aggregateByTask,
  aggregateByWeek,
  buildHeatmapData,
  computeStreak,
  getRangeDatesForAnchor,
  shiftRangeAnchor,
} from '@/lib/utils'
import type { Session, SessionWithTask, TimeRange } from '@/types'
import { supabase } from '@/utils/supabase'

export function useStats(range: TimeRange, anchorDate: Date) {
  const { user } = useUser()
  const userId = user?.id
  const queryClient = useQueryClient()
  const { from, to } = useMemo(() => getRangeDatesForAnchor(range, anchorDate), [range, anchorDate])

  const fetchRangeSessions = useCallback(
    async (fromDate: Date, toDate: Date) => {
      if (!userId) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase
        .from('sessions')
        .select('*, tasks(id, name, color, category_id, categories(name, color))')
        .eq('user_id', userId)
        .gte('started_at', fromDate.toISOString())
        .lte('started_at', toDate.toISOString())
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as SessionWithTask[]
    },
    [userId]
  )

  const rangeQuery = useQuery({
    queryKey: queryKeys.sessionsStatsRange(userId, range, from.toISOString(), to.toISOString()),
    queryFn: async () => fetchRangeSessions(from, to),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  })

  const heatmapQuery = useQuery({
    queryKey: queryKeys.sessionsHeatmap(userId),
    queryFn: async () => {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from('sessions')
        .select('*, tasks(id, name, color, category_id, categories(name, color))')
        .eq('user_id', userId!)
        .gte('started_at', yearAgo.toISOString())
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as SessionWithTask[]
    },
    enabled: !!userId,
  })

  useEffect(() => {
    if (!userId) return

    const previousAnchor = shiftRangeAnchor(range, anchorDate, -1)
    const nextAnchor = shiftRangeAnchor(range, anchorDate, 1)

    const previousRange = getRangeDatesForAnchor(range, previousAnchor)
    const nextRange = getRangeDatesForAnchor(range, nextAnchor)

    void queryClient.prefetchQuery({
      queryKey: queryKeys.sessionsStatsRange(
        userId,
        range,
        previousRange.from.toISOString(),
        previousRange.to.toISOString()
      ),
      queryFn: async () => fetchRangeSessions(previousRange.from, previousRange.to),
    })

    void queryClient.prefetchQuery({
      queryKey: queryKeys.sessionsStatsRange(
        userId,
        range,
        nextRange.from.toISOString(),
        nextRange.to.toISOString()
      ),
      queryFn: async () => fetchRangeSessions(nextRange.from, nextRange.to),
    })
  }, [queryClient, userId, range, anchorDate, fetchRangeSessions])

  const streakQuery = useQuery({
    queryKey: queryKeys.sessionsStreak(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, started_at, work_seconds')
        .eq('user_id', userId!)
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as Pick<Session, 'id' | 'started_at' | 'work_seconds'>[]
    },
    enabled: !!userId,
  })

  const sessions = rangeQuery.data ?? []
  const allSessions = heatmapQuery.data ?? []
  const streakSessions = streakQuery.data ?? []
  const streak = computeStreak(streakSessions)

  const isLoading =
    (rangeQuery.isLoading && !rangeQuery.data) ||
    (heatmapQuery.isLoading && !heatmapQuery.data) ||
    (streakQuery.isLoading && !streakQuery.data)

  return {
    isLoading,
    error: rangeQuery.error ?? heatmapQuery.error ?? streakQuery.error,
    sessions,
    totalSessions: sessions.length,
    totalWorkSeconds: sessions.reduce((sum, session) => sum + session.work_seconds, 0),
    currentStreak: streak.current,
    longestStreak: streak.longest,
    byDay:
      range === 'day'
        ? aggregateByHour(sessions, from)
        : range === 'year'
          ? aggregateByWeek(sessions, from, to)
          : aggregateByDay(sessions, from, to),
    byCategory: aggregateByCategory(sessions),
    byTask: aggregateByTask(sessions),
    allDays: buildHeatmapData(allSessions),
  }
}
