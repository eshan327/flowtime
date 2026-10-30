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
        assert.match(url.pathname, /\/rpc\/flowtime_(read|command)$/)
        const payload = JSON.parse(String(init?.body))
        assert.equal(
          'user_id' in payload,
          false,
          'Ownership comes from the authenticated database context'
        )
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

test('legacy tools preserve names while shared RPCs carry stable command IDs and no caller-selected owner', async () => {
  const task = { id: taskId, name: 'Study', category_id: categoryId }
  const { db, calls } = database([
    { items: [task] },
    { items: [task] },
    { items: [], next_offset: null },
  ])
  assert.deepEqual(
    await runTool(db, userId, 'create_task', {
      id: taskId,
      name: ' Study ',
      category_id: categoryId,
    }),
    { task, created: true }
  )
  assert.equal(calls[0].body?.request_id, taskId)
  assert.equal(calls[0].body?.operation, 'legacy_tasks')
  const request_id = crypto.randomUUID()
  await runTool(db, userId, 'update_task', { id: taskId, request_id, completed: true })
  assert.equal(calls[1].body?.request_id, request_id)
  assert.equal(calls[1].body?.operation, 'legacy_tasks')
  await runTool(db, userId, 'list_sessions', {})
  assert.equal(calls[2].body?.operation, 'sessions')
  assert.equal(Object.keys(toolDefinitions).length, 14)
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

test('expanded schemas reject injected owners, invented actions, unsafe URLs and unbounded batches', () => {
  assert.equal(
    toolDefinitions.manage_tasks.schema.safeParse({
      request_id: taskId,
      operations: [{ action: 'delete_permanently', id: taskId }],
    }).success,
    false
  )
  assert.equal(
    toolDefinitions.create_task.schema.safeParse({
      id: taskId,
      name: 'Study',
      reference_url: 'javascript:alert(1)',
    }).success,
    false
  )
  assert.equal(
    toolDefinitions.control_timer.schema.safeParse({
      request_id: taskId,
      expected_revision: null,
      action: 'pause',
    }).success,
    false
  )
  assert.equal(
    toolDefinitions.manage_categories.schema.safeParse({
      request_id: taskId,
      operations: Array.from({ length: 51 }, () => ({ action: 'trash', id: categoryId })),
    }).success,
    false
  )
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
    assert.match(url.pathname, /\/rpc\/flowtime_read$/)
    databaseReads++
    return Response.json({ items: [], next_offset: null })
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

test('timer tool retains snapshot breakSeconds while returning authoritative state/revision', async () => {
  const result = {
    snapshot: { phase: 'breaking', workSeconds: 3600, breakSeconds: 720 },
    state: { phase: 'breaking', breakTotal: 720 },
    revision: taskId,
  }
  const { db } = database([result])
  assert.deepEqual(await runTool(db, userId, 'get_timer', {}), result)
})
