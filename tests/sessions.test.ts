import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import type { SessionWithTask } from '../src/types/index.ts'
import { splitSessionTime, workSecondsInDateRange } from '../src/lib/sessionTime.ts'

process.env.TZ = 'America/New_York'
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
const { snapshotSession } = await import('../src/lib/sessionSnapshot.ts')
const { aggregateByTask, aggregateByCategory, aggregateByWeek } =
  await import('../src/lib/utils.ts')
hooks.deregister()
const saved = {
  task_id: 'task',
  task_id_snapshot: 'task',
  task_name_snapshot: 'Original',
  task_color_snapshot: '#111111',
  category_id_snapshot: null,
  category_name_snapshot: null,
  category_color_snapshot: null,
  started_at: '2024-12-31T23:30:00-05:00',
  ended_at: '2025-01-01T00:30:00-05:00',
  work_seconds: 3600,
  tasks: {
    id: 'task',
    name: 'Renamed',
    color: '#222222',
    category_id: 'category',
    categories: { name: 'New category', color: '#333333' },
  },
} as SessionWithTask

test('saved attribution survives renames, moves and deletion; legacy rows still use live tasks', () => {
  const snapshot = snapshotSession(saved)
  assert.equal(snapshot.taskNameSnapshot, 'Original')
  assert.equal(snapshot.categoryIdSnapshot, null)
  assert.equal(snapshot.taskColorSnapshot, '#111111')
  assert.deepEqual(snapshotSession({ ...saved, task_id: null, tasks: null }), snapshot)
  assert.equal(aggregateByTask([saved])[0].categoryName, null)
  assert.equal(aggregateByCategory([saved])[0].categoryName, 'Uncategorized')
  assert.equal(
    snapshotSession({ ...saved, task_id_snapshot: null, task_name_snapshot: null })
      .taskNameSnapshot,
    'Renamed'
  )
})

test('midnight, daylight saving and year boundaries preserve recorded totals', () => {
  const midnight = splitSessionTime({ ...saved, work_seconds: 3001 }, 'day')
  assert.deepEqual(
    midnight.map((slice) => slice.seconds),
    [1501, 1500]
  )
  assert.equal(
    splitSessionTime(saved, 'hour').reduce((sum, slice) => sum + slice.seconds, 0),
    3600
  )
  const spring = splitSessionTime(
    {
      started_at: '2026-03-07T23:00:00-05:00',
      ended_at: '2026-03-09T00:00:00-04:00',
      work_seconds: 86400,
    },
    'day'
  )
  assert.deepEqual(
    spring.map((slice) => slice.seconds),
    [3600, 82800]
  )
  const from = new Date('2025-01-01T00:00:00-05:00')
  const to = new Date('2025-12-31T23:59:59.999-05:00')
  assert.equal(workSecondsInDateRange(saved, from, to), 1800)
  const yearEnd = {
    ...saved,
    started_at: '2025-12-31T23:30:00-05:00',
    ended_at: '2026-01-01T00:30:00-05:00',
  }
  const bars = aggregateByWeek([saved, yearEnd], from, to)
  assert.equal(bars[0].totalSeconds, 1800)
  assert.equal(bars.at(-1)!.totalSeconds, 1800)
  assert.equal(
    bars.reduce((sum, bar) => sum + bar.totalSeconds, 0),
    3600
  )
})
