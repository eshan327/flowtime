import assert from 'node:assert/strict'
import test from 'node:test'
import { resolveTimerTask } from '../src/features/timer/lib/timerTask.ts'
import type { TaskWithCategory } from '../src/types/index.ts'

const snapshot = {
  phase: 'idle' as const,
  runawayDetected: false,
  selectedTaskId: 'completed-task',
  selectedTaskName: 'Homework 6',
  selectedTaskColor: '#ff0000',
}

test('unavailable tasks do not leave a stale selection outside active work', () => {
  for (const phase of ['idle', 'breaking', 'done'] as const) {
    assert.equal(resolveTimerTask({ ...snapshot, phase }, undefined), null)
  }
})

test('active and recovered work retain the task name and color snapshot', () => {
  const expected = { id: 'completed-task', name: 'Homework 6', color: '#ff0000' }
  assert.deepEqual(resolveTimerTask({ ...snapshot, phase: 'working' }, undefined), expected)
  assert.deepEqual(resolveTimerTask({ ...snapshot, runawayDetected: true }, undefined), expected)
  assert.equal(
    resolveTimerTask({ ...snapshot, phase: 'working', selectedTaskId: null }, undefined),
    null
  )
})

test('available tasks use current names and category or task colors', () => {
  const task = {
    id: snapshot.selectedTaskId,
    name: 'Renamed homework',
    color: '#0000ff',
    categories: { color: '#00ff00' },
  } as TaskWithCategory
  assert.deepEqual(resolveTimerTask(snapshot, task), {
    id: task.id,
    name: task.name,
    color: '#00ff00',
  })
  assert.equal(resolveTimerTask(snapshot, { ...task, categories: null })?.color, '#0000ff')
})
