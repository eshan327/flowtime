import { mock } from 'node:test'
import { calibrateServerClock, serverClock } from '../src/features/timer/lib/serverClock.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  predictTimer,
  readTimerJournal,
  storeTimerCommand,
  type CommandState,
  type TimerCommand,
} from '../src/features/timer/lib/timerCommands.ts'
import { calendarRange, fromZonedInput, zonedInput } from '../src/lib/timezone.ts'
const initial: CommandState = {
  phase: 'idle',
  selectedTaskId: null,
  startedAt: null,
  breakEndAt: null,
  workSeconds: 0,
  breakTotal: 0,
  runawayDetected: false,
}
const task = { selectedTaskId: crypto.randomUUID(), selectedTaskName: 'A' }
const settings = { breakDivisor: 5, focusModeLock: false }
function command(
  action: TimerCommand['action'],
  seconds: number,
  revision: string | null = null
): TimerCommand {
  return {
    action,
    expected_revision: revision,
    next_revision: crypto.randomUUID(),
    occurred_at: new Date(Date.parse('2026-10-01T12:00:00Z') + seconds * 1000).toISOString(),
  }
}

test('offline transitions retain fractional credit, frozen divisor, segment IDs and six-hour cap across switches', () => {
  const start = command('start_work', 0)
  const working = predictTimer(initial, start, task, settings).state
  const change = command('select_task', 62.8, start.next_revision)
  const switched = predictTimer(
    working,
    change,
    { selectedTaskId: crypto.randomUUID(), selectedTaskName: 'B' },
    settings
  )
  assert.equal(switched.segments[0].id, start.next_revision)
  const end = command('stop_work', 126.4, change.next_revision)
  const stopped = predictTimer(switched.state, end, null, { ...settings, breakDivisor: 2 })
  assert.equal(switched.segments[0].work_seconds + stopped.segments[0].work_seconds, 126)
  assert.equal(switched.segments[0].break_seconds + stopped.segments[0].break_seconds, 25)
  assert.equal(stopped.state.breakTotal, 25)
  const cap = predictTimer(switched.state, command('stop_work', 30000), null, settings)
  assert.equal(switched.segments[0].work_seconds + cap.segments[0].work_seconds, 21600)
  assert.equal(cap.state.runawayDetected, true)
  assert.throws(
    () => predictTimer(working, change, task, { ...settings, focusModeLock: true }),
    /Focus lock/
  )
})

test('durable journal retains concurrent branches and replays dependency chains before timestamp ties', () => {
  const values = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      get length() {
        return values.size
      },
      key: (i: number) => [...values.keys()][i] ?? null,
      getItem: (k: string) => values.get(k) ?? null,
      setItem: (k: string, v: string) => values.set(k, v),
      removeItem: (k: string) => values.delete(k),
    },
  })
  const first = command('start_work', 0),
    second = command('stop_work', 60, first.next_revision),
    branch = command('select_task', 1)
  for (const [id, input] of [
    ['z', first],
    ['a', second],
    ['b', branch],
  ] as const)
    storeTimerCommand({
      id,
      userId: 'owner',
      queuedAt: '2026-10-01T00:00:00Z',
      input,
      before: initial,
      after: initial,
      segments: [],
    })
  const entries = readTimerJournal('owner')
  assert.equal(entries.length, 3)
  assert.ok(entries.findIndex((e) => e.id === 'z') < entries.findIndex((e) => e.id === 'a'))
  assert.equal(readTimerJournal('other').length, 0)
})

test('account calendar boundaries and precise local edits handle DST, offsets, milliseconds and nonexistent times', () => {
  const zone = 'America/New_York'
  const spring = calendarRange('day', new Date('2026-03-08T12:00:00Z'), zone)
  assert.equal(spring.to.getTime() - spring.from.getTime(), 23 * 3600000)
  const autumn = calendarRange('day', new Date('2026-11-01T12:00:00Z'), zone)
  assert.equal(autumn.to.getTime() - autumn.from.getTime(), 25 * 3600000)
  assert.throws(() => fromZonedInput('2026-03-08T02:30:00', zone), /does not exist/)
  assert.equal(
    fromZonedInput('2026-10-01T09:30:00.123', zone).toISOString(),
    '2026-10-01T13:30:00.123Z'
  )
  assert.equal(zonedInput('2026-10-01T13:30:00Z', zone), '2026-10-01T09:30:00')
})

test('server-calibrated clocks detect wall-clock jumps and sleep before automatic replay', (t) => {
  let wall = 100000,
    mono = 1000
  const wallMock = mock.method(Date, 'now', () => wall),
    monoMock = mock.method(performance, 'now', () => mono)
  t.after(() => {
    wallMock.mock.restore()
    monoMock.mock.restore()
  })
  calibrateServerClock('2026-10-01T12:00:00Z')
  const initial = serverClock().now
  wall += 1000
  mono += 1000
  assert.equal(serverClock().now, initial + 1000)
  assert.equal(serverClock().uncertain, false)
  wall -= 3600000
  mono += 1000
  assert.equal(serverClock().now, initial + 2000)
  assert.equal(serverClock().uncertain, true)
  calibrateServerClock('2026-10-01T12:00:02Z')
  wall += 3600000
  assert.equal(serverClock().uncertain, true)
})
