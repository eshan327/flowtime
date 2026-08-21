import { BarChart3 } from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { CHART_TEXT_COLOR } from '@/lib/colors'
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
    <div className="rounded-lg border border-surface-border-subtle bg-surface-panel p-3 text-xs text-ink-secondary shadow-xl">
      <p className="text-ink-primary">{item.name}</p>
      <p className="mt-1">{formatDuration(item.totalSeconds)}</p>
      <p>{item.sessionCount} sessions</p>
      {item.detail ? <p>{item.detail}</p> : null}
    </div>
  )
}

export function BreakdownChart({ data }: BreakdownChartProps) {
  if (data.length === 0) {
    return <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No focus data yet" />
  }

  return (
    <div
      aria-label="Focus time ranking"
      className="w-full"
      role="group"
      style={{ height: Math.max(180, data.length * 40) }}
    >
      <ul className="sr-only">
        {data.map((item) => (
          <li key={item.key}>
            {item.name}: {formatDuration(item.totalSeconds)}, {item.sessionCount} sessions
          </li>
        ))}
      </ul>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 72, left: 8, bottom: 8 }}>
          <XAxis
            axisLine={false}
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }}
            tickFormatter={(value) => formatDuration(Math.round(Number(value)))}
            tickLine={false}
            type="number"
          />
          <YAxis
            axisLine={false}
            dataKey="name"
            tick={{ fill: CHART_TEXT_COLOR, fontSize: 11 }}
            tickLine={false}
            type="category"
            width={120}
          />
          <Tooltip content={<BreakdownTooltip />} />
          <Bar dataKey="totalSeconds" radius={[0, 6, 6, 0]}>
            {data.map((entry) => (
              <Cell fill={entry.color} key={entry.key} />
            ))}
            <LabelList
              dataKey="totalSeconds"
              fill={CHART_TEXT_COLOR}
              fontSize={11}
              formatter={(value) => formatDuration(Math.round(Number(value)))}
              position="right"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
