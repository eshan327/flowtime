import assert from 'node:assert/strict'
import test from 'node:test'
import { splitSessionTime, workSecondsInDateRange } from '../src/lib/sessionTime.ts'

test('splits recorded work across local midnight and keeps the exact total', () => {
  const session = {
    started_at: '2026-09-22T23:30:00-04:00',
    ended_at: '2026-09-23T00:30:00-04:00',
    work_seconds: 3_001,
  }
  const days = splitSessionTime(session, 'day')
  assert.deepEqual(
    days.map((slice) => slice.seconds),
    [1_501, 1_500]
  )
  assert.deepEqual(
    days.map((slice) => slice.start.getDate()),
    [22, 23]
  )
  assert.equal(
    splitSessionTime(session, 'hour').reduce((sum, slice) => sum + slice.seconds, 0),
    3_001
  )
})

test('local days handle the spring daylight saving transition', () => {
  const days = splitSessionTime(
    {
      started_at: '2026-03-07T23:00:00-05:00',
      ended_at: '2026-03-09T00:00:00-04:00',
      work_seconds: 24 * 3_600,
    },
    'day'
  )
  assert.deepEqual(
    days.map((slice) => slice.seconds),
    [3_600, 82_800]
  )
})

test('old sessions are split across month and year ranges without changing the saved total', () => {
  const savedSession = {
    started_at: '2024-12-31T23:30:00-05:00',
    ended_at: '2025-01-01T00:30:00-05:00',
    work_seconds: 3_600,
  }
  const december = workSecondsInDateRange(
    savedSession,
    new Date('2024-12-01T00:00:00-05:00'),
    new Date('2024-12-31T23:59:59.999-05:00')
  )
  const january = workSecondsInDateRange(
    savedSession,
    new Date('2025-01-01T00:00:00-05:00'),
    new Date('2025-01-31T23:59:59.999-05:00')
  )
  assert.equal(december, 1_800)
  assert.equal(january, 1_800)
  assert.equal(december + january, savedSession.work_seconds)
})
