import { create } from 'zustand'
import { DEFAULT_BREAK_DIVISOR, getBreakSeconds } from '@/features/timer/stores/timerSettingsStore'

export type TimerPhase = 'idle' | 'working' | 'breaking' | 'done'

export const MAX_SESSION_SECONDS = 6 * 60 * 60

interface TimerState {
  phase: TimerPhase
  workSeconds: number
  breakEndAt: Date | null
  breakTotal: number
  startedAt: Date | null
  selectedTaskId: string | null
  selectedTaskName: string | null
  selectedTaskColor: string | null
  selectedCategoryId: string | null
  selectedCategoryName: string | null
  selectedCategoryColor: string | null
  lastSessionId: string | null
  lastSessionTaskName: string | null
  lastSessionTaskColor: string | null
  runawayDetected: boolean
  startWork: () => void
  stopWork: (options?: {
    sessionTask?: {
      name: string | null
      color: string | null
      categoryId: string | null
      categoryName: string | null
      categoryColor: string | null
    } | null
    breakDivisor?: number
  }) => void
  setWorkSeconds: (seconds: number) => void
  finishBreak: () => void
  skipBreak: () => void
  reset: () => void
  setSelectedTask: (taskId: string | null) => void
  setSelectedTaskSnapshot: (
    task: {
      name: string
      color: string
      categoryId: string | null
      categoryName: string | null
      categoryColor: string | null
    } | null
  ) => void
  setLastSessionId: (sessionId: string | null) => void
  triggerRunaway: (options?: { breakDivisor?: number }) => void
  dismissRunaway: () => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: 'idle',
  workSeconds: 0,
  breakEndAt: null,
  breakTotal: 0,
  startedAt: null,
  selectedTaskId: null,
  selectedTaskName: null,
  selectedTaskColor: null,
  selectedCategoryId: null,
  selectedCategoryName: null,
  selectedCategoryColor: null,
  lastSessionId: null,
  lastSessionTaskName: null,
  lastSessionTaskColor: null,
  runawayDetected: false,

  startWork: () => {
    const { selectedTaskId } = get()
    if (!selectedTaskId) {
      return
    }

    set({
      phase: 'working',
      workSeconds: 0,
      breakEndAt: null,
      breakTotal: 0,
      startedAt: new Date(),
      lastSessionId: null,
      lastSessionTaskName: null,
      lastSessionTaskColor: null,
      runawayDetected: false,
    })
  },

  stopWork: (options) => {
    const {
      workSeconds,
      selectedTaskName,
      selectedTaskColor,
      selectedCategoryId,
      selectedCategoryName,
      selectedCategoryColor,
    } = get()
    const breakDuration = getBreakSeconds(
      workSeconds,
      options?.breakDivisor ?? DEFAULT_BREAK_DIVISOR
    )
    const breakEndAt = new Date(Date.now() + breakDuration * 1000)

    set({
      phase: 'breaking',
      breakEndAt,
      breakTotal: breakDuration,
      lastSessionTaskName: options?.sessionTask?.name ?? selectedTaskName,
      lastSessionTaskColor: options?.sessionTask?.color ?? selectedTaskColor,
      selectedCategoryId: options?.sessionTask?.categoryId ?? selectedCategoryId,
      selectedCategoryName: options?.sessionTask?.categoryName ?? selectedCategoryName,
      selectedCategoryColor: options?.sessionTask?.categoryColor ?? selectedCategoryColor,
    })
  },

  setWorkSeconds: (seconds) => set({ workSeconds: seconds }),

  finishBreak: () => set({ phase: 'done', breakEndAt: null }),

  skipBreak: () =>
    set({
      phase: 'idle',
      breakEndAt: null,
      breakTotal: 0,
      workSeconds: 0,
      startedAt: null,
      lastSessionId: null,
      lastSessionTaskName: null,
      lastSessionTaskColor: null,
    }),

  reset: () =>
    set({
      phase: 'idle',
      workSeconds: 0,
      breakEndAt: null,
      breakTotal: 0,
      startedAt: null,
      lastSessionId: null,
      lastSessionTaskName: null,
      lastSessionTaskColor: null,
      runawayDetected: false,
    }),

  setSelectedTask: (taskId) =>
    set((state) => ({
      selectedTaskId: taskId,
      selectedTaskName: taskId !== state.selectedTaskId ? null : state.selectedTaskName,
      selectedTaskColor: taskId !== state.selectedTaskId ? null : state.selectedTaskColor,
      selectedCategoryId: taskId !== state.selectedTaskId ? null : state.selectedCategoryId,
      selectedCategoryName: taskId !== state.selectedTaskId ? null : state.selectedCategoryName,
      selectedCategoryColor: taskId !== state.selectedTaskId ? null : state.selectedCategoryColor,
    })),

  setSelectedTaskSnapshot: (task) =>
    set({
      selectedTaskName: task?.name ?? null,
      selectedTaskColor: task?.color ?? null,
      selectedCategoryId: task?.categoryId ?? null,
      selectedCategoryName: task?.categoryName ?? null,
      selectedCategoryColor: task?.categoryColor ?? null,
    }),

  setLastSessionId: (sessionId) => set({ lastSessionId: sessionId }),

  triggerRunaway: (options) => {
    const { selectedTaskName, selectedTaskColor } = get()
    const breakDuration = getBreakSeconds(
      MAX_SESSION_SECONDS,
      options?.breakDivisor ?? DEFAULT_BREAK_DIVISOR
    )

    set({
      phase: 'done',
      workSeconds: MAX_SESSION_SECONDS,
      breakEndAt: null,
      breakTotal: breakDuration,
      lastSessionTaskName: selectedTaskName,
      lastSessionTaskColor: selectedTaskColor,
      runawayDetected: true,
    })
  },

  dismissRunaway: () => set({ runawayDetected: false }),
}))
