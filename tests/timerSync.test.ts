import assert from 'node:assert/strict'
import test from 'node:test'
import { createTimerSync, timerSnapshot } from '../src/features/timer/lib/timerSync.ts'
import type { SyncedTimer } from '../src/features/timer/lib/timerSync.ts'

function device(server: { timer: SyncedTimer | null }, initial: SyncedTimer) {
  let local = initial
  let error: unknown = null
  let writes = 0
  const controller = createTimerSync({
    getLocal: () => local,
    setLocal: (timer) => {
      local = timer
    },
    read: async () => server.timer,
    write: async (timer, expected) => {
      writes++
      if ((server.timer?.revision ?? null) !== expected) return false
      server.timer = timer
      return true
    },
    onStatus: (value) => {
      error = value
    },
  })
  return {
    ...controller,
    local: () => local,
    change: (snapshot: string) => {
      local = { ...local, snapshot, pending: true }
    },
    writes: () => writes,
    error: () => error,
  }
}

const idle = {
  snapshot: timerSnapshot({ phase: 'idle', workSeconds: 0 }),
  revision: null,
  pending: false,
}
const rest = timerSnapshot({
  phase: 'breaking',
  selectedTaskId: 'task-1',
  sessionId: 'session-1',
  workSeconds: 1200,
  startedAt: new Date('2026-09-29T15:00:00Z'),
  breakEndAt: new Date('2026-09-29T15:25:00Z'),
  breakTotal: 300,
})

test('a fresh phone restores the same task, rest deadline and session without overwriting them', async () => {
  const server = { timer: { snapshot: rest, revision: 'rest', pending: false } }
  const phone = device(server, idle)
  await phone.sync()
  assert.equal(phone.local().snapshot, rest)
  assert.equal(phone.writes(), 0)
  const restored = JSON.parse(phone.local().snapshot)
  assert.equal(restored.selectedTaskId, 'task-1')
  assert.equal(restored.breakEndAt, '2026-09-29T15:25:00.000Z')
  assert.equal(restored.sessionId, 'session-1')
})

test('ticks do not change the shared snapshot; start, stop and skip propagate both ways', async () => {
  assert.equal(
    timerSnapshot({ phase: 'working', workSeconds: 1 }),
    timerSnapshot({ phase: 'working', workSeconds: 300 })
  )
  const server: { timer: SyncedTimer | null } = { timer: null }
  const laptop = device(server, idle)
  await laptop.sync()
  const phone = device(server, idle)
  await phone.sync()
  laptop.change(rest)
  await laptop.sync()
  await phone.sync()
  assert.equal(phone.local().snapshot, rest)
  phone.change(idle.snapshot)
  await phone.sync()
  await laptop.sync()
  assert.equal(laptop.local().snapshot, idle.snapshot)
  const writes = laptop.writes()
  await laptop.sync()
  assert.equal(laptop.writes(), writes)
})

test('a stale or offline device cannot replace a newer committed action', async () => {
  const server = { timer: { snapshot: rest, revision: 'new', pending: false } }
  const stale = device(server, { ...idle, revision: 'old', pending: true })
  await stale.sync()
  assert.equal(stale.local().snapshot, rest)
  assert.equal(stale.writes(), 0)
})

test('failed uploads keep the pending state and retry after reconnect', async () => {
  let local = { snapshot: rest, revision: 'old', pending: true }
  let online = false
  let error: unknown = null
  const controller = createTimerSync({
    getLocal: () => local,
    setLocal: (next) => {
      local = next as typeof local
    },
    read: async () => ({ ...idle, revision: 'old' }),
    write: async () => {
      if (!online) throw new Error('offline')
      return true
    },
    onStatus: (value) => {
      error = value
    },
  })
  await controller.sync()
  assert.equal(local.pending, true)
  assert.equal(local.snapshot, rest)
  assert.ok(error)
  online = true
  await controller.sync()
  assert.equal(local.pending, false)
  assert.equal(error, null)
})

test('actions during an upload are flushed and compare-and-swap conflicts reload', async () => {
  let local = { ...idle, snapshot: rest, revision: 'old', pending: true }
  let remote = { ...idle, revision: 'old' }
  let writes = 0
  const controller = createTimerSync({
    getLocal: () => local,
    setLocal: (next) => {
      local = next
    },
    read: async () => remote,
    write: async (next) => {
      writes++
      remote = next
      if (writes === 1) local = { ...local, snapshot: idle.snapshot, pending: true }
      return true
    },
    onStatus: (error) => {
      assert.equal(error, null)
    },
  })
  await controller.sync()
  assert.equal(writes, 2)
  assert.equal(remote.snapshot, idle.snapshot)
  assert.equal(local.pending, false)

  const conflict = createTimerSync({
    getLocal: () => ({ ...local, pending: true }),
    setLocal: (next) => {
      local = next
    },
    read: async () => remote,
    write: async () => {
      remote = { snapshot: rest, revision: 'winner', pending: false }
      return false
    },
    onStatus: (error) => {
      assert.equal(error, null)
    },
  })
  await conflict.sync()
  assert.equal(local.snapshot, rest)
})

test('responses from an account that has signed out cannot restore its state', async () => {
  let resolveRead!: (value: SyncedTimer) => void
  let applied = false
  const controller = createTimerSync({
    getLocal: () => idle,
    setLocal: () => {
      applied = true
    },
    read: () =>
      new Promise((resolve) => {
        resolveRead = resolve
      }),
    write: async () => {
      throw new Error('must not write')
    },
    onStatus: () => {
      throw new Error('must not publish status')
    },
  })
  const pending = controller.sync()
  controller.stop()
  resolveRead({ snapshot: rest, revision: 'old-account', pending: false })
  await pending
  assert.equal(applied, false)
})

test('opening a fresh idle device leaves room for an existing browser to migrate its active rest', async () => {
  const server: { timer: SyncedTimer | null } = { timer: null }
  const phone = device(server, idle)
  await phone.sync()
  assert.equal(server.timer, null)
  const laptop = device(server, { snapshot: rest, revision: null, pending: false })
  await laptop.sync()
  await phone.sync()
  assert.equal(phone.local().snapshot, rest)
})
