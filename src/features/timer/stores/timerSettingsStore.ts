import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DONE_CHIME_ID, DONE_CHIME_OPTIONS, type ChimeOptionId } from '@/lib/audio'

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

const validChimeIds = new Set<ChimeOptionId>(DONE_CHIME_OPTIONS.map((option) => option.id))

export function sanitizeChimeId(value: string | null | undefined): ChimeOptionId {
  if (!value) return DEFAULT_DONE_CHIME_ID
  if (validChimeIds.has(value as ChimeOptionId)) {
    return value as ChimeOptionId
  }
  return DEFAULT_DONE_CHIME_ID
}

interface TimerSettingsState {
  breakDivisor: number
  notificationsEnabled: boolean
  chimeEnabled: boolean
  chimeId: ChimeOptionId
  setBreakDivisor: (value: number) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setChimeEnabled: (enabled: boolean) => void
  setChimeId: (chimeId: ChimeOptionId) => void
  resetSettings: () => void
}

export const useTimerSettingsStore = create<TimerSettingsState>()(
  persist(
    (set) => ({
      breakDivisor: DEFAULT_BREAK_DIVISOR,
      notificationsEnabled: true,
      chimeEnabled: true,
      chimeId: DEFAULT_DONE_CHIME_ID,

      setBreakDivisor: (value) =>
        set({
          breakDivisor: sanitizeBreakDivisor(value),
        }),

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setChimeEnabled: (enabled) => set({ chimeEnabled: enabled }),
      setChimeId: (chimeId) => set({ chimeId: sanitizeChimeId(chimeId) }),

      resetSettings: () =>
        set({
          breakDivisor: DEFAULT_BREAK_DIVISOR,
          notificationsEnabled: true,
          chimeEnabled: true,
          chimeId: DEFAULT_DONE_CHIME_ID,
        }),
    }),
    {
      name: 'flowtime-timer-settings',
      version: 1,
    }
  )
)
