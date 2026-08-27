import assert from 'node:assert/strict'
import test from 'node:test'
import { formatClock, formatTimeAxisTick, getTimeAxis } from '../src/lib/formatting.ts'

test('formatClock stays compact and safe for long or invalid timers', () => {
  assert.equal(formatClock(3_661), '01:01:01')
  assert.equal(formatClock(Number.POSITIVE_INFINITY), '00:00')
})

test('focus chart uses round minute or hour ticks sized to the data', () => {
  assert.deepEqual(getTimeAxis(170 * 60), {
    domain: [0, 3 * 3600],
    ticks: [0, 3600, 7200, 10_800],
  })
  assert.deepEqual(getTimeAxis(12 * 60), {
    domain: [0, 15 * 60],
    ticks: [0, 5 * 60, 10 * 60, 15 * 60],
  })
  assert.equal(formatTimeAxisTick(7200), '2h')
})
