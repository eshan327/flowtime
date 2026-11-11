import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

let now = 1_000_000
let state: any
let chimeEnabled = true
const effects: (() => void | (() => void))[] = []
const commands: unknown[][] = []
const intervals = new Map<number, () => void>()
const deadlines = new Map<number, { callback: () => void; delay: number }>()
let id = 0
const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
const window = Object.assign(new EventTarget(), {
  setInterval: (callback: () => void) => {
    intervals.set(++id, callback)
    return id
  },
  clearInterval: (key: number) => intervals.delete(key),
  setTimeout: (callback: () => void, delay: number) => {
    deadlines.set(++id, { callback, delay })
    return id
  },
  clearTimeout: (key: number) => deadlines.delete(key),
})
const store = Object.assign((select: (state: any) => unknown) => select(state), {
  getState: () => state,
})
Object.assign(globalThis, {
  window,
  document,
  powerTest: {
    effects,
    store,
    now: () => now,
    settings: (select: (s: any) => unknown) => select({ chimeEnabled, chimeId: 'classic-rise' }),
    send: (...args: unknown[]) => {
      commands.push(args)
    },
  },
})
const mocks: Record<string, string> = {
  react: 'export const useEffect = callback => globalThis.powerTest.effects.push(callback)',
  '@/features/timer/stores/timerStore':
    'export const MAX_SESSION_SECONDS = 21600; export const useTimerStore = globalThis.powerTest.store',
  '@/features/timer/stores/timerSettingsStore':
    'export const useTimerSettingsStore = globalThis.powerTest.settings',
  '@/features/timer/lib/serverClock':
    'export const timerNow = globalThis.powerTest.now; export const serverClock = () => ({uncertain:false})',
  '@/lib/audio':
    'export const prepareChimeAudio = () => {}; export const scheduleDoneChime = () => {}',
  './useTimerSync': 'export const sendTimerCommand = globalThis.powerTest.send',
}
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    return mocks[specifier]
      ? { url: 'data:text/javascript,' + encodeURIComponent(mocks[specifier]), shortCircuit: true }
      : nextResolve(specifier, context)
  },
})
const { useTimer } = await import('../src/features/timer/hooks/useTimer.ts')
hooks.deregister()

function mount(phase: string, showClock = true) {
  effects.length = 0
  commands.length = 0
  document.visibilityState = 'visible'
  state = {
    phase,
    startedAt: new Date(now - 5000),
    breakEndAt: new Date(now + 10_000),
    syncRevision: 'observed',
    workSeconds: 0,
    setWorkSeconds: (seconds: number) => {
      state.workSeconds = seconds
    },
  }
  useTimer(true, showClock)
  const cleanups = effects.map((effect) => effect())
  return () => {
    cleanups.forEach((cleanup) => cleanup?.())
    assert.equal(intervals.size, 0)
    assert.equal(deadlines.size, 0)
  }
}

test('work ticks stop while hidden and catch up from timestamps on return', () => {
  const cleanup = mount('working')
  try {
    assert.equal(state.workSeconds, 5)
    assert.equal(intervals.size, 1)
    document.visibilityState = 'hidden'
    document.dispatchEvent(new Event('visibilitychange'))
    assert.equal(intervals.size, 0)
    assert.equal(deadlines.size, 1)
    now += 60_000
    document.visibilityState = 'visible'
    window.dispatchEvent(new Event('pageshow'))
    assert.equal(state.workSeconds, 65)
    assert.equal(intervals.size, 1)
  } finally {
    cleanup()
  }
})

test('break expiry and the six-hour cap keep one deadline without recurring background ticks', () => {
  for (const phase of ['working', 'breaking']) {
    const cleanup = mount(phase, false)
    try {
      assert.equal(intervals.size, 0)
      assert.equal(deadlines.size, 1)
      const deadline = deadlines.values().next().value!
      now += deadline.delay
      deadline.callback()
      assert.deepEqual(commands, [
        [phase === 'working' ? 'stop_work' : 'finish_break', undefined, 'observed'],
      ])
    } finally {
      cleanup()
    }
  }
})

test('idle timers register no repeating timers or deadlines, and muted chimes have no gesture listeners', (t) => {
  const addListener = t.mock.method(document, 'addEventListener')
  chimeEnabled = false
  const cleanup = mount('idle')
  try {
    assert.equal(intervals.size, 0)
    assert.equal(deadlines.size, 0)
    assert.equal(addListener.mock.calls.length, 0)
  } finally {
    cleanup()
    chimeEnabled = true
  }
})
