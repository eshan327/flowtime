import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'

const queries: any[] = []
const calls: any[] = []
const connection = { visible: true, online: true }
Object.assign(globalThis, {
  statsTest: {
    connection,
    query: (options: any) => {
      queries.push(options)
      return { data: undefined, isLoading: true }
    },
    read: async (operation: string, input: unknown) => {
      calls.push({ operation, input })
      return {
        session_count: 12,
        work_seconds: 3600,
        by_task_snapshot: [],
        by_category_snapshot: [],
        by_day: [],
        by_hour: [],
        next_cursor: null,
      }
    },
  },
})
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks: Record<string, string> = {
      react:
        'export const useMemo = fn => fn(); export const useSyncExternalStore = (subscribe, getSnapshot) => getSnapshot()',
      '@tanstack/react-query':
        'export const useQuery = globalThis.statsTest.query; export const keepPreviousData = value => value; export const focusManager = {subscribe:()=>()=>{},isFocused:()=>globalThis.statsTest.connection.visible}; export const onlineManager = {subscribe:()=>()=>{},isOnline:()=>globalThis.statsTest.connection.online}',
      '@/context/UserContext': 'export const useUser = () => ({ user: { id: "owner" } })',
      '@/features/timer/stores/timerSettingsStore':
        'export const useTimerSettingsStore = fn => fn({timezone:"America/New_York"})',
      '@/lib/flowtimeApi': 'export const readFlowtime = globalThis.statsTest.read',
      './flowtimeApi': 'export const readFlowtime = globalThis.statsTest.read',
    }
    if (mocks[specifier]) return { url: moduleUrl(mocks[specifier]), shortCircuit: true }
    if (specifier.startsWith('./') && !specifier.endsWith('.ts'))
      return nextResolve(specifier + '.ts', context)
    return nextResolve(
      specifier.startsWith('@/')
        ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href
        : specifier,
      context
    )
  },
})
const { useStats } = await import('../src/features/stats/hooks/useStats.ts')
const { useTodaySummary } = await import('../src/features/timer/hooks/useTodaySummary.ts')
hooks.deregister()

test('Insights loads only summaries and timer totals request just one page', async () => {
  useStats('week', new Date('2026-11-06T12:00:00Z'))
  await queries.pop().queryFn()
  assert.equal(calls.length, 2)
  assert.ok(calls.every((call) => call.operation === 'summary'))
  calls.length = 0
  useTodaySummary()
  assert.deepEqual(await queries.pop().queryFn(), { count: 12, totalWorkSeconds: 3600 })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].input.limit, 1)
})

test('summary polling is infrequent in front and registers no interval while hidden or offline', () => {
  for (const hook of [() => useStats('week', new Date()), useTodaySummary]) {
    hook()
    assert.equal(queries.pop().refetchInterval, 60_000)
    connection.visible = false
    hook()
    assert.equal(queries.pop().refetchInterval, false)
    connection.visible = true
    connection.online = false
    hook()
    assert.equal(queries.pop().refetchInterval, false)
    connection.online = true
  }
})
