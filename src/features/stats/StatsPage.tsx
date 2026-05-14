import { useState } from 'react'
import { Spinner } from '@/components/ui/Spinner'
import { CategoryBreakdown } from '@/features/stats/components/CategoryBreakdown'
import { DailyBarChart } from '@/features/stats/components/DailyBarChart'
import { HeatmapGrid } from '@/features/stats/components/HeatmapGrid'
import { SummaryCards } from '@/features/stats/components/SummaryCards'
import { TaskBreakdown } from '@/features/stats/components/TaskBreakdown'
import { TimeRangeSelector } from '@/features/stats/components/TimeRangeSelector'
import { useStats } from '@/features/stats/hooks/useStats'
import type { TimeRange } from '@/types'

export function StatsPage() {
  const [range, setRange] = useState<TimeRange>('week')
  const stats = useStats(range)

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
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Stats</p>
          <h1 className="mt-2 text-2xl font-light">Insights</h1>
        </div>

        <TimeRangeSelector onChange={setRange} value={range} />
      </header>

      <SummaryCards
        currentStreak={stats.currentStreak}
        totalSessions={stats.totalSessions}
        totalWorkSeconds={stats.totalWorkSeconds}
      />

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Focus time by period</h2>
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
