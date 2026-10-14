import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

const stored = new Map([
  [
    'flowtime-timer-settings',
    JSON.stringify({ version: 2, state: { breakDivisor: 8, chimeId: 'zen-gong' } }),
  ],
])
let writes = 0
Object.assign(globalThis, {
  localStorage: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes++
      stored.set(key, value)
    },
    removeItem: (key: string) => stored.delete(key),
  },
})
Object.assign(globalThis, { window: { localStorage } })
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
const { useTimerStore: timer } = await import('../src/features/timer/stores/timerStore.ts')
const {
  useTimerSettingsStore: settings,
  sanitizeSettings,
  sanitizeBreakDivisor,
} = await import('../src/features/timer/stores/timerSettingsStore.ts')
hooks.deregister()

test('timer actions persist, ticks do not, and reload preserves the session and work snapshot', async (t) => {
  t.mock.method(Date, 'now', () => 1760000000000)
  timer.getState().setSelectedTask('task', 'user')
  timer.getState().startWork('user')
  timer.setState({ startedAt: new Date(Date.now() - 120000) })
  const id = timer.getState().sessionId
  const count = writes
  timer.getState().setWorkSeconds(120)
  timer.getState().clearUnavailableTask([])
  assert.equal(writes, count)
  assert.equal(timer.getState().selectedTaskId, 'task')
  await timer.persist.rehydrate()
  assert.equal(timer.getState().sessionId, id)
  assert.ok(timer.getState().workSeconds >= 120)
  timer.getState().stopWork({ breakDivisor: 5 })
  const saved = JSON.parse(stored.get('flowtime-timer-state')!).state
  assert.equal(saved.phase, 'breaking')
  assert.equal(saved.breakTotal, 24)
  assert.equal(saved.workSeconds, 120)
  timer.getState().clearUnavailableTask([])
  assert.equal(timer.getState().selectedTaskId, null)
  timer.getState().clearUserState()
  assert.equal(timer.getState().ownerUserId, null)
  assert.equal(timer.getState().sessionId, null)
})

test('legacy settings survive migration, invalid settings are sanitized, and another account gets defaults', () => {
  settings.getState().initializeForUser('user')
  assert.equal(settings.getState().breakDivisor, 8)
  assert.equal(settings.getState().chimeId, 'zen-gong')
  const safe = sanitizeSettings({
    timezone: 'invalid/timezone',
    breakDivisor: Infinity,
    chimeId: 'unknown',
    chimeEnabled: 'false',
  })
  assert.equal(safe.breakDivisor, 5)
  assert.equal(safe.chimeId, 'classic-rise')
  assert.equal(safe.chimeEnabled, true)
  assert.equal(safe.timezone, Intl.DateTimeFormat().resolvedOptions().timeZone)
  assert.deepEqual([-4, 3.7, 1e30].map(sanitizeBreakDivisor), [1, 4, 2147483647])
  settings.getState().setBreakDivisor(12)
  settings.getState().initializeForUser('other')
  assert.equal(settings.getState().breakDivisor, 5)
  assert.equal(settings.getState().syncPending, false)
  assert.equal(settings.getState().syncRevision, null)
})
