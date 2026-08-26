import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { CHART_GRID_COLOR, CHART_TEXT_COLOR } from '@/lib/colors'
import { formatDuration } from '@/lib/formatting'
import type { DaySummary, TimeRange } from '@/types'

interface DailyBarChartProps {
  range: TimeRange
  data: DaySummary[]
}

interface DailyTooltipPayloadItem {
  name?: string
  value?: number | string
  payload?: {
    totalSeconds?: number
  }
}

interface DailyTooltipProps {
  active?: boolean
  label?: string
  payload?: DailyTooltipPayloadItem[]
}

function formatLabel(date: string, range: TimeRange) {
  if (range === 'day') {
    const hourPart = Number(date.split('T')[1] ?? '0')
    const parsed = new Date(2025, 0, 1, hourPart, 0, 0, 0)
    return parsed.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
  }

  const parsed = new Date(`${date}T00:00:00`)
  if (range === 'week') {
    return parsed.toLocaleDateString('en-US', { weekday: 'short' })
  }

  if (range === 'month') {
    return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function CustomTooltip({ active, payload, label }: DailyTooltipProps) {
  if (!active || !payload?.length) return null

  const totalSeconds =
    typeof payload[0]?.payload?.totalSeconds === 'number' ? payload[0].payload.totalSeconds : 0

  return (
    <div className="rounded-lg border border-surface-border-subtle bg-surface-panel p-3 text-xs text-ink-secondary shadow-xl">
      <p className="text-ink-primary">{label}</p>
      <p className="mt-1">Total: {formatDuration(totalSeconds)}</p>
      <div className="mt-2 space-y-1">
        {payload
          .filter((item) => Number(item.value) > 0)
          .map((item) => (
            <p key={String(item.name)}>
              {item.name}: {formatDuration(Math.round(Number(item.value)))}
            </p>
          ))}
      </div>
    </div>
  )
}

export function DailyBarChart({ range, data }: DailyBarChartProps) {
  const { chartData, categories } = useMemo(() => {
    const categoryMap = new Map<
      string,
      { key: string; name: string; color: string; totalSeconds: number }
    >()

    const rows = data.map((day) => {
      const row: Record<string, number | string> = {
        label: formatLabel(day.date, range),
        totalSeconds: day.totalSeconds,
      }

      for (const bucket of day.byCategory) {
        const key = bucket.categoryId ?? 'uncategorized'
        row[key] = bucket.seconds
        const existing = categoryMap.get(key)
        categoryMap.set(
          key,
          existing
            ? { ...existing, totalSeconds: existing.totalSeconds + bucket.seconds }
            : {
                key,
                name: bucket.categoryName,
                color: bucket.color,
                totalSeconds: bucket.seconds,
              }
        )
      }

      return row
    })

    return {
      chartData: rows,
      categories: Array.from(categoryMap.values()),
    }
  }, [data, range])

  if (!data.some((day) => day.totalSeconds > 0)) {
    return <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No sessions in this range" />
  }
  const totalSeconds = categories.reduce((sum, category) => sum + category.totalSeconds, 0)

  return (
    <div className="rounded-md border border-surface-border bg-surface-sidebar/30 p-4">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div
          aria-label={`Focus time by ${range}`}
          className="h-[250px] min-w-0 flex-1"
          role="group"
        >
          <p className="sr-only">
            {data
              .filter((day) => day.totalSeconds > 0)
              .map((day) => `${formatLabel(day.date, range)}: ${formatDuration(day.totalSeconds)}`)
              .join(', ')}
          </p>
          <ResponsiveContainer>
            <BarChart
              barCategoryGap="0%"
              barGap={0}
              data={chartData}
              margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
            >
              <CartesianGrid
                stroke={CHART_GRID_COLOR}
                strokeOpacity={0.6}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                interval={range === 'day' ? 2 : 'preserveStartEnd'}
                minTickGap={8}
                padding={{ left: 0, right: 0 }}
                axisLine={false}
                tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }}
                tickMargin={8}
                tickLine={false}
              />
              <YAxis
                axisLine={false}
                tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }}
                tickFormatter={(value) => formatDuration(Math.round(Number(value)))}
                tickLine={false}
                type="number"
                allowDecimals={false}
                width={64}
              />
              <Tooltip content={<CustomTooltip />} />

              {categories.map((category) => (
                <Bar
                  dataKey={category.key}
                  fill={category.color}
                  key={category.key}
                  name={category.name}
                  stackId="total"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul
          aria-label="Category colors"
          className="flex shrink-0 flex-wrap content-start gap-x-4 gap-y-3 border-t border-surface-border-subtle pt-3 sm:w-52 sm:flex-col sm:border-l sm:border-t-0 sm:pl-5 sm:pt-2"
        >
          {categories.map((category) => (
            <li
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 text-xs text-ink-secondary"
              key={category.key}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="truncate">{category.name}</span>
              <span className="tabular-nums text-ink-tertiary">
                {formatDuration(category.totalSeconds)} ·{' '}
                {Math.round((category.totalSeconds / totalSeconds) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
