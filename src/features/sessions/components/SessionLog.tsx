import { useMemo, useState } from 'react'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
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
    weekday: 'long',
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  const sortedSessions = useMemo(
    () => [...sessions].sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [sessions]
  )

  const totalPages = Math.max(1, Math.ceil(sortedSessions.length / pageSize))
  const activePage = Math.min(page, totalPages)

  if (sortedSessions.length === 0) {
    return (
      <p aria-live="polite" className="py-3 text-sm text-ink-tertiary">
        No sessions in this range yet.
      </p>
    )
  }

  const pageStart = (activePage - 1) * pageSize
  const pageSessions = sortedSessions.slice(pageStart, pageStart + pageSize)

  return (
    <div>
      <div className="hidden grid-cols-[94px_minmax(0,1.3fr)_minmax(0,1fr)_110px_110px_minmax(0,1.2fr)_36px] gap-4 border-b border-surface-border-subtle px-3 pb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-ink-tertiary md:grid">
        <span>Time</span>
        <span>Task</span>
        <span>Category</span>
        <span>Focus</span>
        <span>Break</span>
        <span>Notes</span>
        <span className="sr-only">Actions</span>
      </div>

      {pageSessions.map((session, index) => {
        const snapshot = snapshotSession(session)
        const dateLabel = toDateLabel(session.started_at)
        const showDateHeader =
          index === 0 || toDateLabel(pageSessions[index - 1].started_at) !== dateLabel

        return (
          <div key={session.id}>
            {showDateHeader ? (
              <p className="border-b border-surface-border px-3 py-3 text-xs font-medium text-ink-secondary">
                {dateLabel}
              </p>
            ) : null}

            <div className="grid gap-3 border-b border-surface-border-subtle px-3 py-4 transition-colors hover:bg-surface-hover/20 md:grid-cols-[94px_minmax(0,1.3fr)_minmax(0,1fr)_110px_110px_minmax(0,1.2fr)_36px] md:items-center md:gap-4">
              <p className="text-xs tabular-nums text-ink-tertiary">
                {toTimeLabel(session.started_at)}
              </p>
              <p className="truncate text-sm text-ink-primary">
                {snapshot.taskNameSnapshot ?? 'No task'}
              </p>
              <p className="flex min-w-0 items-center gap-2 text-xs text-ink-secondary">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: snapshot.categoryColorSnapshot ?? '#7f8ca8' }}
                />
                <span className="truncate">{snapshot.categoryNameSnapshot ?? 'Uncategorized'}</span>
              </p>
              <p className="text-xs tabular-nums text-ink-secondary">
                <span className="mr-1 text-ink-tertiary md:hidden">Focus</span>
                {formatDuration(session.work_seconds)}
              </p>
              <p className="text-xs tabular-nums text-ink-secondary">
                <span className="mr-1 text-ink-tertiary md:hidden">Break</span>
                {formatDuration(session.break_seconds)}
              </p>
              <p className="truncate text-xs text-ink-tertiary">{session.notes || '—'}</p>

              {onEdit || onDelete ? (
                <div className="relative justify-self-end">
                  <Button
                    aria-expanded={openMenuId === session.id}
                    aria-label="Session actions"
                    loading={deletingSessionId === session.id}
                    onClick={() =>
                      setOpenMenuId((current) => (current === session.id ? null : session.id))
                    }
                    size="icon"
                    variant="ghost"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                  {openMenuId === session.id ? (
                    <div className="absolute right-0 top-10 z-20 min-w-32 overflow-hidden rounded-md border border-surface-border bg-surface-panel p-1 shadow-2xl">
                      {onEdit ? (
                        <Button
                          className="w-full justify-start"
                          onClick={() => {
                            setOpenMenuId(null)
                            onEdit(session)
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <Pencil className="h-4 w-4" /> Edit
                        </Button>
                      ) : null}
                      {onDelete ? (
                        <Button
                          className="w-full justify-start text-red-300 hover:text-red-200"
                          onClick={() => {
                            setOpenMenuId(null)
                            onDelete(session)
                          }}
                          size="sm"
                          variant="ghost"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        )
      })}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between pt-4">
          <Button
            disabled={activePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
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
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            size="sm"
            variant="ghost"
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
