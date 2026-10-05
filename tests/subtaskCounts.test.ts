import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

const calls: { method: string; args: unknown[] }[][] = []
let fail = false
const client = {
  from: (table: string) => {
    assert.equal(table, 'subtasks')
    const call: { method: string; args: unknown[] }[] = []
    calls.push(call)
    const query = Object.fromEntries(
      ['select', 'eq', 'is', 'gt', 'order'].map((method) => [
        method,
        (...args: unknown[]) => {
          call.push({ method, args })
          return query
        },
      ])
    )
    query.limit = (size: number) => {
      assert.equal(size, 1000)
      return Promise.resolve({
        error: fail ? new Error('offline') : null,
        data:
          calls.length === 1
            ? Array.from({ length: 1000 }, (_, index) => ({
                id: String(index),
                task_id: 'task-1',
                completed_at: index % 2 ? 'done' : null,
              }))
            : [{ id: '1000', task_id: 'task-2', completed_at: null }],
      })
    }
    return query
  },
}
Object.assign(globalThis, { __subtaskTestClient: client })
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === '@/lib/supabaseClient')
      return {
        url: 'data:text/javascript,export const supabase = globalThis.__subtaskTestClient',
        shortCircuit: true,
      }
    return nextResolve(specifier, context)
  },
})
const { fetchSubtaskCounts } = await import('../src/features/tasks/api/subtaskQueries.ts')
hooks.deregister()

test('batched counts preserve every page, filter the owner and active tasks, and propagate failures', async () => {
  const counts = await fetchSubtaskCounts('user-1')
  assert.deepEqual(counts['task-1'], { total: 1000, completed: 500 })
  assert.deepEqual(counts['task-2'], { total: 1, completed: 0 })
  assert.equal(calls.length, 2)
  for (const call of calls) {
    assert.ok(
      call.some(
        ({ method, args }) => method === 'eq' && args[0] === 'user_id' && args[1] === 'user-1'
      )
    )
    assert.ok(
      call.some(
        ({ method, args }) =>
          method === 'is' && args[0] === 'tasks.completed_at' && args[1] === null
      )
    )
  }
  assert.ok(
    calls[1].some(({ method, args }) => method === 'gt' && args[0] === 'id' && args[1] === '999')
  )
  fail = true
  await assert.rejects(fetchSubtaskCounts('user-1'), /offline/)
})
