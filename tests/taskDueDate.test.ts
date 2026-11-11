import assert from 'node:assert/strict'
import test from 'node:test'
import { formatTaskDueDate } from '../src/features/tasks/lib/dueDate.ts'

test('task deadlines distinguish overdue, today, tomorrow and future calendar dates', () => {
  const now = new Date(2026, 10, 11, 23, 59)
  assert.equal(formatTaskDueDate('2026-11-10', now).isOverdue, true)
  assert.match(formatTaskDueDate('2026-11-10', now).label, /^Overdue · /)
  assert.equal(formatTaskDueDate('2026-11-11', now).label, 'Due today')
  assert.equal(formatTaskDueDate('2026-11-11', now).isOverdue, false)
  assert.equal(formatTaskDueDate('2026-11-12', now).label, 'Due tomorrow')
  assert.match(formatTaskDueDate('2026-11-20', now).label, /^Due /)
  assert.match(formatTaskDueDate('2027-01-01', now).label, /2027/)
})

test('calendar dates stay local across UTC offsets, daylight saving and year boundaries', () => {
  const previousZone = process.env.TZ
  try {
    for (const zone of ['America/New_York', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = zone
      assert.equal(formatTaskDueDate('2026-11-11', new Date(2026, 10, 11, 0, 1)).label, 'Due today')
      assert.equal(
        formatTaskDueDate('2026-03-09', new Date(2026, 2, 8, 0, 1)).label,
        'Due tomorrow'
      )
      assert.equal(
        formatTaskDueDate('2026-11-02', new Date(2026, 10, 1, 0, 1)).label,
        'Due tomorrow'
      )
      assert.equal(
        formatTaskDueDate('2027-01-01', new Date(2026, 11, 31, 12)).label,
        'Due tomorrow'
      )
      assert.equal(formatTaskDueDate('2028-02-29', new Date(2028, 1, 28, 12)).label, 'Due tomorrow')
    }
  } finally {
    if (previousZone === undefined) delete process.env.TZ
    else process.env.TZ = previousZone
  }
})
