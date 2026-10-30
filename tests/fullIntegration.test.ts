import { setup, owner, other, client } from './helpers/flowtimeDatabase.ts'
import assert from 'node:assert/strict'
import { test } from 'node:test'

test('expanded operations enforce consent, client/audience ownership, revocation and no direct RPC-helper access', async (t) => {
  const { db, claims, command, read } = await setup()
  t.after(() => db.close())
  const id = crypto.randomUUID()
  await command('tasks', { operations: [{ action: 'create', id, name: 'Mine' }] })
  await claims(other)
  await assert.rejects(
    command('tasks', { operations: [{ action: 'update', id, name: 'Stolen' }] }),
    /not found/
  )
  await claims(owner, true)
  assert.equal((await read('tasks')).items.length, 1)
  await assert.rejects(
    command('tasks', { operations: [{ action: 'update', id, name: 'No consent' }] }),
    /Approve expanded/
  )
  await assert.rejects(db.query('select public.flowtime_access($1,true)', [client]), /browser/)
  await assert.rejects(db.exec('select * from private.flowtime_commands'), /permission denied/)
  await assert.rejects(
    db.query('select private.flowtime_task($1,$2)', [owner, id]),
    /permission denied/
  )
  await claims()
  await db.query('select public.flowtime_access($1,true)', [client])
  await claims(owner, true)
  await command('tasks', { operations: [{ action: 'update', id, name: 'Allowed' }] })
  await assert.rejects(
    db.query('update tasks set notes=$1 where id=$2', ['Bypass', id]),
    /expanded-control/
  )
  await assert.rejects(
    command('legacy_tasks', { operations: [{ action: 'update', id, notes: 'Bypass' }] }),
    /Unknown/
  )
  assert.equal(
    (await db.query('update user_settings set break_divisor=1 returning user_id')).rows.length,
    0
  )
  await claims(owner, true, { aud: 'authenticated' })
  await assert.rejects(read('tasks'), /Untrusted/)
  await claims(owner, true, { client_id: crypto.randomUUID() })
  await assert.rejects(read('tasks'), /Untrusted/)
  await claims()
  await db.query('select public.flowtime_access($1,false)', [client])
  await claims(owner, true)
  await assert.rejects(
    command('tasks', { operations: [{ action: 'update', id, name: 'Revoked' }] }),
    /Approve expanded/
  )
})

test('trash retains identities, category membership, archive/completion states, ordering and individual trash; batches roll back', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const cat = crypto.randomUUID(),
    a = crypto.randomUUID(),
    b = crypto.randomUUID()
  await command('categories', {
    operations: [{ action: 'create', id: cat, name: 'Course', color: '#abcdef' }],
  })
  await command('tasks', {
    operations: [
      { action: 'create', id: a, name: 'A', category_id: cat },
      {
        action: 'create',
        id: b,
        name: 'B',
        category_id: cat,
        completed: true,
        notes: 'Context',
        priority: 'high',
        due_date: '2026-11-01',
        reference_url: 'https://example.com',
      },
    ],
  })
  const before = (await read('tasks', { status: 'all' })).items
  await command('tasks', { operations: [{ action: 'trash', id: a }] })
  await command('categories', {
    operations: [
      { action: 'update', id: cat, archived: true },
      { action: 'trash', id: cat },
    ],
  })
  assert.equal((await read('tasks', { status: 'all' })).items.length, 0)
  assert.equal((await read('tasks', { status: 'all', trash: 'only' })).items.length, 2)
  await command('categories', { operations: [{ action: 'restore', id: cat }] })
  let after = (await read('tasks', { status: 'all' })).items
  assert.equal(after.length, 1)
  assert.equal(after[0].id, b)
  assert.equal(after[0].completed_at, before[1].completed_at)
  assert.ok(after[0].categories.archived_at)
  await command('tasks', { operations: [{ action: 'restore', id: a }] })
  after = (await read('tasks', { status: 'all' })).items
  assert.deepEqual(
    after.map((x: any) => [x.id, x.position, x.category_id]),
    before.map((x: any) => [x.id, x.position, x.category_id])
  )
  await assert.rejects(
    command('tasks', {
      operations: [
        { action: 'update', id: a, name: 'Should rollback' },
        { action: 'update', id: crypto.randomUUID(), name: 'Missing' },
      ],
    }),
    /not found/
  )
  assert.equal((await read('tasks', { ids: [a], status: 'all' })).items[0].name, 'A')
  await db.query('delete from tasks where id=$1', [a])
  assert.equal((await read('tasks', { ids: [a], status: 'all', trash: 'only' })).items.length, 1)
})

test('timer switching is atomic, keeps continuous earned breaks, retries exactly and rejects stale devices and legacy writes', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const a = crypto.randomUUID(),
    b = crypto.randomUUID()
  await command('tasks', {
    operations: [
      { action: 'create', id: a, name: 'A' },
      { action: 'create', id: b, name: 'B' },
    ],
  })
  await command('settings', {
    expected_revision: null,
    timezone: 'America/New_York',
    focus_mode_lock: false,
  })
  const origin = Date.now() - 3600000
  const time = (seconds: number) => new Date(origin + seconds * 1000).toISOString()
  const start = {
    action: 'start_work',
    task_id: a,
    expected_revision: null,
    next_revision: crypto.randomUUID(),
    occurred_at: time(0),
  }
  const request = crypto.randomUUID()
  const first = await command('timer', start, request)
  assert.deepEqual(await command('timer', start, request), first)
  await assert.rejects(command('timer', { ...start, task_id: b }, request), /different arguments/)
  const switched = await command('timer', {
    action: 'select_task',
    task_id: b,
    expected_revision: first.revision,
    occurred_at: time(62),
  })
  assert.equal((await read('sessions')).items[0].work_seconds, 62)
  await assert.rejects(
    command('timer', { action: 'stop_work', expected_revision: first.revision }),
    /another device/
  )
  const stop = { action: 'stop_work', expected_revision: switched.revision, occurred_at: time(126) }
  const stopId = crypto.randomUUID()
  const stopped = await command('timer', stop, stopId)
  assert.equal(stopped.state.breakTotal, 25)
  assert.deepEqual(await command('timer', stop, stopId), stopped)
  const sessions = (await read('sessions')).items
  assert.equal(sessions.length, 2)
  assert.equal(
    sessions.reduce((s: number, x: any) => s + x.work_seconds, 0),
    126
  )
  assert.equal(
    sessions.reduce((s: number, x: any) => s + x.break_seconds, 0),
    25
  )
  assert.equal(new Set(sessions.map((x: any) => x.run_id)).size, 1)
  await assert.rejects(
    db.query('update active_timers set state=$1 where user_id=$2', [
      JSON.stringify(first.state),
      owner,
    ]),
    /Update required/
  )
  await assert.rejects(
    db.query('update sessions set notes=$1 where id=$2', ['Legacy edit', sessions[0].id]),
    /Update required/
  )
})

test('focus lock, missing tasks, atomic failure, six-hour cap and stale settings are enforced centrally', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const a = crypto.randomUUID(),
    b = crypto.randomUUID()
  await command('tasks', {
    operations: [
      { action: 'create', id: a, name: 'A' },
      { action: 'create', id: b, name: 'B' },
    ],
  })
  const settings = await command('settings', {
    expected_revision: null,
    timezone: 'America/New_York',
  })
  await assert.rejects(
    command('settings', { expected_revision: null, break_divisor: 1 }),
    /Settings changed/
  )
  await assert.rejects(
    command('settings', { expected_revision: settings.revision, timezone: 'Invalid/Zone' }),
    /IANA/
  )
  const now = Date.now() - 7 * 3600000
  let timer = await command('timer', {
    action: 'start_work',
    task_id: a,
    expected_revision: null,
    occurred_at: new Date(now).toISOString(),
  })
  await assert.rejects(
    command('timer', {
      action: 'select_task',
      task_id: b,
      expected_revision: timer.revision,
      occurred_at: new Date(now + 60000).toISOString(),
    }),
    /Focus lock/
  )
  assert.equal((await read('sessions')).items.length, 0)
  timer = await command('timer', { action: 'stop_work', expected_revision: timer.revision })
  assert.equal(timer.state.workSeconds, 21600)
  assert.equal(timer.state.runawayDetected, true)
  assert.equal((await read('sessions')).items[0].work_seconds, 21600)
})

test('history corrections preserve snapshots; manual validation, complete summaries, DST allocation and pagination mutation detection', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const task = crypto.randomUUID(),
    session = crypto.randomUUID()
  await command('tasks', { operations: [{ action: 'create', id: task, name: 'Original' }] })
  const create = {
    action: 'create',
    id: session,
    task_id: task,
    started_at: '2026-03-08T01:30:00-05:00',
    ended_at: '2026-03-08T04:30:00-04:00',
    work_seconds: 7200,
    notes: 'Manual evidence',
  }
  await command('sessions', { operations: [create] })
  await command('tasks', { operations: [{ action: 'update', id: task, name: 'Renamed' }] })
  await command('sessions', {
    operations: [{ action: 'update', id: session, notes: 'Correction' }],
  })
  assert.equal((await read('session', { id: session })).task_name_snapshot, 'Original')
  assert.equal((await read('session', { id: session })).entry_source, 'manual')
  await assert.rejects(
    command('sessions', {
      operations: [{ ...create, id: crypto.randomUUID(), work_seconds: 10000 }],
    }),
    /elapsed/
  )
  await db.exec(
    `insert into sessions(user_id,work_seconds,started_at,ended_at) select '${owner}',1,'2025-01-01'::timestamptz + n*interval '1 minute','2025-01-01'::timestamptz+n*interval '1 minute'+interval '1 second' from generate_series(1,10001)n`
  )
  const page = await read('sessions', { limit: 1 })
  assert.ok(page.next_cursor)
  const second = await read('sessions', { limit: 1, cursor: page.next_cursor })
  assert.notEqual(second.items[0].id, page.items[0].id)
  const summary = await read('summary', {
    from: '2024-01-01T00:00:00Z',
    to: '2026-10-01T00:00:00Z',
    timezone: 'America/New_York',
  })
  assert.equal(summary.session_count, 10002)
  assert.equal(summary.work_seconds, 17201)
  assert.equal(
    summary.by_day.reduce((a: number, x: any) => a + x.work_seconds, 0),
    17201
  )
  await command('sessions', { operations: [{ action: 'trash', id: session }] })
  await assert.rejects(
    read('sessions', { limit: 1, cursor: page.next_cursor }),
    /Restart pagination/
  )
  await command('sessions', { operations: [{ action: 'restore', id: session }] })
  assert.equal((await read('session', { id: session })).notes, 'Correction')
})

test('category changes invalidate task cursors that depend on parent visibility', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const cat = crypto.randomUUID()
  await command('categories', { operations: [{ action: 'create', id: cat, name: 'Course' }] })
  await command('tasks', {
    operations: [
      { action: 'create', id: crypto.randomUUID(), name: 'A', category_id: cat },
      { action: 'create', id: crypto.randomUUID(), name: 'B', category_id: cat },
    ],
  })
  const page = await read('tasks', { limit: 1 })
  await command('categories', { operations: [{ action: 'trash', id: cat }] })
  await assert.rejects(read('tasks', { limit: 1, cursor: page.next_cursor }), /Restart pagination/)
})

test('adopting a legacy timer preserves a session already saved by the old offline pipeline', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const id = crypto.randomUUID(),
    revision = crypto.randomUUID(),
    started = new Date(Date.now() - 3600000).toISOString(),
    ended = new Date(Date.parse(started) + 123000).toISOString()
  await db.query(
    'insert into sessions(id,user_id,started_at,ended_at,work_seconds,break_seconds) values($1,$2,$3,$4,123,24)',
    [id, owner, started, ended]
  )
  await db.query('insert into active_timers(user_id,state,revision) values($1,$2,$3)', [
    owner,
    JSON.stringify({
      phase: 'working',
      sessionId: id,
      startedAt: started,
      workSeconds: 123,
      selectedTaskId: null,
    }),
    revision,
  ])
  const timer = await command('timer', { action: 'stop_work', expected_revision: revision })
  assert.equal(timer.state.phase, 'done')
  assert.equal(timer.state.workSeconds, 123)
  assert.equal((await read('sessions')).items.length, 1)
  assert.equal((await read('sessions')).items[0].entry_source, 'legacy')
})

test('summary task/category/day colors retain historical snapshots after category recoloring', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const cat = crypto.randomUUID(),
    task = crypto.randomUUID(),
    session = crypto.randomUUID()
  await command('categories', {
    operations: [{ action: 'create', id: cat, name: 'Original category', color: '#abcdef' }],
  })
  await command('tasks', {
    operations: [{ action: 'create', id: task, name: 'Work', category_id: cat }],
  })
  await command('sessions', {
    operations: [
      {
        action: 'create',
        id: session,
        task_id: task,
        started_at: '2026-10-01T12:00:00Z',
        ended_at: '2026-10-01T13:00:00Z',
        work_seconds: 3600,
      },
    ],
  })
  await command('categories', { operations: [{ action: 'update', id: cat, color: '#ff0000' }] })
  const summary = await read('summary', {
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-02T00:00:00Z',
  })
  assert.equal(summary.by_task_snapshot[0].color, '#abcdef')
  assert.equal(summary.by_category_snapshot[0].color, '#abcdef')
  assert.equal(summary.by_day[0].by_category[0].color, '#abcdef')
})

test('a zero-second rounded midnight slice does not inflate the streak', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  await command('sessions', {
    operations: [
      {
        action: 'create',
        id: crypto.randomUUID(),
        started_at: '2026-10-01T23:59:30Z',
        ended_at: '2026-10-02T00:01:30Z',
        work_seconds: 1,
      },
    ],
  })
  const summary = await read('summary', {
    from: '2026-10-01T00:00:00Z',
    to: '2026-10-03T00:00:00Z',
    timezone: 'UTC',
  })
  assert.equal(summary.work_seconds, 1)
  assert.equal(summary.longest_streak, 1)
  assert.equal(summary.by_day[0].work_seconds, 0)
  assert.equal(summary.by_day[1].work_seconds, 1)
})

test('explicitly clearing attribution works after a legacy task deletion, while note-only edits preserve snapshots', async (t) => {
  const { db, command, read } = await setup()
  t.after(() => db.close())
  const task = crypto.randomUUID(),
    id = crypto.randomUUID()
  await command('tasks', { operations: [{ action: 'create', id: task, name: 'Historical task' }] })
  await command('sessions', {
    operations: [
      {
        action: 'create',
        id,
        task_id: task,
        started_at: '2026-10-01T12:00:00Z',
        ended_at: '2026-10-01T13:00:00Z',
        work_seconds: 3600,
      },
    ],
  })
  await db.query('update sessions set task_id=null where id=$1', [id])
  await command('sessions', {
    operations: [{ action: 'update', id, notes: 'Keep historical attribution' }],
  })
  assert.equal((await read('session', { id })).task_name_snapshot, 'Historical task')
  await command('sessions', { operations: [{ action: 'update', id, task_id: null }] })
  assert.equal((await read('session', { id })).task_id_snapshot, null)
  assert.equal((await read('session', { id })).task_name_snapshot, null)
})
