import assert from 'node:assert/strict'
import test from 'node:test'
import { getQueuedSessionCount } from '../src/features/sessions/lib/sessionOutbox.ts'

test('outbox badge counts through the user index without loading payloads and closes on errors', async () => {
  assert.equal(await getQueuedSessionCount('user-1'), 0)
  let closed = 0
  let fail = false
  const database = {
    close: () => closed++,
    transaction: (store: string, mode: string) => {
      assert.equal(store, 'pending-sessions')
      assert.equal(mode, 'readonly')
      return {
        objectStore: () => ({
          index: (name: string) => {
            assert.equal(name, 'user-id')
            return {
              count: (userId: string) => {
                assert.equal(userId, 'user-1')
                const request = Object.assign(new EventTarget(), {
                  result: 10000,
                  error: new Error('unavailable'),
                })
                queueMicrotask(() => request.dispatchEvent(new Event(fail ? 'error' : 'success')))
                return request
              },
              getAll: () => {
                throw new Error('Badge must not deserialize session payloads')
              },
            }
          },
        }),
      }
    },
  }
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    value: {
      open: () => {
        const request = Object.assign(new EventTarget(), { result: database })
        queueMicrotask(() => request.dispatchEvent(new Event('success')))
        return request
      },
    },
  })
  try {
    assert.equal(await getQueuedSessionCount('user-1'), 10000)
    assert.equal(closed, 1)
    fail = true
    await assert.rejects(getQueuedSessionCount('user-1'), /unavailable/)
    assert.equal(closed, 2)
  } finally {
    Reflect.deleteProperty(globalThis, 'indexedDB')
  }
})
