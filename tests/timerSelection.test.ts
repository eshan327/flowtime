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
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
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
