import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CategoryBreakdown } from '@/features/stats/components/CategoryBreakdown'
import { DailyBarChart } from '@/features/stats/components/DailyBarChart'
import { HeatmapGrid } from '@/features/stats/components/HeatmapGrid'
import { SessionLog } from '@/features/sessions/components/SessionLog'
import { SummaryCards } from '@/features/stats/components/SummaryCards'
import { TaskBreakdown } from '@/features/stats/components/TaskBreakdown'
import { TimeRangeSelector } from '@/features/stats/components/TimeRangeSelector'
import { useStats } from '@/features/stats/hooks/useStats'
import { formatDuration } from '@/lib/formatting'
import { getRangeDatesForAnchor, shiftRangeAnchor } from '@/lib/dateRange'
import { toLocalDateKey } from '@/lib/dateMath'
import { getErrorMessage } from '@/lib/errorMessages'
import type { SessionWithTask, TimeRange } from '@/types'

function getNavigationFloor() {
  const floor = new Date()
  floor.setFullYear(floor.getFullYear() - 5, 0, 1)
  floor.setHours(0, 0, 0, 0)
  return floor
}

function formatRangeWindow(range: TimeRange, from: Date, to: Date) {
  if (range === 'day') {
    return from.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (range === 'week') {
    const startLabel = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endLabel = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startLabel} - ${endLabel}`
  }

  if (range === 'month') {
    return from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return from.toLocaleDateString('en-US', { year: 'numeric' })
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
      <section className="mx-auto max-w-5xl rounded-xl border border-surface-border bg-surface-raised p-6">
        <p className="text-sm text-red-300">
          {getErrorMessage(stats.error, 'Unable to load stats right now.')}
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Stats</p>
        <h1 className="mt-2 text-2xl font-light">Insights</h1>
      </header>

      <SummaryCards
        currentStreak={stats.currentStreak}
        totalSessions={stats.totalSessions}
        totalWorkSeconds={stats.totalWorkSeconds}
      />

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm text-ink-secondary">
            Focus time by <TimeRangeSelector onChange={setRange} value={range} />
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
              className={
                canGoPrevious
                  ? 'border border-ink-secondary bg-surface-overlay text-ink-primary shadow-[0_0_0_1px_rgba(240,237,232,0.08)] hover:border-ink-primary hover:bg-surface-raised disabled:opacity-100'
                  : 'border border-surface-border/40 bg-transparent text-ink-tertiary/40 disabled:opacity-100'
              }
              disabled={!canGoPrevious}
              onClick={() => setAnchorDate((current) => shiftRangeAnchor(range, current, -1))}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-32 text-center text-xs text-ink-secondary">
              {selectedWindowLabel}
            </span>

            <Button
              aria-label="Next period"
              className={
                canGoNext
                  ? 'border border-ink-secondary bg-surface-overlay text-ink-primary shadow-[0_0_0_1px_rgba(240,237,232,0.08)] hover:border-ink-primary hover:bg-surface-raised disabled:opacity-100'
                  : 'border border-surface-border/40 bg-transparent text-ink-tertiary/40 disabled:opacity-100'
              }
              disabled={!canGoNext}
              onClick={() => setAnchorDate((current) => shiftRangeAnchor(range, current, 1))}
              size="icon"
              variant="ghost"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DailyBarChart data={stats.byDay} range={range} />
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Activity heatmap</h2>
        <HeatmapGrid
          data={stats.allDays}
          onSelectDay={(day) => {
            setSelectedHeatmapDate((current) => (current === day.date ? null : day.date))
          }}
          selectedDate={selectedHeatmapDate}
        />

        {selectedHeatmapDay ? (
          <div className="mt-3 rounded-lg border border-surface-border bg-surface-raised/40 p-3">
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
                <p className="mt-1 text-xs text-ink-tertiary">
                  Click the same heatmap tile again to close this detail view.
                </p>
              </div>
            </div>

            <SessionLog pageSize={6} sessions={selectedHeatmapSessions} />
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-tertiary">
            Click a heatmap tile to inspect sessions from that day.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Time by category</h2>
        <CategoryBreakdown data={stats.byCategory} />
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Time by task</h2>
        <TaskBreakdown data={stats.byTask} />
      </section>
    </section>
  )
}
