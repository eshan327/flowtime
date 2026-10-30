import { lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react'
import { CloudUpload, Settings2, X } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { TaskSelector } from '@/features/timer/components/TaskSelector'
import { TimerClock } from '@/features/timer/components/TimerClock'
import { TimerControls } from '@/features/timer/components/TimerControls'
import { useTimerKeyboardShortcuts } from '@/features/timer/hooks/useTimerKeyboardShortcuts'
import { TimerSessionContext } from '@/features/timer/hooks/useTimerSessionPipeline'
import { useTodaySummary } from '@/features/timer/hooks/useTodaySummary'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import { useTimerStore } from '@/features/timer/stores/timerStore'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { useCategories } from '@/features/tasks/hooks/useCategories'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { useUser } from '@/context/UserContext'
import { getErrorMessage } from '@/lib/errorMessages'
import { formatDuration } from '@/lib/formatting'
import { sendTimerCommand, useTimerCommandStatus } from '@/features/timer/hooks/useTimerSync'
import { TimerRecovery } from '@/features/timer/components/TimerRecovery'

const loadTimerSettings = () => import('@/features/timer/components/TimerSettingsModal')
const TimerSettingsModal = lazy(() =>
  loadTimerSettings().then((mod) => ({ default: mod.TimerSettingsModal }))
)

export function TimerPage() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const { timerReady, timerSyncError } = useUser()
  const { activeTasks: tasks, addTask, isLoading: tasksLoading, error: tasksError } = useTasks()
  const { categories, isLoading: categoriesLoading } = useCategories()

  const { breakDivisor, focusModeLock, shortcutsEnabled } = useTimerSettingsStore(
    useShallow((state) => ({
      breakDivisor: state.breakDivisor,
      focusModeLock: state.focusModeLock,
      shortcutsEnabled: state.shortcutsEnabled,
    }))
  )

  const { phase, breakEndAt, breakTotal, selectedTaskId, selectedTaskName, runawayDetected } =
    useTimerStore(
      useShallow((state) => ({
        phase: state.phase,
        breakEndAt: state.breakEndAt,
        breakTotal: state.breakTotal,
        selectedTaskId: state.selectedTaskId,
        selectedTaskName: state.selectedTaskName,
        runawayDetected: state.runawayDetected,
      }))
    )

  const { saveSession, retryLastSessionSave, queuedSessionCount, lastSaveQueued, outboxError } =
    useContext(TimerSessionContext)!

  const selectedTask = tasks.find((task) => task.id === selectedTaskId)
  const selectedTaskIsSelectable = selectedTask
    ? selectedTask.category_id === null || selectedTask.categories?.archived_at === null
    : false
  const selectedTaskColor =
    selectedTask?.categories?.color ?? selectedTask?.color ?? DEFAULT_TASK_COLOR
  const canStartWork = Boolean(selectedTask && selectedTaskIsSelectable)

  const todaySummary = useTodaySummary()

  const selectableTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.category_id === null || (task.categories && task.categories.archived_at === null)
      ),
    [tasks]
  )

  const runDivisor = useTimerStore((s) => s.runBreakDivisor)
  const commandError = useTimerCommandStatus((state) => state.error)
  const handleStopWork = useCallback(() => {
    if (timerReady) void sendTimerCommand('stop_work')
  }, [timerReady])
  const handleStartWork = useCallback(() => {
    if (timerReady && canStartWork) void sendTimerCommand('start_work')
  }, [timerReady, canStartWork])
  const handleSkipBreak = useCallback(() => {
    if (timerReady) void sendTimerCommand('skip_break')
  }, [timerReady])

  useTimerKeyboardShortcuts({
    enabled: timerReady && shortcutsEnabled,
    phase,
    canStartWork,
    overlaysOpen: isSettingsOpen,
    onStartWork: handleStartWork,
    onStopWork: handleStopWork,
    onSkipBreak: handleSkipBreak,
    onOpenSettings: () => setIsSettingsOpen(true),
  })

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col items-center">
      <div className="w-full">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <TaskSelector
            categories={categories}
            disabled={!timerReady || (focusModeLock && phase === 'working')}
            isLoading={tasksLoading || categoriesLoading}
            label="Active task"
            onQuickAddTask={async (name) => {
              const createdTask = await addTask.mutateAsync({ name, categoryId: null })
              return createdTask.id
            }}
            onSelectTask={(taskId) => {
              void sendTimerCommand('select_task', taskId)
            }}
            selectedTaskId={selectedTaskId}
            selectedTaskName={selectedTaskName}
            shortcutsBlocked={isSettingsOpen}
            shortcutsEnabled={shortcutsEnabled}
            tasks={selectableTasks}
          />

          <Button
            aria-label="Timer settings"
            onFocus={() => void loadTimerSettings().catch(() => undefined)}
            onMouseEnter={() => void loadTimerSettings().catch(() => undefined)}
            className="h-16 w-14 shrink-0 rounded-xl border border-surface-border bg-surface-panel/60 sm:w-16"
            onClick={() => setIsSettingsOpen(true)}
            size="icon"
            title="Timer settings"
            variant="ghost"
          >
            <Settings2 className="h-5 w-5" />
          </Button>
        </div>

        {!timerReady || timerSyncError ? (
          <p className="mx-auto mt-3 max-w-2xl text-sm text-ink-secondary" role="status">
            {timerSyncError
              ? 'Timer saved on this device. Cross-device sync will retry when connected.'
              : 'Loading your timer...'}
          </p>
        ) : null}

        {tasksError ? (
          <p className="mx-auto mt-3 max-w-2xl rounded-lg border border-red-300/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            {getErrorMessage(tasksError, 'Unable to load tasks right now.')}
          </p>
        ) : null}

        <div className="mt-6 flex flex-col items-center">
          <TimerClock
            accentColor={selectedTaskColor}
            breakEndAt={breakEndAt}
            breakDivisor={phase === 'working' ? (runDivisor ?? breakDivisor) : breakDivisor}
            breakTotal={breakTotal}
            key={phase}
            phase={phase}
          />

          <div className="mt-5 flex w-full justify-center">
            <fieldset disabled={!timerReady} className="flex w-full justify-center">
              <TimerControls
                canStartWork={canStartWork}
                onSkipBreak={handleSkipBreak}
                onStartWork={handleStartWork}
                onStopWork={handleStopWork}
                phase={phase}
              />
            </fieldset>
          </div>

          {shortcutsEnabled &&
          timerReady &&
          (canStartWork || phase === 'working' || phase === 'breaking') ? (
            <p className="mt-3 hidden items-center gap-2 text-xs text-ink-tertiary sm:flex">
              <kbd className="rounded border border-surface-border px-2 py-0.5 font-sans text-[11px]">
                Space
              </kbd>
              {phase === 'working'
                ? 'to take a break'
                : phase === 'breaking'
                  ? 'to skip break'
                  : 'to start'}
            </p>
          ) : null}

          {commandError ? (
            <p role="alert" className="mt-3 text-sm text-red-300">
              {commandError}
            </p>
          ) : null}
          <TimerRecovery />
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
                onClick={() => {
                  void sendTimerCommand('acknowledge_runaway')
                }}
                size="icon"
                variant="ghost"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </div>

        <div className="mx-auto mt-7 grid min-h-5 w-full max-w-xl grid-cols-3 items-center divide-x divide-surface-border border-y border-surface-border py-4 text-center text-sm text-ink-secondary sm:mt-5 sm:py-4 [&>span]:px-3 sm:[&>span]:px-7">
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
              <span>
                <span className="block text-xl font-medium tabular-nums tracking-tight text-ink-primary">
                  {todaySummary.data?.count ?? 0}
                </span>
                <span className="mt-1 block text-xs text-ink-tertiary">sessions</span>
              </span>
              <span>
                <span className="block text-xl font-medium tabular-nums tracking-tight text-ink-primary">
                  {formatDuration(todaySummary.data?.totalWorkSeconds ?? 0)}
                </span>
                <span className="mt-1 block text-xs text-ink-tertiary">focus</span>
              </span>
            </>
          )}
        </div>
      </div>

      {isSettingsOpen ? (
        <Suspense fallback={<Spinner />}>
          <TimerSettingsModal isOpen onClose={() => setIsSettingsOpen(false)} />
        </Suspense>
      ) : null}
    </section>
  )
}
