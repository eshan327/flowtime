import assert from 'node:assert/strict'
import test from 'node:test'
import { prepareChimeAudio, scheduleDoneChime } from '../src/lib/audio.ts'

class FakeAudioContext extends EventTarget {
  state = 'running'
  currentTime = 10
  destination = {}
  notes: { starts: number[]; stops: number[] }[] = []
  constructor() {
    super()
    contexts.push(this)
  }
  resume() {
    this.state = 'running'
    this.dispatchEvent(new Event('statechange'))
    return Promise.resolve()
  }
  createOscillator() {
    const note = { starts: [] as number[], stops: [] as number[] }
    this.notes.push(note)
    return {
      connect() {},
      disconnect() {},
      frequency: { setValueAtTime() {} },
      start(time: number) {
        note.starts.push(time)
      },
      stop(time = 0) {
        note.stops.push(time)
      },
    }
  }
  createGain() {
    return {
      connect() {},
      disconnect() {},
      gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
    }
  }
}
const contexts: FakeAudioContext[] = []
Object.defineProperty(globalThis, 'window', {
  value: { AudioContext: FakeAudioContext },
  configurable: true,
})

test('the audio clock schedules expiry without waiting for a page tick; cancellation stops pending notes', (t) => {
  t.mock.method(Date, 'now', () => 1000)
  const cancel = scheduleDoneChime(new Date(61000), 'classic-rise')!
  const ctx = contexts.at(-1)!
  assert.equal(ctx.notes.length, 3)
  assert.equal(ctx.notes[0].starts[0], 70)
  cancel()
  assert.ok(ctx.notes.every((note) => note.stops.at(-1) === 0))
  assert.equal(contexts.length, 1)
})

test('expired restored timers stay silent and normal expiry cleanup lets the chime finish', (t) => {
  let now = 1000
  t.mock.method(Date, 'now', () => now)
  const ctx = contexts.at(-1)!
  const count = ctx.notes.length
  assert.equal(scheduleDoneChime(new Date(999), 'classic-rise'), undefined)
  assert.equal(ctx.notes.length, count)
  const cancel = scheduleDoneChime(new Date(2000), 'gentle-bell')!
  const notes = ctx.notes.slice(count)
  now = 2000
  cancel()
  assert.equal(notes.length, 2)
  assert.ok(notes.every((note) => note.stops.length === 1))
})

test('suspended audio re-arms only before the deadline and never chimes on a late return', (t) => {
  let now = 1000
  t.mock.method(Date, 'now', () => now)
  const ctx = contexts.at(-1)!
  const cancel = scheduleDoneChime(new Date(11000), 'classic-rise')!
  const originalNotes = ctx.notes.slice(-3)
  ctx.state = 'suspended'
  ctx.dispatchEvent(new Event('statechange'))
  assert.ok(originalNotes.every((note) => note.stops.at(-1) === 0))
  now = 5000
  prepareChimeAudio()
  assert.equal(ctx.notes.at(-3)!.starts[0], 16)
  ctx.state = 'suspended'
  ctx.dispatchEvent(new Event('statechange'))
  const count = ctx.notes.length
  now = 12000
  prepareChimeAudio()
  assert.equal(ctx.notes.length, count)
  cancel()
})
