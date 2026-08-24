import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatDuration } from '@/lib/formatting'
import { snapshotSession } from '@/lib/sessionSnapshot'
import type { SessionWithTask } from '@/types'

interface SessionLogProps {
  sessions: SessionWithTask[]
  onEdit?: (session: SessionWithTask) => void
  onDelete?: (session: SessionWithTask) => void
  deletingSessionId?: string | null
  pageSize?: number
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

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [sessions]
  )

  const totalPages = Math.max(1, Math.ceil(sortedSessions.length / pageSize))
  const activePage = Math.min(page, totalPages)

  if (sortedSessions.length === 0) {
    return (
      <p aria-live="polite" className="text-sm text-ink-tertiary">
        No sessions in this range yet.
      </p>
    )
  }

  const pageStart = (activePage - 1) * pageSize
  const pageSessions = sortedSessions.slice(pageStart, pageStart + pageSize)

  return (
    <div className="space-y-3">
      {pageSessions.map((session, index) => {
        const dateLabel = toDateLabel(session.started_at)
        const showDateHeader =
          index === 0 || toDateLabel(pageSessions[index - 1].started_at) !== dateLabel

        return (
          <div className="space-y-2" key={session.id}>
            {showDateHeader ? (
              <p className="text-xs uppercase tracking-[0.1em] text-ink-tertiary">{dateLabel}</p>
            ) : null}

            <div className="border-b border-surface-border-subtle px-1 pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm text-ink-primary">
                    {snapshotSession(session).taskNameSnapshot ?? 'No task'}
                  </p>
                  <p className="text-xs text-ink-tertiary">
                    {toTimeLabel(session.started_at)} - {toTimeLabel(session.ended_at)}
                  </p>
                  <p className="text-xs text-ink-secondary">
                    Work {formatDuration(session.work_seconds)} · Break{' '}
                    {formatDuration(session.break_seconds)}
                  </p>
                  {session.notes ? (
                    <p className="whitespace-pre-wrap text-xs text-ink-secondary">
                      Note: {session.notes}
                    </p>
                  ) : null}
                </div>

                {onEdit || onDelete ? (
                  <div className="flex items-center gap-2">
                    {onEdit ? (
                      <Button
                        onClick={() => {
                          onEdit(session)
                        }}
                        size="sm"
                        variant="ghost"
                      >
                        Edit
                      </Button>
                    ) : null}

                    {onDelete ? (
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
                    ) : null}
                  </div>
                ) : null}
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
