import { useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import {
  SessionEditModal,
  type SessionEditValues,
} from '@/features/sessions/components/SessionEditModal'
import { SessionLog } from '@/features/sessions/components/SessionLog'
import { useSessionMutations } from '@/features/sessions/hooks/useSessionMutations'
import {
  createSessionExportPayload,
  downloadSessionExportFile,
  type SessionExportFormat,
} from '@/features/sessions/lib/sessionExport'
import { useHistorySessions } from '@/features/history/hooks/useHistorySessions'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { getRangeDatesForAnchor } from '@/lib/dateRange'
import { toEndOfDay, toStartOfDay } from '@/lib/dateMath'
import { getErrorMessage } from '@/lib/errorMessages'
import { EMPTY_SESSION_SNAPSHOT, snapshotSession, snapshotTask } from '@/lib/sessionSnapshot'
import type { SessionWithTask, TimeRange } from '@/types'

type HistoryRange = TimeRange | 'all-time' | 'custom'

interface HistoryWindow {
  from: Date | null
  to: Date | null
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
): HistoryWindow | null {
  if (range === 'all-time') {
    return { from: null, to: null }
  }

  if (range === 'custom') {
    if (!customFrom || !customTo) return null

    const parsedFrom = toParsedDate(customFrom)
    const parsedTo = toParsedDate(customTo)
    if (!parsedFrom || !parsedTo || parsedFrom.getTime() > parsedTo.getTime()) {
      return null
    }

    return {
      from: toStartOfDay(parsedFrom),
      to: toEndOfDay(parsedTo),
    }
  }

  return getRangeDatesForAnchor(range, new Date())
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

interface ArchivedItemsSectionProps<T extends { id: string }> {
  title: string
  emptyMessage: string
  items: T[]
  isExpanded: boolean
  onToggle: () => void
  onRestore: (id: string) => Promise<void> | void
  onDelete: (id: string) => Promise<void> | void
  renderItem: (item: T) => ReactNode
  deleteConfirmation: (item: T) => string
}

function ArchivedItemsSection<T extends { id: string }>({
  title,
  emptyMessage,
  items,
  isExpanded,
  onToggle,
  onRestore,
  onDelete,
  renderItem,
  deleteConfirmation,
}: ArchivedItemsSectionProps<T>) {
  return (
    <section className="rounded-xl bg-surface-panel p-4">
      <Button
        aria-expanded={isExpanded}
        className="h-auto w-full justify-between px-1 text-sm"
        onClick={onToggle}
        size="sm"
        variant="ghost"
      >
        <span>
          {title} ({items.length})
        </span>
        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {isExpanded ? (
        items.length === 0 ? (
          <p className="mt-2 text-sm text-ink-tertiary">{emptyMessage}</p>
        ) : (
          <div className="mt-2 space-y-2">
            {items.map((item) => (
              <div
                className="flex items-center justify-between gap-2 border-b border-surface-border-subtle px-1 py-3"
                key={item.id}
              >
                {renderItem(item)}
                <div className="flex items-center gap-2">
                  <Button onClick={() => void onRestore(item.id)} size="sm" variant="ghost">
                    Restore
                  </Button>
                  <Button
                    className="text-red-300 hover:text-red-200"
                    onClick={() => {
                      if (window.confirm(deleteConfirmation(item))) void onDelete(item.id)
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}
    </section>
  )
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
    updateCategory,
    deleteCategory,
  } = useCategories()

  const {
    activeTasks,
    completedTasks,
    isLoading: tasksLoading,
    error: tasksError,
    updateTask,
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
  const isHistoryWindowValid = historyWindow !== null
  const isAllTimeRange = range === 'all-time'

  const {
    sessions,
    isLoading: sessionsLoading,
    error: sessionsError,
  } = useHistorySessions({
    from: historyWindow?.from ?? null,
    to: historyWindow?.to ?? null,
    enabled: isHistoryWindowValid,
  })

  const filteredArchivedCategories = useMemo(() => {
    if (!historyWindow) return []

    return archivedCategories.filter((category) =>
      isWithinWindow(category.archived_at, historyWindow.from, historyWindow.to)
    )
  }, [archivedCategories, historyWindow])

  const filteredCompletedTasks = useMemo(() => {
    if (!historyWindow) return []

    return completedTasks.filter((task) =>
      isWithinWindow(task.completed_at, historyWindow.from, historyWindow.to)
    )
  }, [completedTasks, historyWindow])

  const archiveSummary = {
    archivedCategories: filteredArchivedCategories.length,
    completedTasks: filteredCompletedTasks.length,
    exportableSessions: isHistoryWindowValid ? sessions.length : 0,
  }

  const filteredSessions = useMemo(() => {
    const search = sessionSearch.trim().toLocaleLowerCase()
    if (!search) return sessions

    return sessions.filter((session) => {
      const snapshot = snapshotSession(session)
      const values = [
        snapshot.taskNameSnapshot,
        snapshot.categoryNameSnapshot ?? 'Uncategorized',
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
        range,
        from: exportScope === 'range' ? (historyWindow?.from ?? undefined) : undefined,
        to: exportScope === 'range' ? (historyWindow?.to ?? undefined) : undefined,
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
    const snapshot = !values.taskId
      ? EMPTY_SESSION_SNAPSHOT
      : selectedTask
        ? snapshotTask(selectedTask)
        : { ...snapshotSession(editingSession), taskIdSnapshot: values.taskId }

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
    updateCategory.error ??
    deleteCategory.error ??
    updateTask.error ??
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
      <section className="rounded-xl bg-surface-panel p-6">
        <p className="text-sm text-red-300">
          {getErrorMessage(loadError, 'Unable to load history right now.')}
        </p>
      </section>
    )
  }

  return (
    <section className="space-y-7">
      <header>
        <h1 className="text-4xl font-medium tracking-tight">History</h1>
      </header>

      <section>
        <p className="text-sm text-ink-secondary">Range</p>
        <div className="mt-2 grid grid-cols-3 gap-x-3 sm:inline-flex">
          {HISTORY_RANGE_OPTIONS.map((option) => (
            <Button
              className={`min-w-0 rounded-none border-b-2 px-2 sm:min-w-[74px] ${
                range === option.value
                  ? 'border-b-accent-primary text-ink-primary'
                  : 'border-b-transparent'
              }`}
              key={option.value}
              onClick={() => setRange(option.value)}
              size="sm"
              variant="ghost"
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

        {!isHistoryWindowValid ? (
          <p className="mt-2 text-sm text-red-300">Pick a valid custom start/end date range.</p>
        ) : null}
      </section>

      <section className="grid grid-cols-3 divide-x divide-surface-border-subtle overflow-hidden rounded-xl bg-surface-panel">
        <article className="min-w-0 px-3 py-4 sm:px-5">
          <p className="text-[30px] font-medium leading-none tabular-nums tracking-tight">
            {archiveSummary.archivedCategories}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.06em] text-ink-tertiary">
            Archived categories
          </p>
        </article>

        <article className="min-w-0 px-3 py-4 sm:px-5">
          <p className="text-[30px] font-medium leading-none tabular-nums tracking-tight">
            {archiveSummary.completedTasks}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.06em] text-ink-tertiary">
            Completed tasks
          </p>
        </article>

        <article className="min-w-0 px-3 py-4 sm:px-5">
          <p className="text-[30px] font-medium leading-none tabular-nums tracking-tight">
            {archiveSummary.exportableSessions}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.06em] text-ink-tertiary">
            Exportable sessions
          </p>
        </article>
      </section>

      <section className="pt-2">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm text-ink-secondary">Session log</h2>

          <div className="w-full max-w-sm">
            <Input
              aria-label="Search sessions"
              onChange={(event) => setSessionSearch(event.target.value)}
              placeholder="Search task, category, note, or date"
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
        </div>

        {lastDeletedSession ? (
          <div className="mb-4 flex items-center justify-end gap-2" role="status">
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

      <section className="pt-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm text-ink-secondary">Session export</h2>
            {sessionsLoading ? (
              <p className="mt-1 text-xs text-ink-tertiary">Loading sessions for export...</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            {(['csv', 'json'] as const).map((format) => (
              <Button
                disabled={!isHistoryWindowValid || sessionsLoading}
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

      <ArchivedItemsSection
        deleteConfirmation={(category) =>
          `Delete ${category.name} permanently? Its tasks will become uncategorized.`
        }
        emptyMessage="No archived categories."
        items={filteredArchivedCategories}
        isExpanded={showArchivedCategories}
        onDelete={(id) => deleteCategory.mutateAsync(id)}
        onRestore={(id) => updateCategory.mutateAsync({ id, archivedAt: null })}
        onToggle={() => setShowArchivedCategories((current) => !current)}
        renderItem={(category) => (
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="truncate text-sm text-ink-primary">{category.name}</span>
          </div>
        )}
        title="Archived categories"
      />

      <ArchivedItemsSection
        deleteConfirmation={(task) =>
          `Delete ${task.name} permanently? Its session history will be preserved.`
        }
        emptyMessage="No completed tasks."
        items={filteredCompletedTasks}
        isExpanded={showCompletedTasks}
        onDelete={(id) => deleteTask.mutateAsync(id)}
        onRestore={(id) => updateTask.mutateAsync({ id, completedAt: null })}
        onToggle={() => setShowCompletedTasks((current) => !current)}
        renderItem={(task) => (
          <div className="min-w-0">
            <p className="truncate text-sm text-ink-primary">{task.name}</p>
            <p className="text-xs text-ink-tertiary">{task.categories?.name ?? 'Uncategorized'}</p>
          </div>
        )}
        title="Completed tasks"
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
