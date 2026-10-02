import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { createTimerSync } from '../src/features/timer/lib/timerSync.ts'
import type { SyncedTimer } from '../src/features/timer/lib/timerSync.ts'

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier.startsWith('@/')
        ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href
        : specifier,
      context
    )
  },
})
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: () =>
      JSON.stringify({
        version: 2,
        state: {
          breakDivisor: 8,
          chimeEnabled: false,
          chimeId: 'zen-gong',
          focusModeLock: false,
          shortcutsEnabled: false,
        },
      }),
    setItem() {},
    removeItem() {},
  },
  configurable: true,
})
Object.defineProperty(globalThis, 'window', {
  value: { localStorage },
  configurable: true,
})
const { sanitizeSettings, useTimerSettingsStore: store } =
  await import('../src/features/timer/stores/timerSettingsStore.ts')
hooks.deregister()

test('legacy settings migrate once; a saved account wins over another browser', async () => {
  store.getState().initializeForUser('user-1')
  assert.equal(store.getState().breakDivisor, 8)
  assert.equal(store.getState().chimeId, 'zen-gong')
  assert.equal(store.getState().chimeEnabled, false)
  let remote: SyncedTimer | null = null
  let online = true
  const controller = createTimerSync({
    getLocal: () => ({
      snapshot: JSON.stringify(sanitizeSettings({ ...store.getState() })),
      revision: store.getState().syncRevision,
      pending: store.getState().syncPending,
    }),
    setLocal: (value) =>
      store.setState({
        ...sanitizeSettings(JSON.parse(value.snapshot)),
        syncRevision: value.revision,
        syncPending: value.pending,
      }),
    read: async () => {
      if (!online) throw new Error('offline')
      return remote
    },
    write: async (value, revision) => {
      if ((remote?.revision ?? null) !== revision) return false
      remote = value
      return true
    },
    onStatus() {},
  })
  await controller.sync()
  assert.equal(JSON.parse(remote!.snapshot).breakDivisor, 8)
  assert.equal(
    JSON.parse(remote!.snapshot).timezone,
    Intl.DateTimeFormat().resolvedOptions().timeZone
  )
  online = false
  store.getState().setBreakDivisor(6)
  await controller.sync()
  assert.equal(store.getState().syncPending, true)
  online = true
  await controller.sync()
  assert.equal(JSON.parse(remote!.snapshot).breakDivisor, 6)
  assert.equal(store.getState().syncPending, false)

  store.getState().clearUserState()
  store.getState().initializeForUser('user-1')
  await controller.sync()
  assert.equal(store.getState().breakDivisor, 6)
  assert.equal(store.getState().chimeId, 'zen-gong')
  store.getState().resetSettings()
  await controller.sync()
  assert.equal(JSON.parse(remote!.snapshot).breakDivisor, 5)
  assert.equal(JSON.parse(remote!.snapshot).chimeEnabled, true)
  controller.stop()
})

test('settings are validated and account switches discard the previous account cache', () => {
  const safe = sanitizeSettings({
    timezone: 'invalid/timezone',
    breakDivisor: Infinity,
    chimeId: 'unknown',
    chimeEnabled: 'false',
    focusModeLock: null,
    shortcutsEnabled: 0,
  })
  assert.equal(safe.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone)
  assert.equal(safe.breakDivisor, 5)
  assert.equal(safe.chimeId, 'classic-rise')
  assert.equal(safe.chimeEnabled, true)
  assert.equal(sanitizeSettings({ breakDivisor: -4 }).breakDivisor, 1)
  assert.equal(sanitizeSettings({ breakDivisor: 3.7 }).breakDivisor, 4)
  assert.equal(sanitizeSettings({ breakDivisor: 1e30 }).breakDivisor, 2_147_483_647)
  assert.equal(sanitizeSettings({ timezone: 'America/New_York' }).timezone, 'America/New_York')
  store.getState().setBreakDivisor(12)
  store.getState().initializeForUser('user-2')
  assert.equal(store.getState().ownerUserId, 'user-2')
  assert.equal(store.getState().breakDivisor, 5)
  assert.equal(store.getState().syncRevision, null)
  assert.equal(store.getState().syncPending, false)
})
