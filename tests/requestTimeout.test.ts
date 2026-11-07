import assert from 'node:assert/strict'
import test from 'node:test'
import { withRequestTimeout } from '../src/lib/requestTimeout.ts'

test('a suspended request times out, aborts, and cannot replace the result when it finishes late', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal!: AbortSignal
  let finish!: (value: string) => void
  const pending = withRequestTimeout((s) => {
    signal = s
    return new Promise<string>((resolve) => {
      finish = resolve
    })
  })
  const rejected = assert.rejects(pending, /Connection timed out/)
  await Promise.resolve()
  t.mock.timers.tick(15000)
  await rejected
  assert.equal(signal.aborted, true)
  finish('stale response')
  assert.equal(await withRequestTimeout(async () => 'reconnected'), 'reconnected')
})

test('successful requests clear their deadline and preserve errors without retrying writes', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal!: AbortSignal
  assert.equal(
    await withRequestTimeout(async (s) => {
      signal = s
      return 42
    }),
    42
  )
  t.mock.timers.tick(15000)
  assert.equal(signal.aborted, false)
  const conflict = { code: '40001', message: 'Changed elsewhere' }
  let calls = 0
  await assert.rejects(
    withRequestTimeout(async () => {
      calls++
      throw conflict
    }),
    (error) => error === conflict
  )
  assert.equal(calls, 1)
})
