import { BarChart3 } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDuration } from '@/lib/formatting'

interface BreakdownDatum {
  key: string
  name: string
  color: string
  totalSeconds: number
  sessionCount: number
  detail?: string
}

interface BreakdownChartProps {
  data: BreakdownDatum[]
}

function BreakdownTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload?: BreakdownDatum }>
}) {
  const item = active ? payload?.[0]?.payload : undefined
  if (!item) return null

  return (
    <div className="rounded-xl border border-surface-border bg-surface-overlay p-3 text-xs text-ink-secondary shadow-xl">
      <p className="text-ink-primary">{item.name}</p>
      <p className="mt-1">{formatDuration(item.totalSeconds)}</p>
      <p>{item.sessionCount} sessions</p>
      {item.detail ? <p>{item.detail}</p> : null}
    </div>
  )
}

export function BreakdownChart({ data }: BreakdownChartProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        description="Complete a few focused sessions in this range to reveal the pattern."
        icon={<BarChart3 className="h-5 w-5" />}
        title="No focus data yet"
      />
    )
  }

  const chartData = data.map((item) => ({
    ...item,
    hours: Number((item.totalSeconds / 3600).toFixed(2)),
  }))

  return (
    <div>
      <div className="w-full" style={{ height: Math.max(220, data.length * 44) }}>
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
          >
            <XAxis
              tick={{ fill: '#b8c0e0', fontSize: 11 }}
              tickFormatter={(value) => `${value}h`}
              type="number"
            />
            <YAxis
              dataKey="name"
              tick={{ fill: '#b8c0e0', fontSize: 11 }}
              type="category"
              width={120}
            />
            <Tooltip content={<BreakdownTooltip />} />
            <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
              {chartData.map((entry) => (
                <Cell fill={entry.color} key={entry.key} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 space-y-1">
        {data.map((item) => (
          <p className="text-xs text-ink-tertiary" key={item.key}>
            {item.name} · {item.sessionCount} sessions · {formatDuration(item.totalSeconds)}
          </p>
        ))}
      </div>
    </div>
  )
}
