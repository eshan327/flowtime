import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CategoryBreakdown } from '@/features/stats/components/CategoryBreakdown'
import { DailyBarChart } from '@/features/stats/components/DailyBarChart'
import { HeatmapGrid } from '@/features/stats/components/HeatmapGrid'
import { SummaryCards } from '@/features/stats/components/SummaryCards'
import { TaskBreakdown } from '@/features/stats/components/TaskBreakdown'
import { TimeRangeSelector } from '@/features/stats/components/TimeRangeSelector'
import { useStats } from '@/features/stats/hooks/useStats'
import { getRangeDatesForAnchor, shiftRangeAnchor } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import type { TimeRange } from '@/types'

function getHistoryLowerBound(createdAt: string | null | undefined) {
  const januaryFallback = new Date(2026, 0, 1)
  januaryFallback.setHours(0, 0, 0, 0)

  if (!createdAt) {
    return januaryFallback
  }

  const parsedCreatedAt = new Date(createdAt)
  if (Number.isNaN(parsedCreatedAt.getTime())) {
    return januaryFallback
  }

  parsedCreatedAt.setHours(0, 0, 0, 0)

  if (parsedCreatedAt.getTime() > januaryFallback.getTime()) {
    return parsedCreatedAt
  }

  return januaryFallback
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
  const { user } = useUser()

  const [range, setRange] = useState<TimeRange>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date())

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

  const lowerBound = getHistoryLowerBound(user?.created_at)

  const isCurrentWindow = selectedWindow.from.getTime() === currentWindow.from.getTime()
  const canGoPrevious = previousWindow.to.getTime() >= lowerBound.getTime()
  const canGoNext = selectedWindow.from.getTime() < currentWindow.from.getTime()

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
          {stats.error instanceof Error ? stats.error.message : 'Unable to load stats right now.'}
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
            Focus time by{' '}
            <TimeRangeSelector
              onChange={(nextRange) => {
                setRange(nextRange)
              }}
              value={range}
            />
          </h2>

          <div className="flex items-center gap-2">
            <Button
              disabled={isCurrentWindow}
              onClick={() => {
                setAnchorDate(new Date())
              }}
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
              onClick={() => {
                setAnchorDate((current) => shiftRangeAnchor(range, current, -1))
              }}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-32 text-center text-xs text-ink-secondary">
              {formatRangeWindow(range, selectedWindow.from, selectedWindow.to)}
            </span>

            <Button
              aria-label="Next period"
              className={
                canGoNext
                  ? 'border border-ink-secondary bg-surface-overlay text-ink-primary shadow-[0_0_0_1px_rgba(240,237,232,0.08)] hover:border-ink-primary hover:bg-surface-raised disabled:opacity-100'
                  : 'border border-surface-border/40 bg-transparent text-ink-tertiary/40 disabled:opacity-100'
              }
              disabled={!canGoNext}
              onClick={() => {
                setAnchorDate((current) => shiftRangeAnchor(range, current, 1))
              }}
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
        <HeatmapGrid data={stats.allDays} />
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
