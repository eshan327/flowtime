import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatClock, formatDuration } from '@/lib/utils'

interface SessionSummaryProps {
  workSeconds: number
  breakTotal: number
  taskName: string | null
  taskColor: string | null
  onEditSession?: () => void
  onDeleteSession?: () => void
  isDeletingSession?: boolean
}

export function SessionSummary({
  workSeconds,
  breakTotal,
  taskName,
  taskColor,
  onEditSession,
  onDeleteSession,
  isDeletingSession = false,
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
        <div className="mt-2">
          <p className="text-sm text-ink-secondary">Task</p>
          <div className="mt-1">
            <Badge color={taskColor ?? '#a8a8a8'} label={taskName} />
          </div>
        </div>
      ) : null}

      {onEditSession || onDeleteSession ? (
        <div className="mt-4 flex items-center gap-2">
          {onEditSession ? (
            <Button onClick={onEditSession} size="sm" variant="ghost">
              Edit last session
            </Button>
          ) : null}

          {onDeleteSession ? (
            <Button
              className="text-red-300 hover:text-red-200"
              loading={isDeletingSession}
              onClick={onDeleteSession}
              size="sm"
              variant="ghost"
            >
              Delete last session
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
