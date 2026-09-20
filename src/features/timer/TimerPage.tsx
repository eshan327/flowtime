import { useCallback, useEffect, useMemo, useState } from 'react'
import { CloudUpload, Settings2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TimerSettingsModal } from '@/features/timer/components/TimerSettingsModal'
import { TaskSelector } from '@/features/timer/components/TaskSelector'
import { TimerClock } from '@/features/timer/components/TimerClock'
import { TimerControls } from '@/features/timer/components/TimerControls'
import { useRunawayProtection } from '@/features/timer/hooks/useRunawayProtection'
import { useTimerKeyboardShortcuts } from '@/features/timer/hooks/useTimerKeyboardShortcuts'
import { useTimerSessionPipeline } from '@/features/timer/hooks/useTimerSessionPipeline'
import { useTodaySummary } from '@/features/timer/hooks/useTodaySummary'
import { useTimer } from '@/features/timer/hooks/useTimer'
import { getBreakSeconds, useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { useTimerStore } from '@/features/timer/stores/timerStore'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { useUser } from '@/context/UserContext'
import { getErrorMessage } from '@/lib/errorMessages'
import { formatDuration } from '@/lib/formatting'
import { requestNotificationPermission } from '@/lib/notifications'
import { snapshotTask } from '@/lib/sessionSnapshot'

export function TimerPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const { user } = useUser()
  const userId = user?.id
  const { activeTasks: tasks, addTask, isLoading: tasksLoading, error: tasksError } = useTasks()
  const { categories, isLoading: categoriesLoading } = useCategories()

  const {
    breakDivisor,
    notificationsEnabled,
    chimeEnabled,
    chimeId,
    focusModeLock,
    shortcutsEnabled,
  } = useTimerSettingsStore(
    useShallow((state) => ({
      breakDivisor: state.breakDivisor,
      notificationsEnabled: state.notificationsEnabled,
      chimeEnabled: state.chimeEnabled,
      chimeId: state.chimeId,
      focusModeLock: state.focusModeLock,
      shortcutsEnabled: state.shortcutsEnabled,
    }))
  )

  const {
    phase,
    breakEndAt,
    breakTotal,
    startedAt,
    selectedTaskId,
    selectedTaskName,
    selectedTaskColorSnapshot,
    selectedCategoryId,
    selectedCategoryName,
    selectedCategoryColor,
    runawayDetected,
    dismissRunaway,
    startWork,
    stopWork,
    skipBreak,
    setSelectedTask,
    setSelectedTaskSnapshot,
  } = useTimerStore(
    useShallow((state) => ({
      phase: state.phase,
      breakEndAt: state.breakEndAt,
      breakTotal: state.breakTotal,
      startedAt: state.startedAt,
      selectedTaskId: state.selectedTaskId,
      selectedTaskName: state.selectedTaskName,
      selectedTaskColorSnapshot: state.selectedTaskColor,
      selectedCategoryId: state.selectedCategoryId,
      selectedCategoryName: state.selectedCategoryName,
      selectedCategoryColor: state.selectedCategoryColor,
      runawayDetected: state.runawayDetected,
      dismissRunaway: state.dismissRunaway,
      startWork: state.startWork,
      stopWork: state.stopWork,
      skipBreak: state.skipBreak,
      setSelectedTask: state.setSelectedTask,
      setSelectedTaskSnapshot: state.setSelectedTaskSnapshot,
    }))
  )

  const {
    saveSession,
    saveTimerSession,
    retryLastSessionSave,
    queuedSessionCount,
    lastSaveQueued,
    outboxError,
    isSavingSession,
  } = useTimerSessionPipeline({ userId })

  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const selectedTaskIsSelectable = selectedTask
    ? selectedTask.category_id === null || selectedTask.categories?.archived_at === null
    : false
  const selectedTaskColor =
    selectedTask?.categories?.color ?? selectedTask?.color ?? DEFAULT_TASK_COLOR
  const canStartWork = Boolean(selectedTask && selectedTaskIsSelectable)

  useTimer({
    breakDivisor,
    notificationsEnabled,
    chimeEnabled,
    chimeId,
  })
  const todaySummary = useTodaySummary()

  const selectableTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.category_id === null || (task.categories && task.categories.archived_at === null)
      ),
    [tasks]
  )

  const buildSessionSnapshot = useCallback(
    () =>
      selectedTask
        ? snapshotTask(selectedTask)
        : {
            taskIdSnapshot: selectedTaskId,
            taskNameSnapshot: selectedTaskName,
            taskColorSnapshot: selectedTaskColorSnapshot,
            categoryIdSnapshot: selectedCategoryId,
            categoryNameSnapshot: selectedCategoryName,
            categoryColorSnapshot: selectedCategoryColor,
          },
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

  useEffect(() => {
    if (phase !== 'idle') return
    if (!selectedTaskId) return
    if (selectableTasks.some((task) => task.id === selectedTaskId)) return
    setSelectedTask(null, userId)
  }, [phase, selectedTaskId, selectableTasks, setSelectedTask, userId])

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

  const handleStopWork = useCallback(() => {
    if (notificationsEnabled) void requestNotificationPermission()
    if (isSavingSession) return

    const workSeconds = useTimerStore.getState().workSeconds
    const snapshot = buildSessionSnapshot()
    if (startedAt && userId) {
      void saveTimerSession(
        {
          user_id: userId,
          task_id: selectedTaskId,
          work_seconds: workSeconds,
          break_seconds: getBreakSeconds(workSeconds, breakDivisor),
          started_at: startedAt.toISOString(),
          ended_at: new Date().toISOString(),
        },
        snapshot
      ).catch(() => undefined)
    }

    stopWork({ breakDivisor })
  }, [
    breakDivisor,
    buildSessionSnapshot,
    isSavingSession,
    notificationsEnabled,
    saveTimerSession,
    selectedTaskId,
    startedAt,
    stopWork,
    userId,
  ])

  const handleStartWork = useCallback(() => {
    if (!canStartWork || !userId) return
    startWork(userId)
  }, [canStartWork, startWork, userId])

  useRunawayProtection({
    runawayDetected,
    startedAt,
    userId,
    isSavingSession,
    selectedTaskId,
    breakDivisor,
    buildSessionSnapshot,
    saveTimerSession,
  })

  useTimerKeyboardShortcuts({
    enabled: shortcutsEnabled,
    phase,
    canStartWork,
    overlaysOpen: isSettingsOpen,
    onStartWork: handleStartWork,
    onStopWork: handleStopWork,
    onSkipBreak: skipBreak,
    onOpenSettings: () => setIsSettingsOpen(true),
  })

  return (
    <section className="flex w-full flex-col items-center justify-start md:min-h-[calc(100vh-4.5rem)]">
      <div className="w-full px-0 py-2 sm:px-2">
        <div className="mx-auto flex max-w-6xl items-center gap-5 border-b border-surface-border pb-1">
          <TaskSelector
            categories={categories}
            disabled={focusModeLock && phase === 'working'}
            isLoading={tasksLoading || categoriesLoading}
            label="Active task"
            onQuickAddTask={async (name) => {
              const createdTask = await addTask.mutateAsync({ name, categoryId: null })
              return createdTask.id
            }}
            onSelectTask={(taskId) => setSelectedTask(taskId, userId)}
            selectedTaskId={selectedTaskId}
            shortcutsBlocked={isSettingsOpen}
            shortcutsEnabled={shortcutsEnabled}
            tasks={selectableTasks}
          />

          <Button
            aria-label="Timer settings"
            className="h-16 w-16 shrink-0"
            onClick={() => setIsSettingsOpen(true)}
            size="icon"
            title="Timer settings"
            variant="ghost"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>

        {tasksError ? (
          <p className="mx-auto mt-3 max-w-2xl rounded-lg border border-red-300/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            {getErrorMessage(tasksError, 'Unable to load tasks right now.')}
          </p>
        ) : null}

        <div className="mt-7 flex flex-col items-center">
          <TimerClock
            accentColor={selectedTaskColor}
            breakEndAt={breakEndAt}
            breakDivisor={breakDivisor}
            breakTotal={breakTotal}
            key={phase}
            phase={phase}
          />

          <div className="mt-8 flex w-full justify-center">
            <TimerControls
              canStartWork={canStartWork}
              onSkipBreak={skipBreak}
              onStartWork={handleStartWork}
              onStopWork={handleStopWork}
              phase={phase}
            />
          </div>

          {queuedSessionCount > 0 ? (
            <div
              aria-live="polite"
              className="mt-5 flex w-full items-center justify-center gap-2 text-sm text-ink-secondary"
              role="status"
            >
              <CloudUpload className="h-4 w-4 text-accent-primary" />
              <span>
                {lastSaveQueued ? 'Saved offline' : 'Syncing'} · {queuedSessionCount}{' '}
                {queuedSessionCount === 1 ? 'session' : 'sessions'} pending
              </span>
              <Button
                className="h-auto px-1 py-0 text-xs"
                loading={saveSession.isPending}
                onClick={retryLastSessionSave}
                size="sm"
                variant="ghost"
              >
                Retry
              </Button>
            </div>
          ) : null}

          {saveSession.isError && queuedSessionCount === 0 && saveSession.variables ? (
            <div
              className="mt-4 w-full rounded-lg border border-red-300/40 bg-red-950/20 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              <div className="flex items-start justify-between gap-3">
                <p>
                  Couldn't save or queue this session. You focused for{' '}
                  {formatDuration(saveSession.variables.work_seconds)}.
                </p>
                <div className="flex shrink-0 items-center gap-1">
                  <Button onClick={retryLastSessionSave} size="sm" variant="outlined">
                    Retry
                  </Button>
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
            </div>
          ) : null}

          {outboxError ? (
            <p className="mt-2 text-xs text-red-300" role="alert">
              Offline storage is unavailable; keep this page open until the session saves.
            </p>
          ) : null}

          {runawayDetected ? (
            <div className="mx-auto mt-8 flex w-full max-w-2xl items-start justify-between gap-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
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

        <div className="mx-auto mt-8 grid min-h-5 w-full max-w-6xl grid-cols-3 items-center divide-x divide-surface-border border-y border-surface-border px-4 py-5 text-center text-sm text-ink-secondary sm:px-1 [&>span]:px-2 sm:[&>span]:px-7">
          {todaySummary.isError ? (
            <p className="col-span-3 text-red-300">Unable to load today's summary.</p>
          ) : todaySummary.isLoading ? (
            <div className="col-span-3 flex items-center justify-center gap-2">
              <Spinner />
              <span>Loading today...</span>
            </div>
          ) : (
            <>
              <span className="text-left font-medium text-ink-primary">Today</span>
              <span>{todaySummary.data?.count ?? 0} sessions</span>
              <span className="text-right">
                {formatDuration(todaySummary.data?.totalWorkSeconds ?? 0)} focus
              </span>
            </>
          )}
        </div>
      </div>

      <TimerSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </section>
  )
}
