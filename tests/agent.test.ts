import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { test, mock } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '../src/types/supabase.ts'
import { createAgentHandler, validateAgentClaims } from '../supabase/functions/agent/handler.ts'
import {
  AgentError,
  runTool,
  summarizeSessions,
  toolDefinitions,
} from '../supabase/functions/agent/tools.ts'

const userId = '10000000-0000-4000-8000-000000000001'
const taskId = '20000000-0000-4000-8000-000000000001'
const categoryId = '30000000-0000-4000-8000-000000000001'
const config = {
  supabaseUrl: 'https://flowtime-test.supabase.co',
  resourceUrl: 'https://flowtime-test.supabase.co/functions/v1/agent',
  publishableKey: 'sb_publishable_test',
  clientIds: ['approved-client'],
}
const claims = {
  iss: `${config.supabaseUrl}/auth/v1`,
  aud: ['authenticated', config.resourceUrl],
  sub: userId,
  role: 'authenticated',
  is_anonymous: false,
  client_id: 'approved-client',
  exp: Math.floor(Date.now() / 1000) + 300,
}

function database(responses: unknown[]) {
  const total = responses.filter(Array.isArray).reduce((count, rows) => count + rows.length, 0)
  const calls: { url: URL; method: string; body: Record<string, unknown> | null }[] = []
  const db = createClient<Database>(config.supabaseUrl, config.publishableKey, {
    auth: { persistSession: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input))
        if (init?.method === 'POST') {
          assert.equal(JSON.parse(String(init.body)).user_id, userId)
        } else {
          assert.equal(
            url.searchParams.get('user_id'),
            `eq.${userId}`,
            'Every data operation must be owner-scoped'
          )
        }
        calls.push({
          url,
          method: init?.method ?? 'GET',
          body: init?.body ? JSON.parse(String(init.body)) : null,
        })
        assert.ok(responses.length, 'Unexpected database call')
        return Response.json(responses.shift(), { headers: { 'Content-Range': `0-499/${total}` } })
      },
    },
  })
  return { db, calls }
}

test('agent authorization rejects browser, guest, admin, expired, wrong issuer/audience/client tokens', () => {
  assert.equal(validateAgentClaims(claims, config), true)
  for (const patch of [
    { client_id: undefined },
    { client_id: 'other-client' },
    { aud: 'authenticated' },
    { iss: 'https://other.supabase.co/auth/v1' },
    { role: 'service_role' },
    { is_anonymous: true },
    { is_anonymous: undefined },
    { exp: 0 },
    { nbf: Date.now() / 1000 + 9999 },
    { sub: 'not-a-user' },
  ]) {
    assert.equal(validateAgentClaims({ ...claims, ...patch }, config), false, JSON.stringify(patch))
  }
})

test('strict tool schemas reject owner injection, empty edits, oversized input and unbounded pages', () => {
  assert.equal(
    toolDefinitions.create_task.schema.safeParse({ id: taskId, name: '  ' }).success,
    false
  )
  assert.equal(
    toolDefinitions.create_task.schema.safeParse({ id: taskId, name: 'a'.repeat(201) }).success,
    false
  )
  assert.equal(
    toolDefinitions.create_task.schema.safeParse({ id: taskId, name: 'Study', user_id: userId })
      .success,
    false
  )
  assert.equal(toolDefinitions.update_task.schema.safeParse({ id: taskId }).success, false)
  assert.equal(toolDefinitions.list_tasks.schema.safeParse({ limit: 101 }).success, false)
  assert.equal(toolDefinitions.list_tasks.schema.safeParse({ offset: -1 }).success, false)
  assert.equal(
    toolDefinitions.get_focus_summary.schema.safeParse({ from: '2026-10-01', to: '2026-10-02' })
      .success,
    false
  )
})

test('task creation owns the row, appends it and safely reuses the caller UUID', async () => {
  const task = { id: taskId, name: 'Study', category_id: categoryId }
  const { db, calls } = database([null, { id: categoryId }, [{ position: 7 }], task, task])
  const args = { id: taskId, name: ' Study ', category_id: categoryId }
  assert.deepEqual(await runTool(db, userId, 'create_task', args), { task, created: true })
  assert.deepEqual(calls[3].body, {
    id: taskId,
    name: 'Study',
    category_id: categoryId,
    user_id: userId,
    color: null,
    position: 8,
  })
  assert.deepEqual(await runTool(db, userId, 'create_task', args), { task, created: false })
  assert.equal(calls.filter((call) => call.method === 'POST').length, 1)
})

test('foreign/missing categories and conflicting retry payloads do not write', async () => {
  for (const responses of [
    [null, null],
    [{ id: taskId, name: 'Different', category_id: categoryId }],
  ]) {
    const { db, calls } = database(responses)
    await assert.rejects(
      runTool(db, userId, 'create_task', { id: taskId, name: 'Study', category_id: categoryId }),
      AgentError
    )
    assert.ok(calls.every((call) => call.method === 'GET'))
  }
})

test('task completion retries preserve completion time and do not modify history', async () => {
  const task = {
    id: taskId,
    name: 'Study',
    category_id: null,
    completed_at: '2026-10-01T12:00:00Z',
  }
  const { db, calls } = database([task, task])
  await runTool(db, userId, 'update_task', { id: taskId, completed: true })
  assert.deepEqual(calls[1].body, { completed_at: task.completed_at })
  assert.ok(calls.every((call) => call.url.pathname.endsWith('/tasks')))
})

test('list pagination reports continuation and excludes soft-deleted history', async () => {
  const { db, calls } = database([[{ id: 'a' }, { id: 'b' }]])
  assert.deepEqual(
    await runTool(db, userId, 'list_sessions', {
      from: '2026-10-01T00:00:00Z',
      to: '2026-10-02T00:00:00Z',
      limit: 1,
    }),
    { items: [{ id: 'a' }], next_offset: 1 }
  )
  assert.equal(calls[0].url.searchParams.get('deleted_at'), 'is.null')
  assert.equal(calls[0].url.searchParams.get('ended_at'), 'gt.2026-10-01T00:00:00Z')
  assert.equal(calls[0].url.searchParams.get('started_at'), 'lt.2026-10-02T00:00:00Z')
  assert.ok(!calls[0].url.searchParams.get('select')?.includes('notes'))
})

test('summary splits boundary work and retains historical names/categories', () => {
  const session = {
    started_at: '2026-10-01T23:00:00-04:00',
    ended_at: '2026-10-02T01:00:00-04:00',
    work_seconds: 3600,
    task_id_snapshot: taskId,
    task_name_snapshot: 'Original name',
    category_id_snapshot: categoryId,
    category_name_snapshot: 'Original category',
  }
  const result = summarizeSessions(
    [session],
    '2026-10-02T00:00:00-04:00',
    '2026-10-03T00:00:00-04:00'
  )
  assert.equal(result.work_seconds, 1800)
  assert.equal(result.by_task_snapshot[0].task_name, 'Original name')
  assert.equal(result.by_task_snapshot[0].category_name, 'Original category')
  assert.equal(
    summarizeSessions([session], '2026-10-04T00:00:00Z', '2026-10-05T00:00:00Z').work_seconds,
    0
  )
})

test('summary validates ranges and handles a server row cap below the requested page size', async () => {
  const session = {
    started_at: '2026-10-01T00:00:00Z',
    ended_at: '2026-10-01T00:01:00Z',
    work_seconds: 60,
    task_id_snapshot: taskId,
    task_name_snapshot: 'Study',
    category_id_snapshot: null,
    category_name_snapshot: null,
  }
  const { db, calls } = database([Array(100).fill(session), [session]])
  const args = { from: '2026-10-01T00:00:00Z', to: '2026-10-02T00:00:00Z' }
  const result = await runTool(db, userId, 'get_focus_summary', args)
  assert.equal('work_seconds' in result && result.work_seconds, 101 * 60)
  assert.equal(calls.length, 2)
  await assert.rejects(
    runTool(db, userId, 'get_focus_summary', { ...args, to: args.from }),
    AgentError
  )
  await assert.rejects(
    runTool(db, userId, 'get_focus_summary', { ...args, to: '2027-10-01T00:00:00Z' }),
    AgentError
  )
  assert.equal(calls.length, 2)
})

test('MCP and REST verify signed OAuth tokens, expose identical tools and fail closed', async (t) => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'ES256', use: 'sig' }
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = `${encode({ alg: 'ES256', kid: 'test-key', typ: 'JWT' })}.${encode(claims)}`
  const token = `${payload}.${sign('sha256', Buffer.from(payload), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`
  let databaseReads = 0
  const fetchMock = mock.method(globalThis, 'fetch', async (input: string | URL | Request) => {
    const url = new URL(typeof input === 'object' && 'url' in input ? input.url : String(input))
    if (url.pathname.endsWith('/.well-known/jwks.json')) return Response.json({ keys: [jwk] })
    if (url.pathname.endsWith('/user'))
      return Response.json({ id: userId, aud: 'authenticated', is_anonymous: false })
    assert.equal(url.searchParams.get('user_id'), `eq.${userId}`)
    databaseReads++
    return Response.json([], { headers: { 'Content-Range': '*/0' } })
  })
  t.after(() => fetchMock.mock.restore())
  const handler = createAgentHandler(config)
  const request = (path = '', body: unknown = {}, bearer = token) =>
    new Request(config.resourceUrl + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      body: JSON.stringify(body),
    })
  const discovery = await handler(new Request(config.resourceUrl + '/oauth-protected-resource'))
  assert.equal(discovery.status, 200)
  assert.equal((await discovery.json()).resource, config.resourceUrl)
  const gatewayDiscovery = await handler(
    new Request(config.resourceUrl.replace('/functions/v1', '') + '/oauth-protected-resource')
  )
  assert.equal(gatewayDiscovery.status, 200)
  assert.equal((await gatewayDiscovery.json()).resource, config.resourceUrl)
  const missing = await handler(new Request(config.resourceUrl, { method: 'POST' }))
  assert.equal(missing.status, 401)
  assert.match(missing.headers.get('www-authenticate')!, /resource_metadata/)
  assert.equal((await handler(request('', {}, token + 'corrupt'))).status, 401)
  assert.equal(databaseReads, 0)
  const restTools = await handler(
    new Request(config.resourceUrl + '/tools', { headers: { Authorization: `Bearer ${token}` } })
  )
  assert.equal(restTools.status, 200)
  const names = (await restTools.json()).tools.map((tool: { name: string }) => tool.name)
  const mcpTools = await handler(request('', { jsonrpc: '2.0', id: 1, method: 'tools/list' }))
  assert.equal(mcpTools.status, 200)
  assert.deepEqual(
    (await mcpTools.json()).result.tools.map((tool: { name: string }) => tool.name),
    names
  )
  const initialize = await handler(
    request('', {
      jsonrpc: '2.0',
      id: 2,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'test', version: '1' },
      },
    })
  )
  assert.equal((await initialize.json()).result.serverInfo.name, 'flowtime')
  assert.equal((await handler(request('/tools/list_tasks', { user_id: 'other' }))).status, 400)
  assert.equal((await handler(request('/tools/unknown'))).status, 404)
  assert.equal(
    (await handler(request('/tools/list_tasks', { input: 'x'.repeat(17_000) }))).status,
    413
  )
  const response = await handler(request('/tools/list_tasks'))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { items: [], next_offset: null })
  const mcpCall = await handler(
    request('', {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'list_tasks', arguments: {} },
    })
  )
  assert.deepEqual((await mcpCall.json()).result.structuredContent, {
    items: [],
    next_offset: null,
  })
  assert.equal(databaseReads, 2)
  assert.equal((await createAgentHandler({ ...config, clientIds: [] })(request())).status, 503)
})
