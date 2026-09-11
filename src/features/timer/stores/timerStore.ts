import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULT_BREAK_DIVISOR, getBreakSeconds } from '@/features/timer/stores/timerSettingsStore'

export type TimerPhase = 'idle' | 'working' | 'breaking' | 'done'

export const MAX_SESSION_SECONDS = 6 * 60 * 60

interface TimerState {
  ownerUserId: string | null
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
  runawayDetected: boolean
  startWork: (userId: string) => void
  stopWork: (options?: { breakDivisor?: number }) => void
  setWorkSeconds: (seconds: number) => void
  finishBreak: () => void
  skipBreak: () => void
  clearUserState: () => void
  setSelectedTask: (taskId: string | null, userId?: string) => void
  setSelectedTaskSnapshot: (
    task: {
      name: string
      color: string
      categoryId: string | null
      categoryName: string | null
      categoryColor: string | null
    } | null
  ) => void
  triggerRunaway: (options?: { breakDivisor?: number }) => void
  dismissRunaway: () => void
}

function createInitialTimerState() {
  return {
    ownerUserId: null,
    phase: 'idle' as TimerPhase,
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
    runawayDetected: false,
  }
}

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      ...createInitialTimerState(),

      startWork: (userId) => {
        const { selectedTaskId } = get()
        if (!selectedTaskId) {
          return
        }

        set({
          ownerUserId: userId,
          phase: 'working',
          workSeconds: 0,
          breakEndAt: null,
          breakTotal: 0,
          startedAt: new Date(),
          runawayDetected: false,
        })
      },

      stopWork: (options) => {
        const { workSeconds } = get()
        const breakDuration = getBreakSeconds(
          workSeconds,
          options?.breakDivisor ?? DEFAULT_BREAK_DIVISOR
        )
        const breakEndAt = new Date(Date.now() + breakDuration * 1000)

        set({
          phase: 'breaking',
          breakEndAt,
          breakTotal: breakDuration,
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
        }),

      clearUserState: () => set(createInitialTimerState()),

      setSelectedTask: (taskId, userId) =>
        set((state) => ({
          ownerUserId: userId ?? state.ownerUserId,
          selectedTaskId: taskId,
          selectedTaskName: taskId !== state.selectedTaskId ? null : state.selectedTaskName,
          selectedTaskColor: taskId !== state.selectedTaskId ? null : state.selectedTaskColor,
          selectedCategoryId: taskId !== state.selectedTaskId ? null : state.selectedCategoryId,
          selectedCategoryName: taskId !== state.selectedTaskId ? null : state.selectedCategoryName,
          selectedCategoryColor:
            taskId !== state.selectedTaskId ? null : state.selectedCategoryColor,
        })),

      setSelectedTaskSnapshot: (task) =>
        set({
          selectedTaskName: task?.name ?? null,
          selectedTaskColor: task?.color ?? null,
          selectedCategoryId: task?.categoryId ?? null,
          selectedCategoryName: task?.categoryName ?? null,
          selectedCategoryColor: task?.categoryColor ?? null,
        }),

      triggerRunaway: (options) => {
        const breakDuration = getBreakSeconds(
          MAX_SESSION_SECONDS,
          options?.breakDivisor ?? DEFAULT_BREAK_DIVISOR
        )

        set({
          phase: 'done',
          workSeconds: MAX_SESSION_SECONDS,
          breakEndAt: null,
          breakTotal: breakDuration,
          runawayDetected: true,
        })
      },

      dismissRunaway: () => set({ runawayDetected: false }),
    }),
    {
      name: 'flowtime-timer-state',
      version: 1,
      storage: createJSONStorage(() => localStorage, {
        reviver: (key, value) => {
          if ((key === 'startedAt' || key === 'breakEndAt') && typeof value === 'string') {
            const date = new Date(value)
            return Number.isNaN(date.getTime()) ? null : date
          }

          return value
        },
      }),
    }
  )
)
