import { useCallback, useEffect, useMemo, useState } from 'react'
import { Settings2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import {
  SessionEditModal,
  type SessionEditValues,
} from '@/features/sessions/components/SessionEditModal'
import { useSessionMutations } from '@/features/sessions/hooks/useSessionMutations'
import { SessionSummary } from '@/features/timer/components/SessionSummary'
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
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { getErrorMessage } from '@/lib/errorMessages'
import { formatClock, formatDuration } from '@/lib/formatting'
import { requestNotificationPermission } from '@/lib/notifications'
import {
  createSessionSnapshotForTaskId,
  createSessionSnapshotFromSelection,
  toSessionWithTask,
} from '@/lib/sessionSnapshot'
import type { Session, SessionWithTask } from '@/types'

export function TimerPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSessionEditOpen, setIsSessionEditOpen] = useState(false)
  const [lastSavedSession, setLastSavedSession] = useState<SessionWithTask | null>(null)

  const { user } = useUser()
  const userId = user?.id
  const { activeTasks: tasks, addTask, isLoading: tasksLoading, error: tasksError } = useTasks()
  const { updateSession, softDeleteSession } = useSessionMutations()

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
    workSeconds,
    breakEndAt,
    breakTotal,
    startedAt,
    selectedTaskId,
    selectedTaskName,
    selectedTaskColorSnapshot,
    selectedCategoryId,
    selectedCategoryName,
    selectedCategoryColor,
    lastSessionId,
    lastSessionTaskName,
    lastSessionTaskColor,
    runawayDetected,
    dismissRunaway,
    startWork,
    stopWork,
    skipBreak,
    setSelectedTask,
    setSelectedTaskSnapshot,
    setLastSessionId,
  } = useTimerStore(
    useShallow((state) => ({
      phase: state.phase,
      workSeconds: state.workSeconds,
      breakEndAt: state.breakEndAt,
      breakTotal: state.breakTotal,
      startedAt: state.startedAt,
      selectedTaskId: state.selectedTaskId,
      selectedTaskName: state.selectedTaskName,
      selectedTaskColorSnapshot: state.selectedTaskColor,
      selectedCategoryId: state.selectedCategoryId,
      selectedCategoryName: state.selectedCategoryName,
      selectedCategoryColor: state.selectedCategoryColor,
      lastSessionId: state.lastSessionId,
      lastSessionTaskName: state.lastSessionTaskName,
      lastSessionTaskColor: state.lastSessionTaskColor,
      runawayDetected: state.runawayDetected,
      dismissRunaway: state.dismissRunaway,
      startWork: state.startWork,
      stopWork: state.stopWork,
      skipBreak: state.skipBreak,
      setSelectedTask: state.setSelectedTask,
      setSelectedTaskSnapshot: state.setSelectedTaskSnapshot,
      setLastSessionId: state.setLastSessionId,
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
  } = useTimerSessionPipeline({
    userId,
    setLastSessionId,
    setLastSavedSession,
  })

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
      createSessionSnapshotFromSelection(selectedTask ?? null, {
        taskId: selectedTaskId,
        taskName: selectedTaskName,
        taskColor: selectedTaskColorSnapshot,
        categoryId: selectedCategoryId,
        categoryName: selectedCategoryName,
        categoryColor: selectedCategoryColor,
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

  const replayTask = useMemo(() => {
    const replayTaskId = lastSavedSession?.task_id_snapshot ?? lastSavedSession?.task_id
    if (!replayTaskId) return null
    return selectableTasks.find((task) => task.id === replayTaskId) ?? null
  }, [lastSavedSession, selectableTasks])

  const canReplaySession = phase === 'done' && !!replayTask

  const handleReplayLastSession = useCallback(() => {
    if (!replayTask || !userId) {
      return
    }

    const replayColor = replayTask.categories?.color ?? replayTask.color ?? DEFAULT_TASK_COLOR

    setSelectedTask(replayTask.id, userId)
    setSelectedTaskSnapshot({
      name: replayTask.name,
      color: replayColor,
      categoryId: replayTask.category_id,
      categoryName: replayTask.categories?.name ?? null,
      categoryColor: replayTask.categories?.color ?? null,
    })

    setLastSavedSession(null)
    startWork(userId)
  }, [replayTask, setSelectedTask, setSelectedTaskSnapshot, startWork, userId])

  const handleStopWork = useCallback(() => {
    if (notificationsEnabled) void requestNotificationPermission()
    if (isSavingSession) return

    const snapshot = buildSessionSnapshot()
    const sessionTask = {
      name: snapshot.taskNameSnapshot,
      color: snapshot.taskColorSnapshot,
      categoryId: snapshot.categoryIdSnapshot,
      categoryName: snapshot.categoryNameSnapshot,
      categoryColor: snapshot.categoryColorSnapshot,
    }

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
      ).catch(() => setLastSessionId(null))
    }

    stopWork({ sessionTask, breakDivisor })
  }, [
    breakDivisor,
    buildSessionSnapshot,
    isSavingSession,
    notificationsEnabled,
    saveTimerSession,
    selectedTaskId,
    setLastSessionId,
    startedAt,
    stopWork,
    userId,
    workSeconds,
  ])

  const handleStartWork = useCallback(() => {
    if (!canStartWork || !userId) return
    setLastSavedSession(null)
    startWork(userId)
  }, [canStartWork, startWork, userId])

  const handleSaveSessionEdit = useCallback(
    async (values: SessionEditValues) => {
      if (!lastSavedSession) return

      const selectedEditTask = values.taskId
        ? (selectableTasks.find((task) => task.id === values.taskId) ?? null)
        : null
      const snapshot = createSessionSnapshotForTaskId(
        values.taskId,
        selectedEditTask,
        lastSavedSession
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

      setLastSavedSession((current) => {
        if (!current) return current
        const updated: Session = {
          ...current,
          task_id: values.taskId,
          work_seconds: values.workSeconds,
          break_seconds: values.breakSeconds,
          started_at: values.startedAt,
          ended_at: values.endedAt,
          notes: values.notes,
        }
        return toSessionWithTask(updated, snapshot)
      })
      setIsSessionEditOpen(false)
    },
    [lastSavedSession, selectableTasks, updateSession]
  )

  const handleDeleteLastSession = useCallback(async () => {
    const sessionId = lastSavedSession?.id ?? lastSessionId
    if (!sessionId) return

    await softDeleteSession.mutateAsync(sessionId)
    setLastSavedSession(null)
    setLastSessionId(null)
  }, [lastSavedSession?.id, lastSessionId, setLastSessionId, softDeleteSession])

  useRunawayProtection({
    runawayDetected,
    startedAt,
    userId,
    isSavingSession,
    selectedTaskId,
    breakDivisor,
    buildSessionSnapshot,
    saveTimerSession,
    setLastSessionId,
  })

  useTimerKeyboardShortcuts({
    enabled: shortcutsEnabled,
    phase,
    canStartWork,
    canReplaySession,
    overlaysOpen: isSettingsOpen || isSessionEditOpen,
    onStartWork: handleStartWork,
    onStopWork: handleStopWork,
    onSkipBreak: skipBreak,
    onReplaySession: handleReplayLastSession,
    onOpenSettings: () => setIsSettingsOpen(true),
  })

  return (
    <section className="flex min-h-[calc(100vh-8rem)] w-full flex-col items-center pt-[clamp(2.5rem,8vh,6rem)]">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2">
          <TaskSelector
            disabled={focusModeLock && phase === 'working'}
            isLoading={tasksLoading}
            onQuickAddTask={async (name) => {
              const createdTask = await addTask.mutateAsync({ name, categoryId: null })
              return createdTask.id
            }}
            onSelectTask={(taskId) => setSelectedTask(taskId, userId)}
            selectedTaskId={selectedTaskId}
            shortcutsBlocked={isSettingsOpen || isSessionEditOpen}
            shortcutsEnabled={shortcutsEnabled}
            tasks={selectableTasks}
          />

          <Button
            aria-label="Timer settings"
            className="shrink-0"
            onClick={() => setIsSettingsOpen(true)}
            size="icon"
            title="Timer settings"
            variant="ghost"
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>

        {tasksError ? (
          <p className="mt-3 rounded-lg border border-red-300/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            {getErrorMessage(tasksError, 'Unable to load tasks right now.')} Pick a task before
            starting a timer session.
          </p>
        ) : null}

        <div className="flex flex-col items-center">
          <TimerClock
            accentColor={selectedTaskColor}
            breakEndAt={breakEndAt}
            breakTotal={breakTotal}
            phase={phase}
            workSeconds={workSeconds}
          />
          <p className="text-center text-sm text-ink-secondary">{secondaryText}</p>

          <div className="mt-6">
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
              className="mt-4 w-full rounded-lg border border-amber-300/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-100"
              role="status"
            >
              <div className="flex items-start justify-between gap-3">
                <p>
                  {lastSaveQueued ? 'Saved offline.' : 'Syncing saved sessions.'}{' '}
                  {queuedSessionCount} {queuedSessionCount === 1 ? 'session is' : 'sessions are'}{' '}
                  waiting to sync.
                </p>
                <Button
                  loading={saveSession.isPending}
                  onClick={retryLastSessionSave}
                  size="sm"
                  variant="outlined"
                >
                  Retry
                </Button>
              </div>
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

          {phase === 'done' ? (
            <div className="mt-4 w-full">
              <SessionSummary
                breakTotal={breakTotal}
                isDeletingSession={softDeleteSession.isPending}
                onDeleteSession={
                  lastSavedSession ? () => void handleDeleteLastSession() : undefined
                }
                onEditSession={lastSavedSession ? () => setIsSessionEditOpen(true) : undefined}
                onReplaySession={canReplaySession ? handleReplayLastSession : undefined}
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
        error={
          updateSession.error
            ? getErrorMessage(updateSession.error, 'Unable to update session right now.')
            : null
        }
        isOpen={isSessionEditOpen && !!lastSavedSession}
        isSaving={updateSession.isPending}
        onClose={() => setIsSessionEditOpen(false)}
        onSave={handleSaveSessionEdit}
        session={lastSavedSession}
        tasks={selectableTasks}
      />

      {todaySummary.isError ? (
        <p className="mx-auto mt-6 text-xs text-red-300">Unable to load today's summary.</p>
      ) : todaySummary.isLoading ? (
        <div className="mx-auto mt-6 flex items-center gap-2 text-xs text-ink-tertiary">
          <Spinner />
          Loading today's summary...
        </div>
      ) : (
        <p className="mx-auto mt-6 text-xs text-ink-tertiary">
          Today: {todaySummary.data?.count ?? 0} sessions ·{' '}
          {formatDuration(todaySummary.data?.totalWorkSeconds ?? 0)}
        </p>
      )}
    </section>
  )
}
