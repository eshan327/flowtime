import assert from 'node:assert/strict'
import test from 'node:test'
import { startVisiblePolling } from '../src/lib/visiblePolling.ts'

test('polling stops while hidden or offline, refreshes on return, and cleans up its listeners', () => {
  const intervals = new Map<number, () => void>()
  let id = 0
  const window = Object.assign(new EventTarget(), {
    setInterval: (callback: () => void, delay: number) => {
      assert.equal(delay, 15_000)
      intervals.set(++id, callback)
      return id
    },
    clearInterval: (key: number) => intervals.delete(key),
  })
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  const navigator = { onLine: true }
  Object.assign(globalThis, { window, document })
  Object.defineProperty(globalThis, 'navigator', { value: navigator, configurable: true })
  let reads = 0
  const stop = startVisiblePolling(() => reads++, 15_000)
  assert.equal(reads, 1)
  assert.equal(intervals.size, 1)
  intervals.values().next().value!()
  assert.equal(reads, 2)
  document.visibilityState = 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(intervals.size, 0)
  window.dispatchEvent(new Event('focus'))
  assert.equal(reads, 2)
  document.visibilityState = 'visible'
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(reads, 3)
  navigator.onLine = false
  window.dispatchEvent(new Event('offline'))
  assert.equal(intervals.size, 0)
  window.dispatchEvent(new Event('pageshow'))
  assert.equal(reads, 3)
  navigator.onLine = true
  window.dispatchEvent(new Event('online'))
  assert.equal(reads, 4)
  assert.equal(intervals.size, 1)
  window.dispatchEvent(new Event('pageshow'))
  assert.equal(reads, 5)
  assert.equal(intervals.size, 1)
  stop()
  assert.equal(intervals.size, 0)
  window.dispatchEvent(new Event('focus'))
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(reads, 5)
})
