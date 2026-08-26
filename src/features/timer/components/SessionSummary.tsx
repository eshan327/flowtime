import { Button } from '@/components/ui/Button'
import { DEFAULT_NEUTRAL_COLOR } from '@/lib/colors'
import { formatClock, formatDuration } from '@/lib/formatting'

interface SessionSummaryProps {
  workSeconds: number
  breakTotal: number
  taskName: string | null
  taskColor: string | null
  onEditSession?: () => void
  onDeleteSession?: () => void
  onReplaySession?: () => void
  isDeletingSession?: boolean
}

export function SessionSummary({
  workSeconds,
  breakTotal,
  taskName,
  taskColor,
  onEditSession,
  onDeleteSession,
  onReplaySession,
  isDeletingSession = false,
}: SessionSummaryProps) {
  return (
    <section className="w-full border-y border-surface-border-subtle py-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-ink-primary">Session complete</p>
          <p className="mt-1 text-sm text-ink-secondary">
            {formatDuration(workSeconds)} focus <span aria-hidden="true">·</span>{' '}
            {formatClock(breakTotal)} break earned
          </p>
          {taskName ? (
            <span className="mt-2 inline-flex items-center gap-2 text-xs font-medium text-ink-tertiary">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: taskColor ?? DEFAULT_NEUTRAL_COLOR }}
              />
              {taskName}
            </span>
          ) : null}
        </div>
        {onReplaySession || onEditSession || onDeleteSession ? (
          <div className="flex flex-wrap items-center gap-1 sm:justify-end">
            {onReplaySession ? (
              <Button onClick={onReplaySession} size="sm" variant="outlined">
                Replay session
              </Button>
            ) : null}

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
      </div>
    </section>
  )
}
