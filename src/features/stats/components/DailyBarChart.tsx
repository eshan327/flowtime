import { useMemo, type ComponentProps } from 'react'
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

type VerticalCoordinatesGenerator = NonNullable<
  ComponentProps<typeof CartesianGrid>['verticalCoordinatesGenerator']
>

const verticalCoordinatesGenerator: VerticalCoordinatesGenerator = ({ xAxis, offset }) => {
  const minX = offset.left
  const maxX = offset.left + offset.width
  const coordinates = (xAxis?.ticks as Array<{ coordinate?: number }> | undefined)
    ?.map((tick) => tick.coordinate)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))

  if (!coordinates?.length) {
    return []
  }

  const sorted = [...coordinates].sort((a, b) => a - b)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const ticksAreAlreadyBoundaries =
    Math.abs(first - minX) <= 1 || Math.abs(last - maxX) <= 1 || sorted.length <= 2

  if (ticksAreAlreadyBoundaries) {
    return sorted.filter((value) => value >= minX && value <= maxX)
  }

  const boundaries = [minX]
  for (let index = 0; index < sorted.length - 1; index += 1) {
    boundaries.push((sorted[index] + sorted[index + 1]) / 2)
  }
  boundaries.push(maxX)

  return boundaries
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
    const categoryMap = new Map<string, { key: string; name: string; color: string }>()

    const rows = data.map((day) => {
      const row: Record<string, number | string> = {
        label: formatLabel(day.date, range),
        totalSeconds: day.totalSeconds,
      }

      for (const bucket of day.byCategory) {
        const key = bucket.categoryId ?? 'uncategorized'
        row[key] = bucket.seconds
        categoryMap.set(key, {
          key,
          name: bucket.categoryName,
          color: bucket.color,
        })
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

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer>
        <BarChart
          barCategoryGap="0%"
          barGap={0}
          data={chartData}
          margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
        >
          <CartesianGrid
            stroke={CHART_GRID_COLOR}
            strokeOpacity={0.6}
            strokeDasharray="3 3"
            verticalCoordinatesGenerator={verticalCoordinatesGenerator}
          />
          <XAxis
            dataKey="label"
            interval={range === 'day' ? 0 : 'preserveStartEnd'}
            minTickGap={range === 'day' ? 0 : 8}
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
            width={56}
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
  )
}
