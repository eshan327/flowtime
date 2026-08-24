import { useMemo, useState } from 'react'
import { BarChart3, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { BreakdownChart } from '@/features/stats/components/BreakdownChart'
import { DailyBarChart } from '@/features/stats/components/DailyBarChart'
import { HeatmapGrid } from '@/features/stats/components/HeatmapGrid'
import { SessionLog } from '@/features/sessions/components/SessionLog'
import { SummaryCards } from '@/features/stats/components/SummaryCards'
import { useStats } from '@/features/stats/hooks/useStats'
import { formatDuration } from '@/lib/formatting'
import { formatRangeWindow, getRangeDatesForAnchor, shiftRangeAnchor } from '@/lib/dateRange'
import { toLocalDateKey } from '@/lib/dateMath'
import { getErrorMessage } from '@/lib/errorMessages'
import type { SessionWithTask, TimeRange } from '@/types'

function getNavigationFloor() {
  const floor = new Date()
  floor.setFullYear(floor.getFullYear() - 5, 0, 1)
  floor.setHours(0, 0, 0, 0)
  return floor
}

export function StatsPage() {
  const [range, setRange] = useState<TimeRange>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date())
  const [selectedHeatmapDate, setSelectedHeatmapDate] = useState<string | null>(null)

  const stats = useStats(range, anchorDate)

  const selectedWindow = useMemo(
    () => getRangeDatesForAnchor(range, anchorDate),
    [range, anchorDate]
  )
  const currentWindow = useMemo(() => getRangeDatesForAnchor(range, new Date()), [range])
  const previousWindow = useMemo(() => {
    const previousAnchor = shiftRangeAnchor(range, anchorDate, -1)
    return getRangeDatesForAnchor(range, previousAnchor)
  }, [range, anchorDate])
  const navigationFloor = useMemo(() => getNavigationFloor(), [])

  const isCurrentWindow = selectedWindow.from.getTime() === currentWindow.from.getTime()
  const canGoPrevious = previousWindow.to.getTime() >= navigationFloor.getTime()
  const canGoNext = selectedWindow.from.getTime() < currentWindow.from.getTime()
  const selectedWindowLabel = formatRangeWindow(range, selectedWindow.from, selectedWindow.to)
  const hasRangeData = stats.totalSessions > 0

  const selectedHeatmapDay = useMemo(() => {
    if (!selectedHeatmapDate) {
      return null
    }

    return stats.allDays.find((day) => day.date === selectedHeatmapDate) ?? null
  }, [selectedHeatmapDate, stats.allDays])

  const heatmapSessionsByDate = useMemo(() => {
    const map = new Map<string, SessionWithTask[]>()

    for (const session of stats.heatmapSessions) {
      const key = toLocalDateKey(new Date(session.started_at))
      const existing = map.get(key)
      if (existing) {
        existing.push(session)
      } else {
        map.set(key, [session])
      }
    }

    return map
  }, [stats.heatmapSessions])

  const selectedHeatmapSessions = useMemo(() => {
    if (!selectedHeatmapDate) return []
    return heatmapSessionsByDate.get(selectedHeatmapDate) ?? []
  }, [heatmapSessionsByDate, selectedHeatmapDate])

  if (stats.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (stats.error) {
    return (
      <section className="rounded-xl bg-surface-panel p-6">
        <p className="text-sm text-red-300">
          {getErrorMessage(stats.error, 'Unable to load stats right now.')}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-7">
      <header>
        <h1 className="text-4xl font-medium tracking-tight">Insights</h1>
      </header>

      <SummaryCards
        currentStreak={stats.currentStreak}
        totalSessions={stats.totalSessions}
        totalWorkSeconds={stats.totalWorkSeconds}
      />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm text-ink-secondary">
            Focus time by{' '}
            <select
              aria-label="Focus time range"
              className="rounded-lg border border-surface-border-subtle bg-surface-sidebar px-2 py-1 text-sm text-ink-primary outline-none transition-colors focus:border-accent-primary focus:ring-2 focus:ring-accent-primary/15"
              onChange={(event) => setRange(event.target.value as TimeRange)}
              value={range}
            >
              {(['day', 'week', 'month', 'year'] as const).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </h2>

          <div className="flex items-center gap-2">
            <Button
              disabled={isCurrentWindow}
              onClick={() => setAnchorDate(new Date())}
              size="sm"
              variant="ghost"
            >
              Today
            </Button>

            <Button
              aria-label="Previous period"
              disabled={!canGoPrevious}
              onClick={() => setAnchorDate((current) => shiftRangeAnchor(range, current, -1))}
              size="icon"
              variant="outlined"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-32 text-center text-xs text-ink-secondary">
              {selectedWindowLabel}
            </span>

            <Button
              aria-label="Next period"
              disabled={!canGoNext}
              onClick={() => setAnchorDate((current) => shiftRangeAnchor(range, current, 1))}
              size="icon"
              variant="outlined"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {hasRangeData ? (
          <DailyBarChart data={stats.byDay} range={range} />
        ) : (
          <div className="rounded-xl bg-surface-panel">
            <EmptyState
              className="py-5"
              icon={<BarChart3 className="h-5 w-5" />}
              title="No sessions in this range"
            />
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Activity heatmap</h2>
        <div className="rounded-xl bg-surface-panel p-4">
          <HeatmapGrid
            data={stats.allDays}
            onSelectDay={(day) => {
              setSelectedHeatmapDate((current) => (current === day.date ? null : day.date))
            }}
            selectedDate={selectedHeatmapDate}
          />
        </div>

        {selectedHeatmapDay ? (
          <div className="mt-3 rounded-xl bg-surface-panel p-4">
            <div className="mb-3">
              <div>
                <p className="text-sm text-ink-primary">
                  Activity on{' '}
                  {new Date(`${selectedHeatmapDay.date}T00:00:00`).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </p>
                <p className="text-xs text-ink-tertiary">
                  {selectedHeatmapSessions.length} sessions ·{' '}
                  {formatDuration(selectedHeatmapDay.totalSeconds)} focused
                </p>
              </div>
            </div>

            <SessionLog pageSize={6} sessions={selectedHeatmapSessions} />
          </div>
        ) : null}
      </section>

      {hasRangeData ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <section className="rounded-xl bg-surface-panel p-4">
            <h2 className="mb-2 text-sm text-ink-secondary">Time by category</h2>
            <BreakdownChart
              data={stats.byCategory.map((item) => ({
                color: item.color,
                key: item.categoryId ?? item.categoryName,
                name: item.categoryName,
                sessionCount: item.sessionCount,
                totalSeconds: item.totalSeconds,
              }))}
            />
          </section>

          <section className="rounded-xl bg-surface-panel p-4">
            <h2 className="mb-2 text-sm text-ink-secondary">Time by task</h2>
            <BreakdownChart
              data={stats.byTask.map((item) => ({
                color: item.color,
                detail: item.categoryName ?? 'Uncategorized',
                key: item.taskId ?? item.taskName,
                name: item.taskName,
                sessionCount: item.sessionCount,
                totalSeconds: item.totalSeconds,
              }))}
            />
          </section>
        </div>
      ) : null}
    </section>
  )
}
