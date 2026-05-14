import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDuration } from '@/lib/utils'
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
    return date.split('T')[1] ?? date
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
    <div className="rounded-lg border border-surface-border bg-surface-overlay p-3 text-xs text-ink-secondary">
      <p className="text-ink-primary">{label}</p>
      <p className="mt-1">Total: {formatDuration(totalSeconds)}</p>
      <div className="mt-2 space-y-1">
        {payload
          .filter((item) => Number(item.value) > 0)
          .map((item) => (
            <p key={String(item.name)}>
              {item.name}: {formatDuration(Math.round(Number(item.value) * 3600))}
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
        row[key] = bucket.seconds / 3600
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

  if (data.length === 0) {
    return (
      <EmptyState
        description="Complete a few timer sessions in this range to populate the chart."
        icon={<BarChart3 className="h-5 w-5" />}
        title="No sessions in this range"
      />
    )
  }

  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer>
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#2e2c29" strokeDasharray="3 3" />
          <XAxis dataKey="label" tick={{ fill: '#9e9a94', fontSize: 11 }} />
          <YAxis
            tick={{ fill: '#9e9a94', fontSize: 11 }}
            tickFormatter={(value) => `${value}h`}
            type="number"
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
