import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

// Resolve the app's existing aliases without adding a test runner.
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
const stored = new Map<string, string>()
let writes = 0
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => {
      writes += 1
      stored.set(key, value)
    },
    removeItem: (key: string) => stored.delete(key),
  },
  configurable: true,
})
const { useTimerStore } = await import('../src/features/timer/stores/timerStore.ts')
hooks.deregister()

test('unavailable tasks clear during breaks and afterward while work snapshots stay intact', () => {
  for (const phase of ['working', 'breaking', 'done', 'idle'] as const) {
    useTimerStore.getState().clearUserState()
    useTimerStore.getState().setSelectedTask('task-1', 'user-1')
    useTimerStore.getState().setSelectedTaskSnapshot({
      name: 'Completed task',
      color: '#ffffff',
      categoryId: 'category-1',
      categoryName: 'Category',
      categoryColor: '#ffffff',
    })
    useTimerStore.setState({ phase, sessionId: 'session-1', workSeconds: 1200 })
    useTimerStore.getState().clearUnavailableTask([{ id: 'task-1' }])
    assert.equal(useTimerStore.getState().selectedTaskId, 'task-1')
    useTimerStore.getState().clearUnavailableTask([])
    const state = useTimerStore.getState()
    assert.equal(state.selectedTaskId, phase === 'working' ? 'task-1' : null)
    assert.equal(state.selectedTaskName, phase === 'working' ? 'Completed task' : null)
    assert.equal(state.selectedCategoryId, phase === 'working' ? 'category-1' : null)
    assert.equal(state.phase, phase)
    assert.equal(state.sessionId, 'session-1')
    assert.equal(state.workSeconds, 1200)
  }
  useTimerStore.getState().setSelectedTask('task-1')
  useTimerStore.setState({ phase: 'done', runawayDetected: true })
  useTimerStore.getState().clearUnavailableTask([])
  assert.equal(useTimerStore.getState().selectedTaskId, 'task-1')
  useTimerStore.getState().dismissRunaway()
  useTimerStore.getState().clearUnavailableTask([])
  assert.equal(useTimerStore.getState().selectedTaskId, null)
  useTimerStore.getState().clearUserState()
})


test('clock ticks avoid storage writes while actions and final durations persist immediately', () => {
  const store = useTimerStore
  store.getState().clearUserState()
  store.getState().setSelectedTask('task-1', 'user-1')
  store.getState().startWork('user-1')
  const writesAtStart = writes
  let updates = 0
  const unsubscribe = store.subscribe(() => updates++)
  for (let seconds = 1; seconds <= 3600; seconds++) store.getState().setWorkSeconds(seconds)
  assert.equal(writes, writesAtStart)
  assert.equal(store.getState().workSeconds, 3600)
  store.getState().setWorkSeconds(3600)
  assert.equal(updates, 3600)
  unsubscribe()

  store.setState({ syncPending: true })
  assert.equal(writes, writesAtStart + 1)
  store.getState().stopWork({ breakDivisor: 5 })
  assert.equal(writes, writesAtStart + 2)
  const persisted = JSON.parse(stored.get('flowtime-timer-state')!).state
  assert.equal(persisted.phase, 'breaking')
  assert.equal(persisted.workSeconds, 3600)
  assert.equal(persisted.breakTotal, 720)
  assert.equal(persisted.sessionId, store.getState().sessionId)
  assert.equal(persisted.breakEndAt, store.getState().breakEndAt?.toISOString())
  store.getState().clearUserState()
})

test('rehydration reconstructs the running clock from its persisted start timestamp', async () => {
  const store = useTimerStore
  store.getState().setSelectedTask('task-1', 'user-1')
  store.getState().startWork('user-1')
  const startedAt = new Date(Date.now() - 125_000)
  store.setState({ startedAt })
  const sessionId = store.getState().sessionId
  assert.equal(JSON.parse(stored.get('flowtime-timer-state')!).state.workSeconds, 0)
  await store.persist.rehydrate()
  assert.equal(store.getState().phase, 'working')
  assert.equal(store.getState().startedAt?.getTime(), startedAt.getTime())
  assert.equal(store.getState().workSeconds, Math.floor((Date.now() - startedAt.getTime()) / 1000))
  assert.equal(store.getState().sessionId, sessionId)
  store.getState().clearUserState()
})
