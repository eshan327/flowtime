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
import { useStats } from '@/features/stats/hooks/useStats'
import { useSessionMutations } from '@/features/stats/hooks/useSessionMutations'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { getRangeDatesForAnchor, shiftRangeAnchor } from '@/lib/utils'
import { useUser } from '@/hooks/useUser'
import type { SessionWithTask, TimeRange } from '@/types'

function getHistoryLowerBound(createdAt: string | null | undefined) {
  const januaryFallback = new Date(2026, 0, 1)
  januaryFallback.setHours(0, 0, 0, 0)

  if (!createdAt) {
    return januaryFallback
  }

  const parsedCreatedAt = new Date(createdAt)
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

    const fallbackTaskName = editingSession.task_name_snapshot ?? editingSession.tasks?.name ?? null
    const fallbackTaskColor =
      editingSession.task_color_snapshot ?? editingSession.tasks?.color ?? null
    const fallbackCategoryId =
      editingSession.category_id_snapshot ?? editingSession.tasks?.category_id ?? null
    const fallbackCategoryName =
      editingSession.category_name_snapshot ?? editingSession.tasks?.categories?.name ?? null
    const fallbackCategoryColor =
      editingSession.category_color_snapshot ?? editingSession.tasks?.categories?.color ?? null

    const snapshot = values.taskId
      ? selectedTask
        ? {
            taskIdSnapshot: selectedTask.id,
            taskNameSnapshot: selectedTask.name,
            taskColorSnapshot: selectedTask.color,
            categoryIdSnapshot: selectedTask.category_id,
            categoryNameSnapshot: selectedTask.categories?.name ?? null,
            categoryColorSnapshot: selectedTask.categories?.color ?? null,
          }
        : {
            taskIdSnapshot: values.taskId,
            taskNameSnapshot: fallbackTaskName,
            taskColorSnapshot: fallbackTaskColor,
            categoryIdSnapshot: fallbackCategoryId,
            categoryNameSnapshot: fallbackCategoryName,
            categoryColorSnapshot: fallbackCategoryColor,
          }
      : {
          taskIdSnapshot: null,
          taskNameSnapshot: null,
          taskColorSnapshot: null,
          categoryIdSnapshot: null,
          categoryNameSnapshot: null,
          categoryColorSnapshot: null,
        }

    await updateSession.mutateAsync({
      id: values.id,
      taskId: values.taskId,
      workSeconds: values.workSeconds,
      breakSeconds: values.breakSeconds,
      startedAt: values.startedAt,
      endedAt: values.endedAt,
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
          {stats.error instanceof Error ? stats.error.message : 'Unable to load stats right now.'}
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

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm text-ink-secondary">
            Focus time by{' '}
            <TimeRangeSelector
              onChange={(nextRange) => {
                setRange(nextRange)
              }}
              value={range}
            />
          </h2>

          <div className="flex items-center gap-2">
            <Button
              disabled={isCurrentWindow}
              onClick={() => {
                setAnchorDate(new Date())
              }}
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
              onClick={() => {
                setAnchorDate((current) => shiftRangeAnchor(range, current, -1))
              }}
              size="icon"
              variant="ghost"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="min-w-32 text-center text-xs text-ink-secondary">
              {formatRangeWindow(range, selectedWindow.from, selectedWindow.to)}
            </span>

            <Button
              aria-label="Next period"
              className={
                canGoNext
                  ? 'border border-ink-secondary bg-surface-overlay text-ink-primary shadow-[0_0_0_1px_rgba(240,237,232,0.08)] hover:border-ink-primary hover:bg-surface-raised disabled:opacity-100'
                  : 'border border-surface-border/40 bg-transparent text-ink-tertiary/40 disabled:opacity-100'
              }
              disabled={!canGoNext}
              onClick={() => {
                setAnchorDate((current) => shiftRangeAnchor(range, current, 1))
              }}
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
          onEdit={(session) => {
            setEditingSession(session)
          }}
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
        error={updateSession.error instanceof Error ? updateSession.error.message : null}
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
