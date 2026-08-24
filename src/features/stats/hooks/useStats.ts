import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchSessionRows, fetchStreakRows } from '@/features/sessions/api/sessionQueries'
import { useUser } from '@/context/UserContext'
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
import { getRangeDatesForAnchor } from '@/lib/dateRange'
import type { TimeRange } from '@/types'

export function useStats(range: TimeRange, anchorDate: Date) {
  const { user } = useUser()
  const userId = user?.id
  const { from, to } = useMemo(() => getRangeDatesForAnchor(range, anchorDate), [range, anchorDate])

  const rangeQuery = useQuery({
    queryKey: queryKeys.sessionsStatsRange(userId, range, from.toISOString(), to.toISOString()),
    queryFn: () =>
      fetchSessionRows({
        userId: userId!,
        fromIso: from.toISOString(),
        toIso: to.toISOString(),
        ascending: true,
      }),
    enabled: !!userId,
    placeholderData: keepPreviousData,
  })

  const heatmapQuery = useQuery({
    queryKey: queryKeys.sessionsHeatmap(userId),
    queryFn: () => {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      return fetchSessionRows({
        userId: userId!,
        fromIso: yearAgo.toISOString(),
        ascending: true,
      })
    },
    enabled: !!userId,
  })

  const streakQuery = useQuery({
    queryKey: queryKeys.sessionsStreak(userId),
    queryFn: async () => fetchStreakRows(userId!),
    enabled: !!userId,
  })

  const sessions = useMemo(() => rangeQuery.data ?? [], [rangeQuery.data])
  const allSessions = useMemo(() => heatmapQuery.data ?? [], [heatmapQuery.data])
  const streakSessions = useMemo(() => streakQuery.data ?? [], [streakQuery.data])
  const currentStreak = useMemo(() => computeStreak(streakSessions), [streakSessions])
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
    currentStreak,
    byDay,
    byCategory,
    byTask,
    allDays,
    heatmapSessions: allSessions,
  }
}
