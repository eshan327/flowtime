import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const DEFAULT_BREAK_DIVISOR = 5
export const MIN_BREAK_DIVISOR = 2
export const MAX_BREAK_DIVISOR = 10

export function sanitizeBreakDivisor(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_BREAK_DIVISOR
  return Math.min(MAX_BREAK_DIVISOR, Math.max(MIN_BREAK_DIVISOR, Math.round(value)))
}

export function getBreakSeconds(workSeconds: number, breakDivisor: number) {
  const safeWorkSeconds = Math.max(0, Math.floor(workSeconds))
  const safeDivisor = sanitizeBreakDivisor(breakDivisor)
  return Math.floor(safeWorkSeconds / safeDivisor)
}

interface TimerSettingsState {
  breakDivisor: number
  notificationsEnabled: boolean
  chimeEnabled: boolean
  setBreakDivisor: (value: number) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setChimeEnabled: (enabled: boolean) => void
  resetSettings: () => void
}

export const useTimerSettingsStore = create<TimerSettingsState>()(
  persist(
    (set) => ({
      breakDivisor: DEFAULT_BREAK_DIVISOR,
      notificationsEnabled: true,
      chimeEnabled: true,

      setBreakDivisor: (value) =>
        set({
          breakDivisor: sanitizeBreakDivisor(value),
        }),

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setChimeEnabled: (enabled) => set({ chimeEnabled: enabled }),

      resetSettings: () =>
        set({
          breakDivisor: DEFAULT_BREAK_DIVISOR,
          notificationsEnabled: true,
          chimeEnabled: true,
        }),
    }),
    {
      name: 'flowtime-timer-settings',
      version: 1,
    }
  )
)
