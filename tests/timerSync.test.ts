import assert from 'node:assert/strict'
import test from 'node:test'
import { createTimerSync, timerSnapshot } from '../src/features/timer/lib/timerSync.ts'
import type { SyncedTimer } from '../src/features/timer/lib/timerSync.ts'

const idle: SyncedTimer = {
  snapshot: timerSnapshot({ phase: 'idle', workSeconds: 0 }),
  revision: null,
  pending: false,
}
const rest = timerSnapshot({
  phase: 'breaking',
  sessionId: 'session',
  selectedTaskId: 'task',
  workSeconds: 1200,
  breakEndAt: '2026-09-29T15:25:00Z',
  breakTotal: 240,
})
function device(server: { timer: SyncedTimer | null }, initial = idle) {
  const state = { local: initial, online: true, writes: 0, error: null as unknown }
  return Object.assign(
    state,
    createTimerSync({
      getLocal: () => state.local,
      setLocal: (next) => {
        state.local = next
      },
      read: async () => server.timer,
      write: async (next, expected) => {
        state.writes++
        if (!state.online) throw new Error('offline')
        if ((server.timer?.revision ?? null) !== expected) return false
        server.timer = next
        return true
      },
      onStatus: (error) => {
        state.error = error
      },
    })
  )
}

test('fresh devices restore committed actions, propagate changes and never upload clock ticks', async () => {
  assert.equal(
    timerSnapshot({ phase: 'working', workSeconds: 1 }),
    timerSnapshot({ phase: 'working', workSeconds: 300 })
  )
  const server: { timer: SyncedTimer | null } = { timer: null }
  const phone = device(server)
  await phone.sync()
  assert.equal(server.timer, null)
  const laptop = device(server, { ...idle, snapshot: rest, pending: true })
  await laptop.sync()
  await phone.sync()
  assert.equal(phone.local.snapshot, rest)
  assert.equal(phone.writes, 0)
  phone.local = { ...phone.local, snapshot: idle.snapshot, pending: true }
  await phone.sync()
  await laptop.sync()
  assert.equal(laptop.local.snapshot, idle.snapshot)
})

test('stale devices cannot overwrite new actions; failed uploads remain pending until retry', async () => {
  const server = { timer: { snapshot: rest, revision: 'new', pending: false } }
  const stale = device(server, { ...idle, revision: 'old', pending: true })
  await stale.sync()
  assert.equal(stale.local.snapshot, rest)
  assert.equal(stale.writes, 0)
  stale.local = { ...stale.local, snapshot: idle.snapshot, pending: true }
  stale.online = false
  await stale.sync()
  assert.equal(stale.local.pending, true)
  assert.ok(stale.error)
  stale.online = true
  await stale.sync()
  assert.equal(stale.local.pending, false)
  assert.equal(server.timer.snapshot, idle.snapshot)
})

test('an action during upload is flushed; a rejected revision reloads the winning state', async () => {
  let local: SyncedTimer = { ...idle, snapshot: rest, revision: 'old', pending: true }
  let remote: SyncedTimer = { ...idle, revision: 'old' }
  let writes = 0
  const controller = createTimerSync({
    getLocal: () => local,
    setLocal: (next) => {
      local = next
    },
    read: async () => remote,
    write: async (next) => {
      remote = next
      if (++writes === 1) local = { ...local, snapshot: idle.snapshot, pending: true }
      return true
    },
    onStatus: (error) => assert.equal(error, null),
  })
  await controller.sync()
  assert.equal(writes, 2)
  assert.equal(remote.snapshot, idle.snapshot)
  local = { ...local, pending: true }
  await createTimerSync({
    getLocal: () => local,
    setLocal: (next) => {
      local = next
    },
    read: async () => remote,
    write: async () => {
      remote = { snapshot: rest, revision: 'winner', pending: false }
      return false
    },
    onStatus: (error) => assert.equal(error, null),
  }).sync()
  assert.equal(local.snapshot, rest)
})

test('signing out discards a delayed response from the old account', async () => {
  let resolveRead!: (value: SyncedTimer) => void
  const controller = createTimerSync({
    getLocal: () => idle,
    read: () =>
      new Promise((resolve) => {
        resolveRead = resolve
      }),
    setLocal: () => assert.fail('Old account restored'),
    write: async () => {
      assert.fail('Old account wrote')
    },
    onStatus: () => assert.fail('Old account published status'),
  })
  const pending = controller.sync()
  controller.stop()
  resolveRead({ ...idle, snapshot: rest, revision: 'old-account' })
  await pending
})
