import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Settings2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  SessionEditModal,
  type SessionEditValues,
} from '@/features/stats/components/SessionEditModal'
import { useSessionMutations } from '@/features/stats/hooks/useSessionMutations'
import { SessionSummary } from '@/features/timer/components/SessionSummary'
import { TimerSettingsModal } from '@/features/timer/components/TimerSettingsModal'
import { TaskSelector } from '@/features/timer/components/TaskSelector'
import { TimerClock } from '@/features/timer/components/TimerClock'
import { TimerControls } from '@/features/timer/components/TimerControls'
import { useSessionSave } from '@/features/timer/hooks/useSessionSave'
import { useTodaySummary } from '@/features/timer/hooks/useTodaySummary'
import { useTimer } from '@/features/timer/hooks/useTimer'
import { getBreakSeconds, useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { MAX_SESSION_SECONDS, useTimerStore } from '@/features/timer/stores/timerStore'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { requestNotificationPermission } from '@/lib/notifications'
import { formatClock, formatDuration } from '@/lib/utils'
import type { Session, SessionWithTask } from '@/types'

export function TimerPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSessionEditOpen, setIsSessionEditOpen] = useState(false)
  const [lastSavedSession, setLastSavedSession] = useState<SessionWithTask | null>(null)

  const { user } = useUser()
  const { tasks, addTask, isLoading: tasksLoading, error: tasksError } = useTasks()
  const saveSession = useSessionSave()
  const { updateSession, softDeleteSession } = useSessionMutations()

  const breakDivisor = useTimerSettingsStore((state) => state.breakDivisor)
  const notificationsEnabled = useTimerSettingsStore((state) => state.notificationsEnabled)
  const chimeEnabled = useTimerSettingsStore((state) => state.chimeEnabled)
  const chimeId = useTimerSettingsStore((state) => state.chimeId)

  const phase = useTimerStore((state) => state.phase)
  const workSeconds = useTimerStore((state) => state.workSeconds)
  const breakEndAt = useTimerStore((state) => state.breakEndAt)
  const breakTotal = useTimerStore((state) => state.breakTotal)
  const startedAt = useTimerStore((state) => state.startedAt)
  const selectedTaskId = useTimerStore((state) => state.selectedTaskId)
  const selectedTaskName = useTimerStore((state) => state.selectedTaskName)
  const selectedTaskColorSnapshot = useTimerStore((state) => state.selectedTaskColor)
  const selectedCategoryId = useTimerStore((state) => state.selectedCategoryId)
  const selectedCategoryName = useTimerStore((state) => state.selectedCategoryName)
  const selectedCategoryColor = useTimerStore((state) => state.selectedCategoryColor)
  const lastSessionId = useTimerStore((state) => state.lastSessionId)
  const lastSessionTaskName = useTimerStore((state) => state.lastSessionTaskName)
  const lastSessionTaskColor = useTimerStore((state) => state.lastSessionTaskColor)
  const runawayDetected = useTimerStore((state) => state.runawayDetected)
  const dismissRunaway = useTimerStore((state) => state.dismissRunaway)
  const startWork = useTimerStore((state) => state.startWork)
  const stopWork = useTimerStore((state) => state.stopWork)
  const skipBreak = useTimerStore((state) => state.skipBreak)
  const setSelectedTask = useTimerStore((state) => state.setSelectedTask)
  const setSelectedTaskSnapshot = useTimerStore((state) => state.setSelectedTaskSnapshot)
  const setLastSessionId = useTimerStore((state) => state.setLastSessionId)

  useTimer({ breakDivisor, notificationsEnabled, chimeEnabled, chimeId })
  const runawaySaveKeyRef = useRef<string | null>(null)
  const todaySummary = useTodaySummary()

  const selectableTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.category_id === null || (task.categories && task.categories.archived_at === null)
      ),
    [tasks]
  )

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null
  const selectedTaskIsSelectable = selectedTask
    ? selectedTask.category_id === null || selectedTask.categories?.archived_at === null
    : false
  const selectedTaskColor =
    selectedTask?.categories?.color ?? selectedTask?.color ?? DEFAULT_TASK_COLOR
  const canStartWork = !!selectedTask && selectedTaskIsSelectable

  const buildSessionSnapshot = useCallback(
    () => ({
      taskIdSnapshot: selectedTask?.id ?? selectedTaskId ?? null,
      taskNameSnapshot: selectedTask?.name ?? selectedTaskName ?? null,
      taskColorSnapshot: selectedTask?.color ?? selectedTaskColorSnapshot ?? null,
      categoryIdSnapshot: selectedTask?.category_id ?? selectedCategoryId ?? null,
      categoryNameSnapshot: selectedTask?.categories?.name ?? selectedCategoryName ?? null,
      categoryColorSnapshot: selectedTask?.categories?.color ?? selectedCategoryColor ?? null,
    }),
    [
      selectedTask,
      selectedTaskId,
      selectedTaskName,
      selectedTaskColorSnapshot,
      selectedCategoryId,
      selectedCategoryName,
      selectedCategoryColor,
    ]
  )

  const toSessionWithTask = useCallback(
    (session: Session, snapshot: ReturnType<typeof buildSessionSnapshot>): SessionWithTask => ({
      ...session,
      task_id_snapshot: snapshot.taskIdSnapshot,
      task_name_snapshot: snapshot.taskNameSnapshot,
      task_color_snapshot: snapshot.taskColorSnapshot,
      category_id_snapshot: snapshot.categoryIdSnapshot,
      category_name_snapshot: snapshot.categoryNameSnapshot,
      category_color_snapshot: snapshot.categoryColorSnapshot,
      tasks: snapshot.taskIdSnapshot
        ? {
            id: snapshot.taskIdSnapshot,
            name: snapshot.taskNameSnapshot ?? 'Task',
            color: snapshot.taskColorSnapshot,
            category_id: snapshot.categoryIdSnapshot,
            categories: snapshot.categoryIdSnapshot
              ? {
                  id: snapshot.categoryIdSnapshot,
                  name: snapshot.categoryNameSnapshot ?? 'Category',
                  color: snapshot.categoryColorSnapshot ?? DEFAULT_TASK_COLOR,
                  archived_at: null,
                }
              : null,
          }
        : null,
    }),
    []
  )

  const saveTimerSession = useCallback(
    async (
      payload: {
        user_id: string
        task_id: string | null
        work_seconds: number
        break_seconds: number
        started_at: string
        ended_at: string
      },
      snapshot: ReturnType<typeof buildSessionSnapshot>
    ) => {
      const savedSession = await saveSession.mutateAsync({
        ...payload,
        task_id_snapshot: snapshot.taskIdSnapshot,
        task_name_snapshot: snapshot.taskNameSnapshot,
        task_color_snapshot: snapshot.taskColorSnapshot,
        category_id_snapshot: snapshot.categoryIdSnapshot,
        category_name_snapshot: snapshot.categoryNameSnapshot,
        category_color_snapshot: snapshot.categoryColorSnapshot,
      })

      setLastSessionId(savedSession.id)
      setLastSavedSession(toSessionWithTask(savedSession, snapshot))
    },
    [saveSession, setLastSessionId, toSessionWithTask]
  )

  useEffect(() => {
    if (phase !== 'idle') return
    if (!selectedTaskId) return
    if (selectableTasks.some((task) => task.id === selectedTaskId)) return
    setSelectedTask(null)
  }, [phase, selectedTaskId, selectableTasks, setSelectedTask])

  useEffect(() => {
    if (!selectedTask) {
      if (phase === 'idle') {
        setSelectedTaskSnapshot(null)
      }
      return
    }

    setSelectedTaskSnapshot({
      name: selectedTask.name,
      color: selectedTaskColor,
      categoryId: selectedTask.category_id,
      categoryName: selectedTask.categories?.name ?? null,
      categoryColor: selectedTask.categories?.color ?? null,
    })
  }, [phase, selectedTask, selectedTaskColor, setSelectedTaskSnapshot])

  const secondaryText =
    phase === 'idle'
      ? selectedTask
        ? selectedTask.name
        : 'Select a task to begin'
      : phase === 'working'
        ? `Break earned: ${formatClock(getBreakSeconds(workSeconds, breakDivisor))}`
        : phase === 'breaking'
          ? `You earned ${formatClock(breakTotal)} - take it easy`
          : 'Break complete - ready for the next session'

  const handleStopWork = () => {
    if (notificationsEnabled) {
      void requestNotificationPermission()
    }

    if (saveSession.isPending) {
      return
    }

    const snapshot = buildSessionSnapshot()

    const sessionTask = {
      name: snapshot.taskNameSnapshot,
      color: snapshot.taskColorSnapshot,
      categoryId: snapshot.categoryIdSnapshot,
      categoryName: snapshot.categoryNameSnapshot,
      categoryColor: snapshot.categoryColorSnapshot,
    }

    if (!startedAt || !user) {
      stopWork({ sessionTask, breakDivisor })
      return
    }

    const payload = {
      user_id: user.id,
      task_id: selectedTaskId,
      work_seconds: workSeconds,
      break_seconds: getBreakSeconds(workSeconds, breakDivisor),
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
    }

    void saveTimerSession(payload, snapshot).catch(() => {
      setLastSessionId(null)
    })
    stopWork({ sessionTask, breakDivisor })
  }

  const handleStartWork = () => {
    if (!canStartWork) {
      return
    }

    setLastSavedSession(null)
    startWork()
  }

  const handleSaveSessionEdit = async (values: SessionEditValues) => {
    if (!lastSavedSession) return

    const selectedEditTask = values.taskId
      ? selectableTasks.find((task) => task.id === values.taskId)
      : null

    const snapshot = values.taskId
      ? selectedEditTask
        ? {
            taskIdSnapshot: selectedEditTask.id,
            taskNameSnapshot: selectedEditTask.name,
            taskColorSnapshot: selectedEditTask.color,
            categoryIdSnapshot: selectedEditTask.category_id,
            categoryNameSnapshot: selectedEditTask.categories?.name ?? null,
            categoryColorSnapshot: selectedEditTask.categories?.color ?? null,
          }
        : {
            taskIdSnapshot: values.taskId,
            taskNameSnapshot:
              lastSavedSession.task_name_snapshot ?? lastSavedSession.tasks?.name ?? null,
            taskColorSnapshot:
              lastSavedSession.task_color_snapshot ?? lastSavedSession.tasks?.color ?? null,
            categoryIdSnapshot:
              lastSavedSession.category_id_snapshot ?? lastSavedSession.tasks?.category_id ?? null,
            categoryNameSnapshot:
              lastSavedSession.category_name_snapshot ??
              lastSavedSession.tasks?.categories?.name ??
              null,
            categoryColorSnapshot:
              lastSavedSession.category_color_snapshot ??
              lastSavedSession.tasks?.categories?.color ??
              null,
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

    setLastSavedSession((current) => {
      if (!current) return current

      const updated: Session = {
        ...current,
        task_id: values.taskId,
        task_id_snapshot: snapshot.taskIdSnapshot,
        task_name_snapshot: snapshot.taskNameSnapshot,
        task_color_snapshot: snapshot.taskColorSnapshot,
        category_id_snapshot: snapshot.categoryIdSnapshot,
        category_name_snapshot: snapshot.categoryNameSnapshot,
        category_color_snapshot: snapshot.categoryColorSnapshot,
        work_seconds: values.workSeconds,
        break_seconds: values.breakSeconds,
        started_at: values.startedAt,
        ended_at: values.endedAt,
      }

      return toSessionWithTask(updated, snapshot)
    })

    setIsSessionEditOpen(false)
  }

  const handleDeleteLastSession = async () => {
    const sessionId = lastSavedSession?.id ?? lastSessionId
    if (!sessionId) return

    await softDeleteSession.mutateAsync(sessionId)
    setLastSavedSession(null)
    setLastSessionId(null)
  }

  useEffect(() => {
    if (!runawayDetected) {
      runawaySaveKeyRef.current = null
      return
    }

    if (!startedAt || !user || saveSession.isPending) {
      return
    }

    const saveKey = `${user.id}:${startedAt.toISOString()}`
    if (runawaySaveKeyRef.current === saveKey) {
      return
    }

    runawaySaveKeyRef.current = saveKey
    const snapshot = buildSessionSnapshot()
    void saveTimerSession(
      {
        user_id: user.id,
        task_id: selectedTaskId,
        work_seconds: MAX_SESSION_SECONDS,
        break_seconds: getBreakSeconds(MAX_SESSION_SECONDS, breakDivisor),
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
      },
      snapshot
    ).catch(() => {
      setLastSessionId(null)
    })
  }, [
    buildSessionSnapshot,
    runawayDetected,
    saveTimerSession,
    saveSession,
    selectedTask,
    selectedTaskColorSnapshot,
    selectedTaskId,
    selectedTaskName,
    selectedCategoryId,
    selectedCategoryName,
    selectedCategoryColor,
    setLastSessionId,
    startedAt,
    user,
    breakDivisor,
  ])

  return (
    <section className="mx-auto flex min-h-[75vh] w-full max-w-3xl flex-col justify-center">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6">
        <div className="mb-3 flex justify-end">
          <Button
            className="gap-2"
            onClick={() => setIsSettingsOpen(true)}
            size="sm"
            variant="ghost"
          >
            <Settings2 className="h-4 w-4" />
            Timer settings
          </Button>
        </div>

        {tasksError ? (
          <p className="mb-3 rounded-lg border border-red-300/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load tasks right now. Pick a task before starting a timer session.
          </p>
        ) : null}

        <TaskSelector
          disabled={phase === 'working'}
          isLoading={tasksLoading}
          onQuickAddTask={async (name) => {
            const createdTask = await addTask.mutateAsync({ name, categoryId: null })
            return createdTask.id
          }}
          onSelectTask={setSelectedTask}
          selectedTaskId={selectedTaskId}
          tasks={selectableTasks}
        />

        <div className="mt-8 flex flex-col items-center">
          <TimerClock
            accentColor={selectedTaskColor}
            breakEndAt={breakEndAt}
            breakTotal={breakTotal}
            phase={phase}
            workSeconds={workSeconds}
          />
          <p className="mt-3 text-sm text-ink-secondary">{secondaryText}</p>

          <div className="mt-6">
            <TimerControls
              canStartWork={canStartWork}
              onSkipBreak={skipBreak}
              onStartWork={handleStartWork}
              onStopWork={handleStopWork}
              phase={phase}
            />
          </div>

          {saveSession.isError && saveSession.variables ? (
            <div className="mt-4 w-full rounded-lg border border-red-300/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
              <div className="flex items-start justify-between gap-3">
                <p>
                  Couldn't save session - check your connection. You focused for{' '}
                  {formatDuration(saveSession.variables.work_seconds)}.
                </p>
                <Button
                  aria-label="Dismiss save error"
                  className="p-0 transition hover:bg-red-900/40"
                  onClick={() => saveSession.reset()}
                  size="icon"
                  variant="ghost"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : null}

          {phase === 'done' ? (
            <div className="mt-4 w-full">
              <SessionSummary
                breakTotal={breakTotal}
                isDeletingSession={softDeleteSession.isPending}
                onDeleteSession={
                  lastSavedSession ? () => void handleDeleteLastSession() : undefined
                }
                onEditSession={lastSavedSession ? () => setIsSessionEditOpen(true) : undefined}
                taskColor={lastSessionTaskColor}
                taskName={lastSessionTaskName}
                workSeconds={workSeconds}
              />

              {runawayDetected ? (
                <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
                  <p>Looks like you left the timer running. We capped this session at 6 hours.</p>
                  <Button
                    aria-label="Dismiss runaway warning"
                    className="p-0 transition hover:bg-amber-900/40"
                    onClick={dismissRunaway}
                    size="icon"
                    variant="ghost"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <TimerSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      <SessionEditModal
        error={updateSession.error instanceof Error ? updateSession.error.message : null}
        isOpen={isSessionEditOpen && !!lastSavedSession}
        isSaving={updateSession.isPending}
        onClose={() => setIsSessionEditOpen(false)}
        onSave={handleSaveSessionEdit}
        session={lastSavedSession}
        tasks={selectableTasks}
      />

      {todaySummary.isError ? (
        <p className="mx-auto mt-4 text-sm text-red-300">Unable to load today's summary.</p>
      ) : todaySummary.isLoading ? (
        <div className="mx-auto mt-4 flex items-center gap-2 text-sm text-ink-secondary">
          <Spinner />
          Loading today's summary...
        </div>
      ) : (
        <p className="mx-auto mt-4 text-sm text-ink-secondary">
          Today: {todaySummary.data?.count ?? 0} sessions ·{' '}
          {formatDuration(todaySummary.data?.totalWorkSeconds ?? 0)}
        </p>
      )}
    </section>
  )
}
