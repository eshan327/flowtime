import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { ArchivedCategoriesSection } from '@/features/tasks/components/ArchivedCategoriesSection'
import { CompletedTasksSection } from '@/features/tasks/components/CompletedTasksSection'
import { SessionLog } from '@/features/stats/components/SessionLog'
import {
  SessionEditModal,
  type SessionEditValues,
} from '@/features/stats/components/SessionEditModal'
import {
  createSessionExportPayload,
  downloadSessionExportFile,
  type SessionExportFormat,
} from '@/features/stats/lib/sessionExport'
import { useHistorySessions } from '@/features/history/hooks/useHistorySessions'
import { useSessionMutations } from '@/features/stats/hooks/useSessionMutations'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { getRangeDatesForAnchor } from '@/lib/dateRange'
import { getErrorMessage } from '@/lib/errorMessages'
import { createSessionSnapshotForTaskId } from '@/lib/sessionSnapshot'
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

function toStartOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function toEndOfDay(date: Date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function formatHistoryWindow(range: TimeRange, from: Date, to: Date) {
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
    label: formatHistoryWindow(range, from, to),
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
  const [editingSession, setEditingSession] = useState<SessionWithTask | null>(null)
  const [recentlyDeletedSession, setRecentlyDeletedSession] = useState<SessionWithTask | null>(null)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [activeExportFormat, setActiveExportFormat] = useState<SessionExportFormat | null>(null)
  const undoTimeoutRef = useRef<number | null>(null)

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

    if (isAllTimeRange) {
      return archivedCategories
    }

    return archivedCategories.filter((category) =>
      isWithinWindow(category.archived_at, historyWindow.from, historyWindow.to)
    )
  }, [archivedCategories, historyWindow, isAllTimeRange])

  const filteredCompletedTasks = useMemo(() => {
    if (!historyWindow.isValid) {
      return []
    }

    if (isAllTimeRange) {
      return completedTasks
    }

    return completedTasks.filter((task) =>
      isWithinWindow(task.completed_at, historyWindow.from, historyWindow.to)
    )
  }, [completedTasks, historyWindow, isAllTimeRange])

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

  const isLoading =
    categoriesLoading || tasksLoading || (historyWindow.isValid ? sessionsLoading : false)

  const loadError = categoriesError ?? tasksError ?? sessionsError

  const mutationError =
    unarchiveCategory.error ??
    deleteCategory.error ??
    restoreTask.error ??
    deleteTask.error ??
    updateSession.error ??
    softDeleteSession.error ??
    restoreSession.error

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
        <p className="text-xs uppercase tracking-[0.14em] text-ink-tertiary">History</p>
        <h1 className="mt-2 text-2xl font-light">Archived & Session History</h1>
      </header>

      <section className="rounded-xl border border-surface-border bg-surface-raised/50 p-4">
        <p className="text-sm text-ink-secondary">Range filter</p>
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

        <p className="mt-3 text-xs text-ink-tertiary">Active window: {historyWindow.label}</p>
        {!historyWindow.isValid ? (
          <p className="mt-2 text-sm text-red-300">Pick a valid custom start/end date range.</p>
        ) : null}
      </section>

      <section className="rounded-xl border border-surface-border bg-surface-raised/50 p-4">
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
          </div>

          <div className="flex flex-wrap gap-2">
            {(['csv', 'json'] as const).map((format) => (
              <Button
                disabled={!historyWindow.isValid}
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

      <section>
        <h2 className="mb-2 text-sm text-ink-secondary">Session log</h2>
        {historyWindow.isValid ? (
          <SessionLog
            deletingSessionId={deletingSessionId}
            onDelete={(session) => {
              void handleDeleteSession(session)
            }}
            onEdit={setEditingSession}
            sessions={sessions}
          />
        ) : (
          <p className="text-sm text-ink-tertiary">Pick a valid custom range to see sessions.</p>
        )}

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

      {mutationError ? (
        <p className="text-sm text-red-300">
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
        tasks={activeTasks}
      />
    </section>
  )
}
