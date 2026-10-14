import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

let queued = ['older', 'newer'].map((id) => ({ id, payload: { id } }))
const calls: string[] = []
let offline = true
const mutation = {
  variables: queued[1].payload,
  isError: true,
  mutateAsync: async (payload: { id: string }) => {
    calls.push(payload.id)
    mutation.variables = payload
    mutation.isError = offline
    if (offline) throw new Error('offline')
  },
}
Object.assign(globalThis, {
  __sessionMutation: mutation,
  __sessionOutbox: {
    getQueuedSessions: async () => [...queued],
    removeQueuedSession: async (id: string) => {
      queued = queued.filter((row) => row.id !== id)
    },
    queueSession: async () => true,
  },
})
const mocks = {
  react:
    'export const useCallback=fn=>fn;export const useState=value=>[value,()=>{}];export const useEffect=()=>{};export const createContext=()=>({})',
  '@/features/sessions/hooks/useSessionSave':
    'export const useSessionSave=()=>globalThis.__sessionMutation',
  '@/features/sessions/lib/sessionOutbox':
    'export const {getQueuedSessions,removeQueuedSession,queueSession}=globalThis.__sessionOutbox',
}
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(mocks, specifier))
      return {
        url: 'data:text/javascript,' + encodeURIComponent(mocks[specifier as keyof typeof mocks]),
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
const { useTimerSessionPipeline } =
  await import('../src/features/timer/hooks/useTimerSessionPipeline.ts')
hooks.deregister()

test('a failed retry retains both sessions; reconnect drains them once in order', async () => {
  await useTimerSessionPipeline({ userId: 'user' }).retryLastSessionSave()
  assert.deepEqual(
    queued.map((row) => row.id),
    ['older', 'newer']
  )
  offline = false
  await useTimerSessionPipeline({ userId: 'user' }).retryLastSessionSave()
  assert.deepEqual(calls, ['older', 'older', 'newer'])
  assert.deepEqual(queued, [])
  await useTimerSessionPipeline({ userId: 'user' }).retryLastSessionSave()
  assert.deepEqual(calls, ['older', 'older', 'newer'])
})

test('an unqueued failed save remains retryable', async () => {
  mutation.isError = true
  await useTimerSessionPipeline({ userId: 'user' }).retryLastSessionSave()
  assert.equal(calls.at(-1), 'newer')
  assert.equal(mutation.isError, false)
})
