import { create } from 'zustand'

export type TimerPhase = 'idle' | 'working' | 'breaking' | 'done'

export const MAX_SESSION_SECONDS = 6 * 60 * 60

interface TimerState {
  phase: TimerPhase
  workSeconds: number
  breakEndAt: Date | null
  breakTotal: number
  startedAt: Date | null
  selectedTaskId: string | null
  lastSessionTaskId: string | null
  runawayDetected: boolean
  startWork: () => void
  stopWork: () => void
  setWorkSeconds: (seconds: number) => void
  finishBreak: () => void
  skipBreak: () => void
  reset: () => void
  setSelectedTask: (taskId: string | null) => void
  triggerRunaway: () => void
  dismissRunaway: () => void
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: 'idle',
  workSeconds: 0,
  breakEndAt: null,
  breakTotal: 0,
  startedAt: null,
  selectedTaskId: null,
  lastSessionTaskId: null,
  runawayDetected: false,

  startWork: () =>
    set({
      phase: 'working',
      workSeconds: 0,
      breakEndAt: null,
      breakTotal: 0,
      startedAt: new Date(),
      lastSessionTaskId: null,
      runawayDetected: false,
    }),

  stopWork: () => {
    const { workSeconds, selectedTaskId } = get()
    const breakDuration = Math.floor(workSeconds / 5)
    const breakEndAt = new Date(Date.now() + breakDuration * 1000)

    set({
      phase: 'breaking',
      breakEndAt,
      breakTotal: breakDuration,
      lastSessionTaskId: selectedTaskId,
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
      lastSessionTaskId: null,
    }),

  reset: () =>
    set({
      phase: 'idle',
      workSeconds: 0,
      breakEndAt: null,
      breakTotal: 0,
      startedAt: null,
      lastSessionTaskId: null,
      runawayDetected: false,
    }),

  setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),

  triggerRunaway: () => {
    const { selectedTaskId } = get()
    const breakDuration = Math.floor(MAX_SESSION_SECONDS / 5)

    set({
      phase: 'done',
      workSeconds: MAX_SESSION_SECONDS,
      breakEndAt: null,
      breakTotal: breakDuration,
      lastSessionTaskId: selectedTaskId,
      runawayDetected: true,
    })
  },

  dismissRunaway: () => set({ runawayDetected: false }),
}))
