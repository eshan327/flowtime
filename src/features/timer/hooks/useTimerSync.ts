import { calibrateServerClock, serverClock } from '@/features/timer/lib/serverClock'
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { createInitialTimerState, useTimerStore } from '@/features/timer/stores/timerStore'
import { useTimerSettingsStore } from '@/features/timer/stores/timerSettingsStore'
import {
  predictTimer,
  readTimerJournal,
  removeTimerCommand,
  storeTimerCommand,
  type CommandState,
  type TimerAction,
  type TimerJournalEntry,
} from '@/features/timer/lib/timerCommands'
import { readFlowtime, commandFlowtime } from '@/lib/flowtimeApi'
import { queryClient } from '@/lib/queryClient'
import { queryKeys } from '@/lib/queryKeys'
import type { TaskWithCategory } from '@/types'
interface ServerTimer {
  state: CommandState
  revision: string | null
  server_time: string
}
export const useTimerCommandStatus = create<{
  pending: number
  conflicts: TimerJournalEntry[]
  error: string | null
}>(() => ({ pending: 0, conflicts: [], error: null }))
let active: {
  send: (action: TimerAction, taskId?: string | null) => Promise<void>
  sync: () => Promise<void>
} | null = null
export async function sendTimerCommand(action: TimerAction, taskId?: string | null) {
  try {
    if (!active) throw new Error('Loading your timer.')
    await active.send(action, taskId)
  } catch (error) {
    useTimerCommandStatus.setState({
      error: error instanceof Error ? error.message : 'Timer command failed.',
    })
  }
}
export async function retryTimerCommands() {
  await active?.sync()
}
export function discardTimerConflict(entry: TimerJournalEntry) {
  removeTimerCommand(entry)
  void active?.sync()
}
export function serializeTimer(): CommandState {
  return JSON.parse(JSON.stringify(useTimerStore.getState()))
}
export function applyServerTimer(timer: ServerTimer, userId: string, pending = false) {
  if (useTimerStore.getState().ownerUserId && useTimerStore.getState().ownerUserId !== userId)
    return
  const source = timer.state,
    initial = createInitialTimerState()
  const s = { ...initial }
  for (const key of Object.keys(initial) as (keyof typeof initial)[]) {
    if (['ownerUserId', 'syncRevision', 'syncPending'].includes(key) || !(key in source)) continue
    const value = (source as unknown as Record<string, unknown>)[key]
    if (
      key === 'runBreakDivisor' &&
      value !== null &&
      (typeof value !== 'number' || !Number.isInteger(value) || value < 1)
    )
      throw new Error('Invalid server break divisor.')
    if (key === 'phase' && !['idle', 'working', 'breaking', 'done'].includes(String(value)))
      throw new Error('Invalid server timer phase.')
    if (
      typeof initial[key] === 'number' &&
      (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    )
      throw new Error('Invalid server timer duration.')
    if (typeof initial[key] === 'boolean' && typeof value !== 'boolean')
      throw new Error('Invalid server timer flag.')
    if (
      initial[key] === null &&
      value !== null &&
      typeof value !== 'string' &&
      key !== 'runBreakDivisor'
    )
      throw new Error('Invalid server timer field.')
    Object.assign(s, { [key]: value })
  }
  const startedAt = source.startedAt ? new Date(source.startedAt) : null,
    breakEndAt = source.breakEndAt ? new Date(source.breakEndAt) : null
  if (
    (startedAt && Number.isNaN(startedAt.getTime())) ||
    (breakEndAt && Number.isNaN(breakEndAt.getTime()))
  )
    throw new Error('Invalid server timer timestamp.')
  if ((source.phase === 'working' && !startedAt) || (source.phase === 'breaking' && !breakEndAt))
    throw new Error('Missing server timer timestamp.')
  useTimerStore.setState({
    ...s,
    ownerUserId: userId,
    syncRevision: timer.revision,
    syncPending: pending,
    startedAt,
    breakEndAt,
  })
}
export function useTimerSync(userId: string | undefined) {
  const [status, setStatus] = useState<{ userId?: string; ready: boolean; error: unknown }>({
    ready: false,
    error: null,
  })
  useEffect(() => {
    if (!userId) return
    let stopped = false,
      busy = false,
      ready = false
    function updateStatus(error: unknown = null) {
      if (stopped) return
      const journal = readTimerJournal(userId!)
      useTimerCommandStatus.setState({
        pending: journal.filter((e) => !e.conflict).length,
        conflicts: journal.filter((e) => !!e.conflict),
      })
      setStatus({ userId, ready, error })
    }
    async function sync() {
      if (busy || stopped) return
      busy = true
      try {
        const journal = readTimerJournal(userId!)
        for (const entry of journal) {
          if (entry.conflict) continue
          try {
            const timer = await commandFlowtime<ServerTimer>('timer', { ...entry.input }, entry.id)
            if (stopped) return
            removeTimerCommand(entry)
            if (!readTimerJournal(userId!).some((e) => !e.conflict))
              applyServerTimer(timer, userId!)
            void queryClient.invalidateQueries({ queryKey: queryKeys.sessions(userId) })
          } catch (error) {
            const code = (error as { code?: string }).code
            if (!code) throw error
            for (const pending of readTimerJournal(userId!)) {
              if (!pending.conflict)
                storeTimerCommand({ ...pending, conflict: (error as { message: string }).message })
            }
            break
          }
        }
        const timer = await readFlowtime<ServerTimer>('timer')
        if (stopped) return
        calibrateServerClock(timer.server_time)
        if (!ready) {
          const local = useTimerStore.getState()
          if (
            local.syncPending &&
            !readTimerJournal(userId!).length &&
            local.ownerUserId === userId &&
            local.startedAt
          ) {
            const before = serializeTimer()
            const id = crypto.randomUUID()
            const input = {
              action: 'stop_work' as const,
              expected_revision: local.syncRevision,
              next_revision: crypto.randomUUID(),
              occurred_at: new Date().toISOString(),
            }
            const predicted =
              before.phase === 'working'
                ? predictTimer(before, input, null, useTimerSettingsStore.getState())
                : { state: before, segments: [] }
            storeTimerCommand({
              id,
              userId: userId!,
              queuedAt: new Date().toISOString(),
              input,
              before,
              after: predicted.state,
              segments: predicted.segments,
              conflict: 'A timer action from the previous browser version needs review.',
            })
          }
        }
        const remaining = readTimerJournal(userId!)
        if (!remaining.some((e) => !e.conflict)) applyServerTimer(timer, userId!)
        ready = true
        updateStatus()
        useTimerCommandStatus.setState({ error: null })
      } catch (error) {
        ready = ready || useTimerStore.getState().ownerUserId === userId
        try {
          updateStatus(error)
        } catch (storageError) {
          const message =
            storageError instanceof Error
              ? storageError.message
              : 'Local timer storage is unavailable.'
          useTimerCommandStatus.setState({ error: message })
          setStatus({ userId, ready: false, error: storageError })
        }
      } finally {
        busy = false
      }
    }
    const controller = {
      sync,
      send: async (action: TimerAction, taskId?: string | null) => {
        if (busy) throw new Error('Timer is synchronizing. Try again in a moment.')
        if (
          readTimerJournal(userId!).some((e) => e.conflict) &&
          !['stop_work', 'skip_break', 'finish_break', 'acknowledge_runaway'].includes(action)
        )
          throw new Error('Review the offline conflict before controlling the timer.')
        const current = useTimerStore.getState(),
          before = serializeTimer(),
          settings = useTimerSettingsStore.getState()
        const selectedId = taskId === undefined ? before.selectedTaskId : taskId
        const tasks = queryClient.getQueryData<TaskWithCategory[]>(queryKeys.tasks(userId)) ?? []
        const task = tasks.find((t) => t.id === selectedId)
        if (
          ['select_task', 'start_work'].includes(action) &&
          selectedId &&
          (!task ||
            task.completed_at ||
            task.deleted_at ||
            task.categories?.deleted_at ||
            task.categories?.archived_at)
        )
          throw new Error('Select an available task.')
        const target = task
          ? {
              selectedTaskId: task.id,
              selectedTaskName: task.name,
              selectedTaskColor: task.categories?.color ?? task.color,
              selectedCategoryId: task.category_id,
              selectedCategoryName: task.categories?.name ?? null,
              selectedCategoryColor: task.categories?.color ?? null,
            }
          : null
        const clock = serverClock()
        const input = {
          action,
          expected_revision: current.syncRevision,
          next_revision: crypto.randomUUID(),
          occurred_at: new Date(clock.now).toISOString(),
          ...(taskId !== undefined ? { task_id: taskId } : {}),
        }
        const predicted = predictTimer(before, input, target, settings)
        const entry: TimerJournalEntry = {
          id: crypto.randomUUID(),
          userId: userId!,
          queuedAt: new Date().toISOString(),
          input,
          before,
          after: predicted.state,
          segments: predicted.segments,
          ...(clock.uncertain
            ? {
                conflict:
                  'Device clock changed or resumed without calibration. Review the local work before importing.',
              }
            : {}),
        }
        storeTimerCommand(entry)
        applyServerTimer(
          { state: predicted.state, revision: input.next_revision, server_time: input.occurred_at },
          userId!,
          true
        )
        useTimerCommandStatus.setState({ error: null })
        updateStatus()
        await sync()
      },
    }
    active = controller
    const resume = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    const interval = window.setInterval(resume, 3000)
    window.addEventListener('online', resume)
    window.addEventListener('focus', resume)
    window.addEventListener('storage', resume)
    document.addEventListener('visibilitychange', resume)
    void sync()
    return () => {
      stopped = true
      if (active === controller) active = null
      window.clearInterval(interval)
      window.removeEventListener('online', resume)
      window.removeEventListener('focus', resume)
      window.removeEventListener('storage', resume)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [userId])
  return {
    timerReady: !!userId && status.userId === userId && status.ready,
    timerSyncError: status.userId === userId ? status.error : null,
  }
}
