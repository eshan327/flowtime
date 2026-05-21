import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { CategoryBreakdown } from '@/features/stats/components/CategoryBreakdown'
import { DailyBarChart } from '@/features/stats/components/DailyBarChart'
import { HeatmapGrid } from '@/features/stats/components/HeatmapGrid'
import {
  SessionEditModal,
  type SessionEditValues,
} from '@/features/stats/components/SessionEditModal'
import { SessionLog } from '@/features/stats/components/SessionLog'
import { SummaryCards } from '@/features/stats/components/SummaryCards'
import { TaskBreakdown } from '@/features/stats/components/TaskBreakdown'
import { TimeRangeSelector } from '@/features/stats/components/TimeRangeSelector'
import {
  createSessionExportPayload,
  downloadSessionExportFile,
  type SessionExportFormat,
  type SessionExportScope,
} from '@/features/stats/lib/sessionExport'
import { useStats } from '@/features/stats/hooks/useStats'
import { useSessionMutations } from '@/features/stats/hooks/useSessionMutations'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { getRangeDatesForAnchor, shiftRangeAnchor } from '@/lib/dateRange'
import { getErrorMessage } from '@/lib/errorMessages'
import { useUser } from '@/hooks/useUser'
import { createSessionSnapshotForTaskId } from '@/lib/sessionSnapshot'
import type { SessionWithTask, TimeRange } from '@/types'

function getHistoryLowerBound(createdAt: string | null | undefined) {
  const januaryFallback = new Date(2026, 0, 1)
  januaryFallback.setHours(0, 0, 0, 0)

  const parsedCreatedAt = createdAt ? new Date(createdAt) : null
  if (!parsedCreatedAt) return januaryFallback
  if (Number.isNaN(parsedCreatedAt.getTime())) {
    return januaryFallback
  }

  parsedCreatedAt.setHours(0, 0, 0, 0)

  if (parsedCreatedAt.getTime() > januaryFallback.getTime()) {
    return parsedCreatedAt
  }

  return januaryFallback
}

function formatRangeWindow(range: TimeRange, from: Date, to: Date) {
  if (range === 'day') {
    return from.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  if (range === 'week') {
    const startLabel = from.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const endLabel = to.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return `${startLabel} - ${endLabel}`
  }

  if (range === 'month') {
    return from.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }

  return from.toLocaleDateString('en-US', { year: 'numeric' })
}

export function StatsPage() {
  const { user } = useUser()
  const { activeTasks } = useTasks()
  const { updateSession, softDeleteSession, restoreSession } = useSessionMutations()

  const [range, setRange] = useState<TimeRange>('week')
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date())
  const [editingSession, setEditingSession] = useState<SessionWithTask | null>(null)
  const [recentlyDeletedSession, setRecentlyDeletedSession] = useState<SessionWithTask | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [activeExport, setActiveExport] = useState<{
    scope: SessionExportScope
    format: SessionExportFormat
  } | null>(null)
  const undoTimeoutRef = useRef<number | null>(null)

  const stats = useStats(range, anchorDate)

  const selectedWindow = useMemo(
    () => getRangeDatesForAnchor(range, anchorDate),
    [range, anchorDate]
  )
  const currentWindow = useMemo(() => getRangeDatesForAnchor(range, new Date()), [range])
  const previousWindow = useMemo(() => {
    const previousAnchor = shiftRangeAnchor(range, anchorDate, -1)
    return getRangeDatesForAnchor(range, previousAnchor)
  }, [range, anchorDate])

  const lowerBound = getHistoryLowerBound(user?.created_at)

  const isCurrentWindow = selectedWindow.from.getTime() === currentWindow.from.getTime()
  const canGoPrevious = previousWindow.to.getTime() >= lowerBound.getTime()
  const canGoNext = selectedWindow.from.getTime() < currentWindow.from.getTime()
  const selectedWindowLabel = formatRangeWindow(range, selectedWindow.from, selectedWindow.to)

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current !== null) {
        window.clearTimeout(undoTimeoutRef.current)
      }
    }
  }, [])

  const handleSaveSessionEdit = async (values: SessionEditValues) => {
    if (!editingSession) return

    const selectedTask = values.taskId
      ? activeTasks.find((task) => task.id === values.taskId)
      : null

    const snapshot = createSessionSnapshotForTaskId(
      values.taskId,
      selectedTask ?? null,
      editingSession
    )

    await updateSession.mutateAsync({
      id: values.id,
      taskId: values.taskId,
      workSeconds: values.workSeconds,
      breakSeconds: values.breakSeconds,
      startedAt: values.startedAt,
      endedAt: values.endedAt,
      notes: values.notes,
      snapshot,
    })

    setEditingSession(null)
  }

  const handleDeleteSession = async (session: SessionWithTask) => {
    setDeletingSessionId(session.id)

    try {
      await softDeleteSession.mutateAsync(session.id)
      setRecentlyDeletedSession(session)

      if (undoTimeoutRef.current !== null) {
        window.clearTimeout(undoTimeoutRef.current)
      }

      undoTimeoutRef.current = window.setTimeout(() => {
        setRecentlyDeletedSession(null)
      }, 7000)
    } finally {
      setDeletingSessionId(null)
    }
  }

  const handleExport = async (scope: SessionExportScope, format: SessionExportFormat) => {
    setActiveExport({ scope, format })
    setExportError(null)

    try {
      const sessionsForExport = await stats.getSessionsForExport(scope)
      const payload = createSessionExportPayload({
        sessions: sessionsForExport,
        scope,
        format,
        range,
        from: scope === 'range' ? selectedWindow.from : undefined,
        to: scope === 'range' ? selectedWindow.to : undefined,
      })

      downloadSessionExportFile(payload)
    } catch (error) {
      setExportError(getErrorMessage(error, 'Unable to export sessions right now.'))
    } finally {
      setActiveExport(null)
    }
  }

  const exportPanels: Array<{
    scope: SessionExportScope
    title: string
    subtitle: string
  }> = [
    {
      scope: 'range',
      title: 'Current range',
      subtitle: `Scope: ${selectedWindowLabel}`,
    },
    {
      scope: 'history',
      title: 'Full history',
      subtitle: 'Scope: all sessions for this account.',
    },
  ]

  if (stats.isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (stats.error) {
    return (
      <section className="mx-auto max-w-5xl rounded-xl border border-surface-border bg-surface-raised p-6">
        <p className="text-sm text-red-300">
          {getErrorMessage(stats.error, 'Unable to load stats right now.')}
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">Stats</p>
        <h1 className="mt-2 text-2xl font-light">Insights</h1>
      </header>

      <SummaryCards
        currentStreak={stats.currentStreak}
        totalSessions={stats.totalSessions}
        totalWorkSeconds={stats.totalWorkSeconds}
      />

      <section className="rounded-xl border border-surface-border bg-surface-raised/50 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm text-ink-secondary">Session export</h2>
            <p className="mt-1 text-xs text-ink-tertiary">
              Export current range or full history as CSV/JSON.
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {exportPanels.map((panel) => (
            <div
              className="rounded-lg border border-surface-border bg-surface-overlay/70 p-3"
              key={panel.scope}
            >
              <p className="text-xs uppercase tracking-[0.1em] text-ink-tertiary">{panel.title}</p>
              <p className="mt-1 text-xs text-ink-secondary">{panel.subtitle}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['csv', 'json'] as const).map((format) => (
                  <Button
                    key={format}
                    loading={activeExport?.scope === panel.scope && activeExport.format === format}
                    onClick={() => {
                      void handleExport(panel.scope, format)
                    }}
                    size="sm"
                    variant={format === 'csv' ? 'outlined' : 'ghost'}
                  >
                    Export {format.toUpperCase()}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {exportError ? <p className="mt-3 text-sm text-red-300">{exportError}</p> : null}
      </section>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm text-ink-secondary">
            Focus time by <TimeRangeSelector onChange={setRange} value={range} />
          </h2>

          <div className="flex items-center gap-2">
            <Button
              disabled={isCurrentWindow}
              onClick={() => setAnchorDate(new Date())}
              size="sm"
              variant="ghost"
            >
              Today
            </Button>

            <Button
              aria-label="Previous period"
              className={
                canGoPrevious
                  ? 'border border-ink-secondary bg-surface-overlay text-ink-primary shadow-[0_0_0_1px_rgba(240,237,232,0.08)] hover:border-ink-primary hover:bg-surface-raised disabled:opacity-100'
                  : 'border border-surface-border/40 bg-transparent text-ink-tertiary/40 disabled:opacity-100'
              }
              disabled={!canGoPrevious}
              onClick={() => setAnchorDate((current) => shiftRangeAnchor(range, current, -1))}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-32 text-center text-xs text-ink-secondary">
              {selectedWindowLabel}
            </span>

            <Button
              aria-label="Next period"
              className={
                canGoNext
                  ? 'border border-ink-secondary bg-surface-overlay text-ink-primary shadow-[0_0_0_1px_rgba(240,237,232,0.08)] hover:border-ink-primary hover:bg-surface-raised disabled:opacity-100'
                  : 'border border-surface-border/40 bg-transparent text-ink-tertiary/40 disabled:opacity-100'
              }
              disabled={!canGoNext}
              onClick={() => setAnchorDate((current) => shiftRangeAnchor(range, current, 1))}
              size="icon"
              variant="ghost"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DailyBarChart data={stats.byDay} range={range} />
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Activity heatmap</h2>
        <HeatmapGrid data={stats.allDays} />
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Session log</h2>
        <SessionLog
          deletingSessionId={deletingSessionId}
          onDelete={(session) => {
            void handleDeleteSession(session)
          }}
          onEdit={setEditingSession}
          sessions={stats.sessions}
        />

        {recentlyDeletedSession ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2">
            <p className="text-sm text-amber-200">Session deleted. Undo if this was accidental.</p>
            <Button
              onClick={() => {
                void restoreSession.mutateAsync(recentlyDeletedSession.id).then(() => {
                  setRecentlyDeletedSession(null)
                })
              }}
              size="sm"
              variant="ghost"
            >
              Undo
            </Button>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Time by category</h2>
        <CategoryBreakdown data={stats.byCategory} />
      </section>

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Time by task</h2>
        <TaskBreakdown data={stats.byTask} />
      </section>

      <SessionEditModal
        error={
          updateSession.error
            ? getErrorMessage(updateSession.error, 'Unable to update session right now.')
            : null
        }
        isOpen={!!editingSession}
        isSaving={updateSession.isPending}
        onClose={() => setEditingSession(null)}
        onSave={handleSaveSessionEdit}
        session={editingSession}
        tasks={activeTasks}
      />
    </section>
  )
}
