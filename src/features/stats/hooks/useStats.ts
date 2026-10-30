import { useMemo } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useUser } from '@/context/UserContext'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { fetchSessionRows } from '@/features/sessions/api/sessionQueries'
import { fetchFocusSummary, type FocusDay } from '@/lib/focusSummary'
import { getRangeDatesForAnchor } from '@/lib/dateRange'
import { queryKeys } from '@/lib/queryKeys'
import { DEFAULT_NEUTRAL_COLOR } from '@/lib/colors'
import { dateKeyInZone } from '@/lib/timezone'
import type { TimeRange, DaySummary, HeatmapDay } from '@/types'
function days(rows: FocusDay[]): DaySummary[] {
  return rows.map((d) => ({
    date: d.date,
    totalSeconds: d.work_seconds,
    byCategory: d.by_category.map((c) => ({
      categoryId: JSON.stringify([c.category_id, c.category_name, c.color]),
      categoryName: c.category_name ?? 'Uncategorized',
      color: c.color ?? DEFAULT_NEUTRAL_COLOR,
      seconds: c.work_seconds,
    })),
  }))
}
export function useStats(range: TimeRange, anchorDate: Date) {
  const { user } = useUser()
  const userId = user?.id
  const timezone = useTimerSettingsStore((s) => s.timezone)
  const { from, to } = useMemo(
    () => getRangeDatesForAnchor(range, anchorDate, timezone),
    [range, anchorDate, timezone]
  )
  const query = useQuery({
    queryKey: queryKeys.sessionsStatsRange(userId, range, from.toISOString(), to.toISOString()),
    enabled: !!userId,
    placeholderData: keepPreviousData,
    refetchInterval: 5000,
    queryFn: async () => {
      const yearAgo = new Date()
      yearAgo.setUTCFullYear(yearAgo.getUTCFullYear() - 1)
      const [summary, heatmap, sessions, heatmapSessions] = await Promise.all([
        fetchFocusSummary({
          from: from.toISOString(),
          to: to.toISOString(),
          timezone,
          period: range === 'day' ? 'day' : undefined,
          anchor: range === 'day' ? dateKeyInZone(anchorDate, timezone) : undefined,
        }),
        fetchFocusSummary({ from: yearAgo.toISOString(), to: new Date().toISOString(), timezone }),
        fetchSessionRows({ userId: userId!, fromIso: from.toISOString(), toIso: to.toISOString() }),
        fetchSessionRows({ userId: userId!, fromIso: yearAgo.toISOString() }),
      ])
      return { summary, heatmap, sessions, heatmapSessions }
    },
  })
  const summary = query.data?.summary
  const byDay = days(range === 'day' ? (summary?.by_hour ?? []) : (summary?.by_day ?? []))
  const allDays: HeatmapDay[] = days(query.data?.heatmap.by_day ?? []).map((d) => ({
    ...d,
    dominantColor: d.byCategory.toSorted((a, b) => b.seconds - a.seconds)[0]?.color ?? null,
  }))
  return {
    isLoading: query.isLoading,
    error: query.error,
    sessions: query.data?.sessions ?? [],
    totalSessions: summary?.session_count ?? 0,
    totalWorkSeconds: summary?.work_seconds ?? 0,
    currentStreak: summary?.current_streak ?? 0,
    byDay,
    byCategory: (summary?.by_category_snapshot ?? []).map((c) => ({
      categoryId: c.category_id,
      categoryName: c.category_name ?? 'Uncategorized',
      color: c.color ?? DEFAULT_NEUTRAL_COLOR,
      totalSeconds: c.work_seconds,
      sessionCount: c.session_count,
    })),
    byTask: (summary?.by_task_snapshot ?? []).map((t) => ({
      taskId: t.task_id,
      taskName: t.task_name ?? 'No task',
      categoryName: t.category_name,
      color: t.color ?? DEFAULT_NEUTRAL_COLOR,
      totalSeconds: t.work_seconds,
      sessionCount: t.session_count,
    })),
    allDays,
    heatmapSessions: query.data?.heatmapSessions ?? [],
  }
}
