import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatDuration } from '@/lib/utils'
import type { SessionWithTask } from '@/types'

interface SessionLogProps {
  sessions: SessionWithTask[]
  onEdit: (session: SessionWithTask) => void
  onDelete: (session: SessionWithTask) => void
  deletingSessionId?: string | null
  pageSize?: number
}

interface SessionEntry {
  session: SessionWithTask
  dateLabel: string
  timeLabel: string
  taskName: string
}

function toDateLabel(isoString: string) {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function toTimeLabel(isoString: string) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function SessionLog({
  sessions,
  onEdit,
  onDelete,
  deletingSessionId = null,
  pageSize = 12,
}: SessionLogProps) {
  const [page, setPage] = useState(1)

  const entries = useMemo<SessionEntry[]>(() => {
    return [...sessions]
      .sort((a, b) => b.started_at.localeCompare(a.started_at))
      .map((session) => ({
        session,
        dateLabel: toDateLabel(session.started_at),
        timeLabel: `${toTimeLabel(session.started_at)} - ${toTimeLabel(session.ended_at)}`,
        taskName: session.task_name_snapshot ?? session.tasks?.name ?? 'No task',
      }))
  }, [sessions])

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize))
  const activePage = Math.min(page, totalPages)

  if (entries.length === 0) {
    return <p className="text-sm text-ink-tertiary">No sessions in this range yet.</p>
  }

  const pageStart = (activePage - 1) * pageSize
  const pageEntries = entries.slice(pageStart, pageStart + pageSize)

  return (
    <div className="space-y-3">
      {pageEntries.map(({ session, dateLabel, timeLabel, taskName }, index) => {
        const previousEntry = pageEntries[index - 1]
        const showDateHeader = !previousEntry || previousEntry.dateLabel !== dateLabel

        return (
          <div className="space-y-2" key={session.id}>
            {showDateHeader ? (
              <p className="text-xs uppercase tracking-[0.1em] text-ink-tertiary">{dateLabel}</p>
            ) : null}

            <div className="rounded-lg border border-surface-border bg-surface-raised/50 px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm text-ink-primary">{taskName}</p>
                  <p className="text-xs text-ink-tertiary">{timeLabel}</p>
                  <p className="text-xs text-ink-secondary">
                    Work {formatDuration(session.work_seconds)} · Break{' '}
                    {formatDuration(session.break_seconds)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      onEdit(session)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Edit
                  </Button>

                  <Button
                    className="text-red-300 hover:text-red-200"
                    loading={deletingSessionId === session.id}
                    onClick={() => {
                      onDelete(session)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      <div className="flex items-center justify-between pt-1">
        <Button
          disabled={activePage <= 1}
          onClick={() => setPage((current) => Math.max(1, Math.min(totalPages, current) - 1))}
          size="sm"
          variant="ghost"
        >
          Previous
        </Button>

        <p className="text-xs text-ink-tertiary">
          Page {activePage} / {totalPages}
        </p>

        <Button
          disabled={activePage >= totalPages}
          onClick={() =>
            setPage((current) => Math.min(totalPages, Math.min(totalPages, current) + 1))
          }
          size="sm"
          variant="ghost"
        >
          Next
        </Button>
      </div>
    </div>
  )
}
