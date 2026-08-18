import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import {
  SessionEditModal,
  type SessionEditValues,
} from '@/features/sessions/components/SessionEditModal'
import { SessionLog } from '@/features/sessions/components/SessionLog'
import { useSessionMutations } from '@/features/sessions/hooks/useSessionMutations'
import { ArchivedCategoriesSection } from '@/features/tasks/components/ArchivedCategoriesSection'
import { CompletedTasksSection } from '@/features/tasks/components/CompletedTasksSection'
import {
  createSessionExportPayload,
  downloadSessionExportFile,
  type SessionExportFormat,
} from '@/features/sessions/lib/sessionExport'
import { useHistorySessions } from '@/features/history/hooks/useHistorySessions'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { formatRangeWindow, getRangeDatesForAnchor } from '@/lib/dateRange'
import { toEndOfDay, toStartOfDay } from '@/lib/dateMath'
import { getErrorMessage } from '@/lib/errorMessages'
import {
  createSessionSnapshotForTaskId,
  getSessionCategoryName,
  getSessionTaskName,
} from '@/lib/sessionSnapshot'
import type { SessionWithTask, TimeRange } from '@/types'

type HistoryRange = TimeRange | 'all-time' | 'custom'

interface HistoryWindow {
  from: Date | null
  to: Date | null
  label: string
  isValid: boolean
  exportRange: TimeRange | 'all-time' | 'custom'
}

const HISTORY_RANGE_OPTIONS: Array<{ label: string; value: HistoryRange }> = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
  { label: 'Year', value: 'year' },
  { label: 'All time', value: 'all-time' },
  { label: 'Custom', value: 'custom' },
]

function toDateInputValue(date: Date) {
  return date.toLocaleDateString('en-CA')
}

function toParsedDate(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

function getHistoryWindow(
  range: HistoryRange,
  customFrom: string,
  customTo: string
): HistoryWindow {
  if (range === 'all-time') {
    return {
      from: null,
      to: null,
      label: 'All time',
      isValid: true,
      exportRange: 'all-time',
    }
  }

  if (range === 'custom') {
    if (!customFrom || !customTo) {
      return {
        from: null,
        to: null,
        label: 'Custom range',
        isValid: false,
        exportRange: 'custom',
      }
    }

    const parsedFrom = toParsedDate(customFrom)
    const parsedTo = toParsedDate(customTo)
    if (!parsedFrom || !parsedTo || parsedFrom.getTime() > parsedTo.getTime()) {
      return {
        from: null,
        to: null,
        label: 'Custom range',
        isValid: false,
        exportRange: 'custom',
      }
    }

    const from = toStartOfDay(parsedFrom)
    const to = toEndOfDay(parsedTo)

    return {
      from,
      to,
      label: `${from.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })} - ${to.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
      isValid: true,
      exportRange: 'custom',
    }
  }

  const { from, to } = getRangeDatesForAnchor(range, new Date())

  return {
    from,
    to,
    label: formatRangeWindow(range, from, to),
    isValid: true,
    exportRange: range,
  }
}

function isWithinWindow(value: string | null | undefined, from: Date | null, to: Date | null) {
  if (!value) {
    return false
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return false
  }

  const time = parsed.getTime()

  if (from && time < from.getTime()) {
    return false
  }

  if (to && time > to.getTime()) {
    return false
  }

  return true
}

export function HistoryPage() {
  const now = useMemo(() => new Date(), [])
  const [range, setRange] = useState<HistoryRange>('month')
  const [customFrom, setCustomFrom] = useState(
    toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1))
  )
  const [customTo, setCustomTo] = useState(toDateInputValue(now))
  const [showArchivedCategories, setShowArchivedCategories] = useState(false)
  const [showCompletedTasks, setShowCompletedTasks] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [activeExportFormat, setActiveExportFormat] = useState<SessionExportFormat | null>(null)
  const [sessionSearch, setSessionSearch] = useState('')
  const [editingSession, setEditingSession] = useState<SessionWithTask | null>(null)
  const [lastDeletedSession, setLastDeletedSession] = useState<SessionWithTask | null>(null)

  const {
    archivedCategories,
    isLoading: categoriesLoading,
    error: categoriesError,
    unarchiveCategory,
    deleteCategory,
  } = useCategories()

  const {
    activeTasks,
    completedTasks,
    isLoading: tasksLoading,
    error: tasksError,
    restoreTask,
    deleteTask,
  } = useTasks()
  const { updateSession, softDeleteSession, restoreSession } = useSessionMutations()
  const sessionTasks = useMemo(
    () => [...activeTasks, ...completedTasks],
    [activeTasks, completedTasks]
  )

  const historyWindow = useMemo(
    () => getHistoryWindow(range, customFrom, customTo),
    [range, customFrom, customTo]
  )
  const isAllTimeRange = range === 'all-time'

  const {
    sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useHistorySessions({
    from: historyWindow.from,
    to: historyWindow.to,
    enabled: historyWindow.isValid,
  })

  const filteredArchivedCategories = useMemo(() => {
    if (!historyWindow.isValid) {
      return []
    }

    return archivedCategories.filter((category) =>
      isWithinWindow(category.archived_at, historyWindow.from, historyWindow.to)
    )
  }, [archivedCategories, historyWindow])

  const filteredCompletedTasks = useMemo(() => {
    if (!historyWindow.isValid) {
      return []
    }

    return completedTasks.filter((task) =>
      isWithinWindow(task.completed_at, historyWindow.from, historyWindow.to)
    )
  }, [completedTasks, historyWindow])

  const archiveSummary = useMemo(
    () => ({
      archivedCategories: filteredArchivedCategories.length,
      completedTasks: filteredCompletedTasks.length,
      exportableSessions: historyWindow.isValid ? sessions.length : 0,
    }),
    [filteredArchivedCategories, filteredCompletedTasks, historyWindow.isValid, sessions]
  )

  const filteredSessions = useMemo(() => {
    const search = sessionSearch.trim().toLocaleLowerCase()
    if (!search) return sessions

    return sessions.filter((session) => {
      const values = [
        getSessionTaskName(session),
        getSessionCategoryName(session),
        session.notes,
        new Date(session.started_at).toLocaleDateString(),
      ]

      return values.some((value) => value?.toLocaleLowerCase().includes(search))
    })
  }, [sessionSearch, sessions])

  const handleExport = async (format: SessionExportFormat) => {
    setActiveExportFormat(format)
    setExportError(null)

    try {
      const exportScope = isAllTimeRange ? 'history' : 'range'

      const payload = createSessionExportPayload({
        sessions,
        scope: exportScope,
        format,
        range: historyWindow.exportRange,
        from: exportScope === 'range' ? (historyWindow.from ?? undefined) : undefined,
        to: exportScope === 'range' ? (historyWindow.to ?? undefined) : undefined,
      })

      downloadSessionExportFile(payload)
    } catch (error) {
      setExportError(getErrorMessage(error, 'Unable to export sessions right now.'))
    } finally {
      setActiveExportFormat(null)
    }
  }

  const handleSaveSessionEdit = async (values: SessionEditValues) => {
    if (!editingSession) return

    const selectedTask = values.taskId
      ? (sessionTasks.find((task) => task.id === values.taskId) ?? null)
      : null
    const snapshot = createSessionSnapshotForTaskId(values.taskId, selectedTask, editingSession)

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

  const handleDeleteSession = (session: SessionWithTask) => {
    void softDeleteSession
      .mutateAsync(session.id)
      .then(() => setLastDeletedSession(session))
      .catch(() => undefined)
  }

  const handleUndoSessionDelete = () => {
    if (!lastDeletedSession) return

    void restoreSession
      .mutateAsync(lastDeletedSession.id)
      .then(() => setLastDeletedSession(null))
      .catch(() => undefined)
  }

  const isLoading = categoriesLoading || tasksLoading

  const loadError = categoriesError ?? tasksError

  const mutationError =
    updateSession.error ??
    softDeleteSession.error ??
    restoreSession.error ??
    unarchiveCategory.error ??
    deleteCategory.error ??
    restoreTask.error ??
    deleteTask.error

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (loadError) {
    return (
      <section className="mx-auto max-w-5xl rounded-xl border border-surface-border bg-surface-raised p-6">
        <p className="text-sm text-red-300">
          {getErrorMessage(loadError, 'Unable to load history right now.')}
        </p>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-light tracking-tight">Archive</h1>
      </header>

      <section className="border-t border-surface-border-subtle pt-5">
        <p className="text-sm text-ink-secondary">Export range</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {HISTORY_RANGE_OPTIONS.map((option) => (
            <Button
              className="min-w-[74px]"
              key={option.value}
              onClick={() => setRange(option.value)}
              size="sm"
              variant={range === option.value ? 'outlined' : 'ghost'}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {range === 'custom' ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Input
              label="From"
              max={customTo || undefined}
              onChange={(event) => setCustomFrom(event.target.value)}
              type="date"
              value={customFrom}
            />
            <Input
              label="To"
              min={customFrom || undefined}
              onChange={(event) => setCustomTo(event.target.value)}
              type="date"
              value={customTo}
            />
          </div>
        ) : null}

        <p className="mt-3 text-xs text-ink-tertiary">Export window: {historyWindow.label}</p>
        {!historyWindow.isValid ? (
          <p className="mt-2 text-sm text-red-300">Pick a valid custom start/end date range.</p>
        ) : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-ink-tertiary">
            Archived categories
          </p>
          <p className="mt-2 text-2xl font-light tabular-nums">
            {archiveSummary.archivedCategories}
          </p>
          <p className="mt-1 text-xs text-ink-tertiary">In the selected window</p>
        </article>

        <article className="rounded-xl bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-ink-tertiary">Completed tasks</p>
          <p className="mt-2 text-2xl font-light tabular-nums">{archiveSummary.completedTasks}</p>
          <p className="mt-1 text-xs text-ink-tertiary">In the selected window</p>
        </article>

        <article className="rounded-xl bg-surface-raised p-4">
          <p className="text-xs uppercase tracking-[0.08em] text-ink-tertiary">
            Exportable sessions
          </p>
          <p className="mt-2 text-2xl font-light tabular-nums">
            {archiveSummary.exportableSessions}
          </p>
          <p className="mt-1 text-xs text-ink-tertiary">In the current export window</p>
        </article>
      </section>

      <section className="border-t border-surface-border-subtle pt-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm text-ink-secondary">Session log</h2>
            <p className="mt-1 text-xs text-ink-tertiary">{historyWindow.label}</p>
          </div>

          {lastDeletedSession ? (
            <div className="flex items-center gap-2" role="status">
              <p className="text-xs text-ink-secondary">Session deleted.</p>
              <Button
                loading={restoreSession.isPending}
                onClick={handleUndoSessionDelete}
                size="sm"
                variant="outlined"
              >
                Undo
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mb-4 max-w-sm">
          <Input
            label="Search sessions"
            onChange={(event) => setSessionSearch(event.target.value)}
            placeholder="Task, category, note, or date"
            type="search"
            value={sessionSearch}
          />
          {sessionSearch.trim() ? (
            <p className="mt-2 text-xs text-ink-tertiary" role="status">
              {filteredSessions.length} matching{' '}
              {filteredSessions.length === 1 ? 'session' : 'sessions'}
            </p>
          ) : null}
        </div>

        {sessionsLoading ? (
          <div className="flex items-center gap-2 text-sm text-ink-secondary">
            <Spinner />
            Loading sessions...
          </div>
        ) : sessionsError ? (
          <p className="text-sm text-red-300" role="alert">
            {getErrorMessage(sessionsError, 'Unable to load sessions right now.')}
          </p>
        ) : (
          <SessionLog
            deletingSessionId={softDeleteSession.isPending ? softDeleteSession.variables : null}
            onDelete={handleDeleteSession}
            onEdit={setEditingSession}
            sessions={filteredSessions}
          />
        )}
      </section>

      <section className="border-t border-surface-border-subtle pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm text-ink-secondary">Session export</h2>
            <p className="mt-1 text-xs text-ink-tertiary">
              {isAllTimeRange
                ? 'Export all sessions as CSV/JSON.'
                : 'Export sessions in the selected range as CSV/JSON.'}
            </p>
            <p className="mt-1 text-xs text-ink-secondary">
              Scope: {historyWindow.isValid ? historyWindow.label : 'Invalid custom range'}
            </p>
            {sessionsLoading ? (
              <p className="mt-1 text-xs text-ink-tertiary">Loading sessions for export...</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['csv', 'json'] as const).map((format) => (
              <Button
                disabled={!historyWindow.isValid || sessionsLoading}
                key={format}
                loading={activeExportFormat === format}
                onClick={() => {
                  void handleExport(format)
                }}
                size="sm"
                variant={format === 'csv' ? 'outlined' : 'ghost'}
              >
                Export {format.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>

        {sessionsError ? (
          <p className="mt-3 text-sm text-red-300">
            {getErrorMessage(sessionsError, 'Unable to load sessions for export right now.')}
          </p>
        ) : null}
        {exportError ? <p className="mt-3 text-sm text-red-300">{exportError}</p> : null}
      </section>

      <ArchivedCategoriesSection
        categories={filteredArchivedCategories}
        isExpanded={showArchivedCategories}
        onDeleteCategory={async (id) => {
          await deleteCategory.mutateAsync(id)
        }}
        onRestoreCategory={async (id) => {
          await unarchiveCategory.mutateAsync(id)
        }}
        onToggle={() => setShowArchivedCategories((current) => !current)}
      />

      <CompletedTasksSection
        isExpanded={showCompletedTasks}
        onDeleteTask={async (id) => {
          await deleteTask.mutateAsync(id)
        }}
        onRestoreTask={async (id) => {
          await restoreTask.mutateAsync(id)
        }}
        onToggle={() => setShowCompletedTasks((current) => !current)}
        tasks={filteredCompletedTasks}
      />

      {mutationError ? (
        <p className="text-sm text-red-300" role="alert">
          {getErrorMessage(mutationError, 'Unable to update history right now.')}
        </p>
      ) : null}

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
        tasks={sessionTasks}
      />
    </section>
  )
}
