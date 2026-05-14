import { formatClock, formatDuration } from '@/lib/utils'

interface SessionSummaryProps {
  workSeconds: number
  breakTotal: number
  taskName: string | null
  taskColor: string | null
}

export function SessionSummary({
  workSeconds,
  breakTotal,
  taskName,
  taskColor,
}: SessionSummaryProps) {
  return (
    <section className="w-full max-w-md rounded-xl border border-surface-border bg-surface-raised p-4">
      <p className="text-sm text-ink-secondary">Session complete</p>

      <p className="mt-2 text-sm text-ink-primary">
        Focused for <span className="font-medium">{formatDuration(workSeconds)}</span>
      </p>
      <p className="mt-1 text-sm text-ink-primary">
        Break earned <span className="font-medium">{formatClock(breakTotal)}</span>
      </p>

      {taskName ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink-secondary">
          Task: {taskName}
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: taskColor ?? '#a8a8a8' }}
          />
        </p>
      ) : null}
    </section>
  )
}
