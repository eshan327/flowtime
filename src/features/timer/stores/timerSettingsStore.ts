import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_DONE_CHIME_ID, DONE_CHIME_OPTIONS, type ChimeOptionId } from '@/lib/audio'

export const DEFAULT_BREAK_DIVISOR = 5
export const MIN_GLOBAL_BREAK_DIVISOR = 1

export const DEFAULT_SETTINGS = {
  breakDivisor: DEFAULT_BREAK_DIVISOR,
  chimeEnabled: true,
  chimeId: DEFAULT_DONE_CHIME_ID,
  focusModeLock: true,
  shortcutsEnabled: true,
}

export function sanitizeBreakDivisor(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_BREAK_DIVISOR

  const rounded = Math.round(value)
  return Math.min(2_147_483_647, Math.max(MIN_GLOBAL_BREAK_DIVISOR, rounded))
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

export function sanitizeSettings(value: Record<string, unknown>) {
  let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
  if (typeof value.timezone === 'string') {
    try {
      timezone = new Intl.DateTimeFormat('en', { timeZone: value.timezone }).resolvedOptions()
        .timeZone
    } catch {
      // Invalid cached timezone: use the browser's IANA timezone.
    }
  }
  return {
    timezone,
    breakDivisor: sanitizeBreakDivisor(
      typeof value.breakDivisor === 'number' ? value.breakDivisor : DEFAULT_SETTINGS.breakDivisor
    ),
    chimeEnabled: typeof value.chimeEnabled === 'boolean' ? value.chimeEnabled : true,
    chimeId: sanitizeChimeId(typeof value.chimeId === 'string' ? value.chimeId : null),
    focusModeLock: typeof value.focusModeLock === 'boolean' ? value.focusModeLock : true,
    shortcutsEnabled: typeof value.shortcutsEnabled === 'boolean' ? value.shortcutsEnabled : true,
  }
}

interface TimerSettingsState {
  timezone: string
  breakDivisor: number
  chimeEnabled: boolean
  chimeId: ChimeOptionId
  focusModeLock: boolean
  shortcutsEnabled: boolean
  ownerUserId: string | null
  syncRevision: string | null
  syncPending: boolean
  setBreakDivisor: (value: number) => void
  setChimeEnabled: (enabled: boolean) => void
  setChimeId: (chimeId: ChimeOptionId) => void
  setFocusModeLock: (enabled: boolean) => void
  setShortcutsEnabled: (enabled: boolean) => void
  resetSettings: () => void
  clearUserState: () => void
  initializeForUser: (userId: string) => void
}

export const useTimerSettingsStore = create<TimerSettingsState>()(
  persist(
    (set, get) => ({
      ...sanitizeSettings({}),
      ownerUserId: null,
      syncRevision: null,
      syncPending: false,
      setBreakDivisor: (value) =>
        set({ breakDivisor: sanitizeBreakDivisor(value), syncPending: true }),
      setChimeEnabled: (enabled) => set({ chimeEnabled: enabled, syncPending: true }),
      setChimeId: (chimeId) => set({ chimeId: sanitizeChimeId(chimeId), syncPending: true }),
      setFocusModeLock: (enabled) => set({ focusModeLock: enabled, syncPending: true }),
      setShortcutsEnabled: (enabled) => set({ shortcutsEnabled: enabled, syncPending: true }),
      resetSettings: () => set({ ...DEFAULT_SETTINGS, syncPending: true }),
      clearUserState: () =>
        set({ ...sanitizeSettings({}), ownerUserId: null, syncRevision: null, syncPending: false }),
      initializeForUser: (userId) => {
        if (get().ownerUserId && get().ownerUserId !== userId) get().clearUserState()
        set({ ownerUserId: userId })
      },
    }),
    {
      // Offline cache; the server is authoritative once an account has a settings row.
      name: 'flowtime-timer-settings',
      version: 3,
      migrate: (persistedState) => persistedState,
      merge: (persistedState, currentState) => {
        const state = (persistedState ?? {}) as Record<string, unknown>
        return {
          ...currentState,
          ...sanitizeSettings(state),
          ownerUserId: typeof state.ownerUserId === 'string' ? state.ownerUserId : null,
          syncRevision: typeof state.syncRevision === 'string' ? state.syncRevision : null,
          syncPending: state.syncPending === true,
        }
      },
    }
  )
)
