import { ListTodo } from 'lucide-react'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDuration } from '@/lib/utils'
import type { TaskSummary } from '@/types'

interface TaskBreakdownProps {
  data: TaskSummary[]
}

interface TaskTooltipPayloadItem {
  payload?: {
    taskName?: string
    totalSeconds?: number
    sessionCount?: number
    categoryName?: string | null
  }
}

interface TaskTooltipProps {
  active?: boolean
  payload?: TaskTooltipPayloadItem[]
}

function TaskTooltip({ active, payload }: TaskTooltipProps) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  if (!item) return null

  return (
    <div className="rounded-lg border border-surface-border bg-surface-overlay p-3 text-xs text-ink-secondary">
      <p className="text-ink-primary">{item.taskName}</p>
      <p className="mt-1">{formatDuration(item.totalSeconds ?? 0)}</p>
      <p>{item.sessionCount ?? 0} sessions</p>
      <p>Category: {item.categoryName ?? 'Uncategorized'}</p>
    </div>
  )
}

export function TaskBreakdown({ data }: TaskBreakdownProps) {
  if (data.length === 0) {
    return (
      <EmptyState
        description="Link your sessions to tasks to unlock detailed task performance insights."
        icon={<ListTodo className="h-5 w-5" />}
        title="No task data"
      />
    )
  }

  const chartData = data.map((item) => ({
    ...item,
    hours: Number((item.totalSeconds / 3600).toFixed(2)),
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
              dataKey="taskName"
              tick={{ fill: '#9e9a94', fontSize: 11 }}
              type="category"
              width={120}
            />
            <Tooltip content={<TaskTooltip />} />
            <Bar dataKey="hours" radius={[0, 6, 6, 0]}>
              {chartData.map((entry) => (
                <Cell fill={entry.color} key={entry.taskId ?? entry.taskName} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 space-y-1">
        {data.map((item) => (
          <p className="text-xs text-ink-tertiary" key={item.taskId ?? item.taskName}>
            {item.taskName} ({item.categoryName ?? 'Uncategorized'}) - {item.sessionCount} sessions
            - {formatDuration(item.totalSeconds)}
          </p>
        ))}
      </div>
    </div>
  )
}
