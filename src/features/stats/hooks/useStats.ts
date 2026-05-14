import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useUser } from '@/hooks/useUser'
import {
  aggregateByCategory,
  aggregateByDay,
  aggregateByHour,
  aggregateByTask,
  aggregateByWeek,
  buildHeatmapData,
  computeStreak,
  getRangeDates,
} from '@/lib/utils'
import type { Session, SessionWithTask, TimeRange } from '@/types'
import { supabase } from '@/utils/supabase'

export function useStats(range: TimeRange) {
  const { user } = useUser()
  const { from, to } = useMemo(() => getRangeDates(range), [range])

  const rangeQuery = useQuery({
    queryKey: ['sessions', user?.id, { range, from: from.toISOString(), to: to.toISOString() }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, tasks(id, name, color, category_id, categories(name, color))')
        .eq('user_id', user!.id)
        .gte('started_at', from.toISOString())
        .lte('started_at', to.toISOString())
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as SessionWithTask[]
    },
    enabled: !!user,
  })

  const heatmapQuery = useQuery({
    queryKey: ['sessions', user?.id, 'heatmap'],
    queryFn: async () => {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from('sessions')
        .select('*, tasks(id, name, color, category_id, categories(name, color))')
        .eq('user_id', user!.id)
        .gte('started_at', yearAgo.toISOString())
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as SessionWithTask[]
    },
    enabled: !!user,
  })

  const streakQuery = useQuery({
    queryKey: ['sessions', user?.id, 'streak'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, started_at, work_seconds')
        .eq('user_id', user!.id)
        .order('started_at', { ascending: true })

      if (error) throw error
      return data as Pick<Session, 'id' | 'started_at' | 'work_seconds'>[]
    },
    enabled: !!user,
  })

  const sessions = rangeQuery.data ?? []
  const allSessions = heatmapQuery.data ?? []
  const streakSessions = streakQuery.data ?? []
  const streak = computeStreak(streakSessions)

  return {
    isLoading: rangeQuery.isLoading || heatmapQuery.isLoading || streakQuery.isLoading,
    error: rangeQuery.error ?? heatmapQuery.error ?? streakQuery.error,
    sessions,
    totalSessions: sessions.length,
    totalWorkSeconds: sessions.reduce((sum, session) => sum + session.work_seconds, 0),
    currentStreak: streak.current,
    longestStreak: streak.longest,
    byDay:
      range === 'day'
        ? aggregateByHour(sessions)
        : range === 'year'
          ? aggregateByWeek(sessions)
          : aggregateByDay(sessions, from, to),
    byCategory: aggregateByCategory(sessions),
    byTask: aggregateByTask(sessions),
    allDays: buildHeatmapData(allSessions),
  }
}
