import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DONE_CHIME_ID, DONE_CHIME_OPTIONS, type ChimeOptionId } from '@/lib/audio'

export const DEFAULT_BREAK_DIVISOR = 5
export const MIN_GLOBAL_BREAK_DIVISOR = 1
export const DEFAULT_FOCUS_MODE_LOCK = true
export const DEFAULT_SHORTCUTS_ENABLED = true

export function sanitizeBreakDivisor(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_BREAK_DIVISOR

  const rounded = Math.round(value)
  return Math.max(MIN_GLOBAL_BREAK_DIVISOR, rounded)
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
  focusModeLock: boolean
  shortcutsEnabled: boolean
  setBreakDivisor: (value: number) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setChimeEnabled: (enabled: boolean) => void
  setChimeId: (chimeId: ChimeOptionId) => void
  setFocusModeLock: (enabled: boolean) => void
  setShortcutsEnabled: (enabled: boolean) => void
  resetSettings: () => void
}

export const useTimerSettingsStore = create<TimerSettingsState>()(
  persist(
    (set) => ({
      breakDivisor: DEFAULT_BREAK_DIVISOR,
      notificationsEnabled: true,
      chimeEnabled: true,
      chimeId: DEFAULT_DONE_CHIME_ID,
      focusModeLock: DEFAULT_FOCUS_MODE_LOCK,
      shortcutsEnabled: DEFAULT_SHORTCUTS_ENABLED,

      setBreakDivisor: (value) =>
        set({
          breakDivisor: sanitizeBreakDivisor(value),
        }),

      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      setChimeEnabled: (enabled) => set({ chimeEnabled: enabled }),
      setChimeId: (chimeId) => set({ chimeId: sanitizeChimeId(chimeId) }),
      setFocusModeLock: (enabled) => set({ focusModeLock: enabled }),
      setShortcutsEnabled: (enabled) => set({ shortcutsEnabled: enabled }),

      resetSettings: () =>
        set({
          breakDivisor: DEFAULT_BREAK_DIVISOR,
          notificationsEnabled: true,
          chimeEnabled: true,
          chimeId: DEFAULT_DONE_CHIME_ID,
          focusModeLock: DEFAULT_FOCUS_MODE_LOCK,
          shortcutsEnabled: DEFAULT_SHORTCUTS_ENABLED,
        }),
    }),
    {
      name: 'flowtime-timer-settings',
      version: 2,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Partial<TimerSettingsState>

        return {
          ...state,
          breakDivisor: sanitizeBreakDivisor(state.breakDivisor ?? DEFAULT_BREAK_DIVISOR),
          notificationsEnabled:
            typeof state.notificationsEnabled === 'boolean' ? state.notificationsEnabled : true,
          chimeEnabled: typeof state.chimeEnabled === 'boolean' ? state.chimeEnabled : true,
          chimeId: sanitizeChimeId(state.chimeId),
          focusModeLock:
            typeof state.focusModeLock === 'boolean'
              ? state.focusModeLock
              : DEFAULT_FOCUS_MODE_LOCK,
          shortcutsEnabled:
            typeof state.shortcutsEnabled === 'boolean'
              ? state.shortcutsEnabled
              : DEFAULT_SHORTCUTS_ENABLED,
        }
      },
    }
  )
)
