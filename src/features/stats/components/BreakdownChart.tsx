import { BarChart3 } from 'lucide-react'
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

export function BreakdownChart({ data }: BreakdownChartProps) {
  if (data.length === 0) {
    return <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No focus data yet" />
  }

  const maxSeconds = Math.max(...data.map((item) => item.totalSeconds), 1)
  const totalSeconds = data.reduce((sum, item) => sum + item.totalSeconds, 0)

  return (
    <ol aria-label="Focus time ranking" className="space-y-4">
      {data.map((item) => (
        <li
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2"
          key={item.key}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate text-sm text-ink-secondary">{item.name}</span>
          </div>
          <span className="text-xs tabular-nums text-ink-secondary">
            {formatDuration(item.totalSeconds)} ·{' '}
            {Math.round((item.totalSeconds / totalSeconds) * 100)}%
          </span>
          <span className="col-span-2 h-2 overflow-hidden rounded-full bg-surface-hover/70">
            <span
              className="block h-full rounded-full"
              style={{
                backgroundColor: item.color,
                width: `${(item.totalSeconds / maxSeconds) * 100}%`,
              }}
            />
          </span>
        </li>
      ))}
    </ol>
  )
}
