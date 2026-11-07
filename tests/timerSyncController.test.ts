import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import test from 'node:test'
import { withRequestTimeout } from '../src/lib/requestTimeout.ts'

const values = new Map<string, string>()
const storage = {
  get length() {
    return values.size
  },
  key: (i: number) => [...values.keys()][i] ?? null,
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => {
    values.set(key, value)
  },
  removeItem: (key: string) => {
    values.delete(key)
  },
}
let effect: () => () => void
let remote: any
let readGate: Promise<void> | undefined
let settingsGate: Promise<void> | undefined
let failure: unknown
let status: any
let reads = 0
const commands: any[] = []
const invalidations: unknown[] = []
const taskId = crypto.randomUUID()
const userId = crypto.randomUUID()
Object.assign(globalThis, {
  localStorage: storage,
  window: {
    localStorage: storage,
    setInterval: () => 1,
    clearInterval() {},
    addEventListener() {},
    removeEventListener() {},
  },
  document: { visibilityState: 'visible', addEventListener() {}, removeEventListener() {} },
  timerTest: {
    settings: {
      from() {
        return this
      },
      select() {
        return this
      },
      eq() {
        return this
      },
      abortSignal() {
        return this
      },
      async maybeSingle() {
        await settingsGate
        return { data: null, error: null }
      },
    },
    effect: (callback: typeof effect) => {
      effect = callback
    },
    setStatus: (update: any) => {
      status = typeof update === 'function' ? update(status) : update
    },
    read: () =>
      withRequestTimeout(async () => {
        reads++
        await readGate
        return structuredClone(remote)
      }),
    command: async (_operation: string, input: any, id: string) => {
      commands.push({ input, id })
      if (failure) throw failure
      assert.equal(input.expected_revision, remote.revision)
      const predicted = predictTimer(
        remote.state,
        input,
        { selectedTaskId: taskId, selectedTaskName: 'Task' },
        { breakDivisor: 5, focusModeLock: false }
      )
      remote = {
        state: predicted.state,
        revision: input.next_revision,
        server_time: input.occurred_at,
      }
      return structuredClone(remote)
    },
    queryClient: {
      getQueryData: () => [{ id: taskId, name: 'Task', category_id: null, color: null }],
      invalidateQueries: async (input: unknown) => {
        invalidations.push(input)
      },
    },
  },
})
const moduleUrl = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      (context.parentURL?.endsWith('/hooks/useTimerSync.ts') ||
        context.parentURL?.endsWith('/hooks/useTimerSettingsSync.ts')) &&
      specifier === 'react'
    )
      return {
        url: moduleUrl(
          'export const useEffect = globalThis.timerTest.effect; export const useState = value => [value, globalThis.timerTest.setStatus]'
        ),
        shortCircuit: true,
      }
    if (specifier === '@/lib/flowtimeApi')
      return {
        url: moduleUrl(
          'export const readFlowtime = globalThis.timerTest.read; export const commandFlowtime = globalThis.timerTest.command'
        ),
        shortCircuit: true,
      }
    if (specifier === '@/lib/supabaseClient')
      return {
        url: moduleUrl('export const supabase = globalThis.timerTest.settings'),
        shortCircuit: true,
      }
    if (specifier === '@/lib/queryClient')
      return {
        url: moduleUrl('export const queryClient = globalThis.timerTest.queryClient'),
        shortCircuit: true,
      }
    return nextResolve(
      specifier.startsWith('@/')
        ? new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href
        : specifier,
      context
    )
  },
})
const { useTimerSync, retryTimerCommands, sendTimerCommand, useTimerCommandStatus } =
  await import('../src/features/timer/hooks/useTimerSync.ts')
const { useTimerStore, createInitialTimerState } =
  await import('../src/features/timer/stores/timerStore.ts')
const { predictTimer, readTimerJournal } =
  await import('../src/features/timer/lib/timerCommands.ts')
const { useTimerSettingsSync } = await import('../src/features/timer/hooks/useTimerSettingsSync.ts')
hooks.deregister()

function mount() {
  values.clear()
  commands.length = 0
  invalidations.length = 0
  failure = undefined
  status = { ready: false, error: null }
  reads = 0
  readGate = undefined
  useTimerStore.setState(createInitialTimerState())
  useTimerCommandStatus.setState({ pending: 0, conflicts: [], error: null })
  remote = {
    state: { ...createInitialTimerState(), selectedTaskId: taskId },
    revision: crypto.randomUUID(),
    server_time: new Date().toISOString(),
  }
  useTimerSync(userId)
  return effect!()
}

test('actual controller accepts start/stop during polling and refreshes a ChatGPT revision before sending', async () => {
  const cleanup = mount()
  try {
    await retryTimerCommands()
    let release!: () => void
    readGate = new Promise<void>((resolve) => {
      release = resolve
    })
    const polling = retryTimerCommands()
    const start = sendTimerCommand('start_work')
    await Promise.resolve()
    assert.equal(commands.length, 0)
    remote.revision = crypto.randomUUID()
    const chatRevision = remote.revision
    release()
    await Promise.all([polling, start])
    assert.equal(useTimerCommandStatus.getState().error, null)
    assert.equal(commands[0].input.expected_revision, chatRevision)
    assert.equal(useTimerStore.getState().phase, 'working')
    await sendTimerCommand('stop_work')
    assert.notEqual(useTimerStore.getState().phase, 'working')
    assert.equal(useTimerCommandStatus.getState().error, null)
    assert.equal(readTimerJournal(userId).length, 0)
    assert.ok(invalidations.length > 0)
  } finally {
    cleanup()
  }
})

test('temporary API errors keep the same request retryable while real conflicts preserve local work', async () => {
  const cleanup = mount()
  try {
    await retryTimerCommands()
    failure = { code: 'PGRST002', message: 'Temporary service failure' }
    await sendTimerCommand('start_work')
    const pending = readTimerJournal(userId)
    assert.equal(pending.length, 1)
    assert.equal(pending[0].conflict, undefined)
    failure = undefined
    await retryTimerCommands()
    assert.equal(useTimerCommandStatus.getState().error, null)
    assert.equal(commands.length, 2, JSON.stringify(readTimerJournal(userId)))
    assert.equal(commands[0].id, commands[1].id)
    assert.deepEqual(commands[0].input, commands[1].input)
    assert.equal(readTimerJournal(userId).length, 0)
    failure = { code: '40001', message: 'Timer changed on another device.' }
    await sendTimerCommand('stop_work')
    assert.equal(readTimerJournal(userId)[0].conflict, 'Timer changed on another device.')
    assert.equal(useTimerStore.getState().phase, 'working')
  } finally {
    cleanup()
  }
})

test('cleanup cancels clicks waiting behind a poll', async () => {
  const cleanup = mount()
  await retryTimerCommands()
  let release!: () => void
  readGate = new Promise<void>((resolve) => {
    release = resolve
  })
  const polling = retryTimerCommands()
  const action = sendTimerCommand('start_work')
  cleanup()
  release()
  await Promise.all([polling, action])
  assert.equal(commands.length, 0)
  assert.equal(readTimerJournal(userId).length, 0)
})

test('a queued automatic expiry cannot change a newer remote timer', async () => {
  const cleanup = mount()
  try {
    await retryTimerCommands()
    const observed = remote.revision
    remote.revision = crypto.randomUUID()
    await sendTimerCommand('finish_break', undefined, observed)
    assert.equal(commands.length, 0)
    assert.equal(useTimerStore.getState().syncRevision, remote.revision)
    assert.equal(useTimerCommandStatus.getState().error, null)
  } finally {
    cleanup()
  }
})

test('a hung initial mobile read leaves loading, then retry restores the server timer', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const cleanup = mount()
  readGate = new Promise<void>(() => {})
  try {
    const sync = retryTimerCommands()
    for (let i = 0; i < 6; i++) await Promise.resolve()
    t.mock.timers.tick(15000)
    await sync
    assert.equal(status.ready, false)
    assert.match(status.error.message, /Connection timed out/)
    readGate = undefined
    await retryTimerCommands()
    assert.equal(status.ready, true)
    assert.equal(status.error, null)
    assert.equal(useTimerStore.getState().syncRevision, remote.revision)
  } finally {
    cleanup()
  }
})

test('unchanged polls preserve timer object identities and clicks avoid a redundant final read', async () => {
  const cleanup = mount()
  try {
    await retryTimerCommands()
    await sendTimerCommand('start_work')
    const before = useTimerStore.getState()
    await retryTimerCommands()
    assert.equal(useTimerStore.getState(), before)
    const count = reads
    await sendTimerCommand('stop_work')
    assert.equal(reads - count, 1)
  } finally {
    cleanup()
  }
})

test('a stalled settings request reports an error and releases startup readiness', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  status = { ready: false, error: null }
  settingsGate = new Promise<void>(() => {})
  useTimerSettingsSync(userId)
  const cleanup = effect!()
  try {
    for (let i = 0; i < 6; i++) await Promise.resolve()
    t.mock.timers.tick(15000)
    for (let i = 0; i < 12; i++) await Promise.resolve()
    assert.equal(status.ready, true)
    assert.match(status.error.message, /Connection timed out/)
  } finally {
    cleanup()
    settingsGate = undefined
  }
})
