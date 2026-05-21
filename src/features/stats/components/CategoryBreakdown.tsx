import { Layers } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDuration } from '@/lib/formatting'
import type { CategorySummary } from '@/types'

interface CategoryBreakdownProps {
  data: CategorySummary[]
}

interface CategoryTooltipPayloadItem {
  payload?: {
    categoryName?: string
    totalSeconds?: number
    sessionCount?: number
  }
}

interface CategoryTooltipProps {
  active?: boolean
  payload?: CategoryTooltipPayloadItem[]
}

function CategoryTooltip({ active, payload }: CategoryTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null

  return (
    <div className="rounded-lg border border-surface-border bg-surface-overlay p-3 text-xs text-ink-secondary">
      <p className="text-ink-primary">{item.categoryName}</p>
      <p className="mt-1">{formatDuration(item.totalSeconds ?? 0)}</p>
      <p>{item.sessionCount ?? 0} sessions</p>
    </div>
  )
}

export function CategoryBreakdown({ data }: CategoryBreakdownProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        description="Track time against categorized tasks to see category-level trends here."
        icon={<Layers className="h-5 w-5" />}
        title="No category data"
      />
    )
  }

  const chartData = data.map((item) => ({
    ...item,
    hours: Number((item.totalSeconds / 3600).toFixed(2)),
    label: formatDuration(item.totalSeconds),
  }))

  const chartHeight = Math.max(220, data.length * 44)

  return (
    <div>
      <div className="w-full" style={{ height: chartHeight }}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <XAxis
              tick={{ fill: '#9e9a94', fontSize: 11 }}
              tickFormatter={(value) => `${value}h`}
              type="number"
            />
            <YAxis
              dataKey="categoryName"
              tick={{ fill: '#9e9a94', fontSize: 11 }}
              type="category"
              width={110}
            />
            <Tooltip content={<CategoryTooltip />} />
            <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
              {chartData.map((entry) => (
                <Cell fill={entry.color} key={entry.categoryId ?? entry.categoryName} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 space-y-1">
        {data.map((item) => (
          <p className="text-xs text-ink-tertiary" key={item.categoryId ?? item.categoryName}>
            {item.categoryName}: {item.sessionCount} sessions - {formatDuration(item.totalSeconds)}
          </p>
        ))}
      </div>
    </div>
  )
}
