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
} from '@/lib/utils'
import { getRangeDatesForAnchor, shiftRangeAnchor } from '@/lib/dateRange'
import type { Session, SessionWithTask, TimeRange } from '@/types'
import { supabase } from '@/lib/supabaseClient'

const SESSION_WITH_CATEGORY_SELECT =
  '*, tasks(id, name, color, category_id, categories(id, name, color, archived_at, break_divisor))'

export function useStats(range: TimeRange, anchorDate: Date) {
  const { user } = useUser()
  const userId = user?.id
  const queryClient = useQueryClient()
  const { from, to } = useMemo(() => getRangeDatesForAnchor(range, anchorDate), [range, anchorDate])

  const fetchSessions = useCallback(
    async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date } = {}) => {
      if (!userId) {
        throw new Error('User not authenticated')
      }

      let query = supabase
        .from('sessions')
        .select(SESSION_WITH_CATEGORY_SELECT)
        .eq('user_id', userId)
        .is('deleted_at', null)

      if (fromDate) {
        query = query.gte('started_at', fromDate.toISOString())
      }

      if (toDate) {
        query = query.lte('started_at', toDate.toISOString())
      }

      const { data, error } = await query.order('started_at', { ascending: true })
      if (error) throw error
      return data as SessionWithTask[]
    },
    [userId]
  )

  const fetchRangeSessions = useCallback(
    async (fromDate: Date, toDate: Date) => {
      return fetchSessions({ fromDate, toDate })
    },
    [fetchSessions]
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
      return fetchSessions({ fromDate: yearAgo })
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
        .is('deleted_at', null)
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as Pick<Session, 'id' | 'started_at' | 'work_seconds'>[]
    },
    enabled: !!userId,
  })

  const sessions = useMemo(() => rangeQuery.data ?? [], [rangeQuery.data])
  const allSessions = useMemo(() => heatmapQuery.data ?? [], [heatmapQuery.data])
  const streakSessions = useMemo(() => streakQuery.data ?? [], [streakQuery.data])
  const streak = useMemo(() => computeStreak(streakSessions), [streakSessions])

  const totalWorkSeconds = useMemo(
    () => sessions.reduce((sum, session) => sum + session.work_seconds, 0),
    [sessions]
  )

  const byDay = useMemo(
    () =>
      range === 'day'
        ? aggregateByHour(sessions, from)
        : range === 'year'
          ? aggregateByWeek(sessions, from, to)
          : aggregateByDay(sessions, from, to),
    [range, sessions, from, to]
  )

  const byCategory = useMemo(() => aggregateByCategory(sessions), [sessions])
  const byTask = useMemo(() => aggregateByTask(sessions), [sessions])
  const allDays = useMemo(() => buildHeatmapData(allSessions), [allSessions])

  const isLoading =
    (rangeQuery.isLoading && !rangeQuery.data) ||
    (heatmapQuery.isLoading && !heatmapQuery.data) ||
    (streakQuery.isLoading && !streakQuery.data)

  return {
    isLoading,
    error: rangeQuery.error ?? heatmapQuery.error ?? streakQuery.error,
    sessions,
    totalSessions: sessions.length,
    totalWorkSeconds,
    currentStreak: streak.current,
    longestStreak: streak.longest,
    byDay,
    byCategory,
    byTask,
    allDays,
    heatmapSessions: allSessions,
  }
}
