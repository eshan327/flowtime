import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { Spinner } from '@/components/ui/Spinner'
import { SessionSummary } from '@/features/timer/components/SessionSummary'
import { TaskSelector } from '@/features/timer/components/TaskSelector'
import { TimerClock } from '@/features/timer/components/TimerClock'
import { TimerControls } from '@/features/timer/components/TimerControls'
import { useSessionSave } from '@/features/timer/hooks/useSessionSave'
import { useTimer } from '@/features/timer/hooks/useTimer'
import { MAX_SESSION_SECONDS, useTimerStore } from '@/features/timer/stores/timerStore'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { DEFAULT_TASK_COLOR } from '@/features/tasks/constants'
import { useUser } from '@/hooks/useUser'
import { requestNotificationPermission } from '@/lib/notifications'
import { formatClock, formatDuration, formatShortDuration } from '@/lib/utils'
import { supabase } from '@/utils/supabase'

export function TimerPage() {
  const { user } = useUser()
  const { tasks, isLoading: tasksLoading, error: tasksError } = useTasks()
  const saveSession = useSessionSave()

  const phase = useTimerStore((state) => state.phase)
  const workSeconds = useTimerStore((state) => state.workSeconds)
  const breakEndAt = useTimerStore((state) => state.breakEndAt)
  const breakTotal = useTimerStore((state) => state.breakTotal)
  const startedAt = useTimerStore((state) => state.startedAt)
  const selectedTaskId = useTimerStore((state) => state.selectedTaskId)
  const lastSessionTaskId = useTimerStore((state) => state.lastSessionTaskId)
  const runawayDetected = useTimerStore((state) => state.runawayDetected)
  const dismissRunaway = useTimerStore((state) => state.dismissRunaway)
  const startWork = useTimerStore((state) => state.startWork)
  const stopWork = useTimerStore((state) => state.stopWork)
  const skipBreak = useTimerStore((state) => state.skipBreak)
  const setSelectedTask = useTimerStore((state) => state.setSelectedTask)

  useTimer()

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const todaySummary = useQuery({
    queryKey: ['sessions', user?.id, 'today-summary', startOfToday.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('work_seconds')
        .eq('user_id', user!.id)
        .gte('started_at', startOfToday.toISOString())

      if (error) throw error

      const sessions = data ?? []
      const totalWorkSeconds = sessions.reduce((sum, session) => sum + session.work_seconds, 0)

      return {
        count: sessions.length,
        totalWorkSeconds,
      }
    },
    enabled: !!user,
  })

  const selectedTask = tasks.find((task) => task.id === selectedTaskId) ?? null
  const sessionTask = tasks.find((task) => task.id === lastSessionTaskId) ?? null

  const secondaryText =
    phase === 'idle'
      ? selectedTask
        ? selectedTask.name
        : 'Select a task to begin'
      : phase === 'working'
        ? `Break earned: ${formatClock(Math.floor(workSeconds / 5))}`
        : phase === 'breaking'
          ? `You earned ${formatClock(breakTotal)} - take it easy`
          : 'Break complete - ready for the next session'

  const handleStopWork = () => {
    void requestNotificationPermission()

    if (!startedAt || !user) {
      stopWork()
      return
    }

    const payload = {
      user_id: user.id,
      task_id: selectedTaskId,
      work_seconds: workSeconds,
      break_seconds: Math.floor(workSeconds / 5),
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
    }

    saveSession.mutate(payload)
    stopWork()
  }

  useEffect(() => {
    if (runawayDetected && startedAt && user) {
      saveSession.mutate({
        user_id: user.id,
        task_id: selectedTaskId,
        work_seconds: MAX_SESSION_SECONDS,
        break_seconds: Math.floor(MAX_SESSION_SECONDS / 5),
        started_at: startedAt.toISOString(),
        ended_at: new Date().toISOString(),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runawayDetected])

  return (
    <section className="mx-auto flex min-h-[75vh] w-full max-w-3xl flex-col justify-center">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-surface-border bg-surface-raised p-6">
        {tasksError ? (
          <p className="mb-3 rounded-lg border border-red-300/40 bg-red-950/20 px-3 py-2 text-sm text-red-200">
            Unable to load tasks right now. You can still run an uncategorized timer session.
          </p>
        ) : null}

        <TaskSelector
          disabled={phase === 'working'}
          isLoading={tasksLoading}
          onSelectTask={setSelectedTask}
          selectedTaskId={selectedTaskId}
          tasks={tasks}
        />

        {selectedTask ? (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-surface-border px-3 py-1 text-xs text-ink-secondary">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{
                backgroundColor:
                  selectedTask.categories?.color ?? selectedTask.color ?? DEFAULT_TASK_COLOR,
              }}
            />
            {selectedTask.name}
          </div>
        ) : null}

        <div className="mt-8 flex flex-col items-center">
          <TimerClock breakEndAt={breakEndAt} phase={phase} workSeconds={workSeconds} />
          <p className="mt-3 text-sm text-ink-secondary">{secondaryText}</p>

          <div className="mt-6">
            <TimerControls
              onSkipBreak={skipBreak}
              onStartWork={startWork}
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
                <button
                  aria-label="Dismiss save error"
                  className="rounded p-1 transition hover:bg-red-900/40"
                  onClick={() => saveSession.reset()}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}

          {phase === 'done' ? (
            <div className="mt-4 w-full">
              <SessionSummary
                breakTotal={breakTotal}
                taskColor={sessionTask?.categories?.color ?? sessionTask?.color ?? null}
                taskName={sessionTask?.name ?? null}
                workSeconds={workSeconds}
              />

              {runawayDetected ? (
                <div className="mt-3 flex items-start justify-between gap-3 rounded-lg border border-amber-700/40 bg-amber-900/20 px-3 py-2 text-sm text-amber-200">
                  <p>Looks like you left the timer running. We capped this session at 6 hours.</p>
                  <button
                    aria-label="Dismiss runaway warning"
                    className="rounded p-1 transition hover:bg-amber-900/40"
                    onClick={dismissRunaway}
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

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
          {formatShortDuration(todaySummary.data?.totalWorkSeconds ?? 0)}
        </p>
      )}
    </section>
  )
}
