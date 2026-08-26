import assert from 'node:assert/strict'
import test from 'node:test'
import { formatClock } from '../src/lib/formatting.ts'

test('formatClock stays compact and safe for long or invalid timers', () => {
  assert.equal(formatClock(3_661), '01:01:01')
  assert.equal(formatClock(Number.POSITIVE_INFINITY), '00:00')
})
