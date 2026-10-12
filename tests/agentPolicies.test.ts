import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'

const owner = '10000000-0000-4000-8000-000000000001'
const other = '10000000-0000-4000-8000-000000000002'
const ownTask = '20000000-0000-4000-8000-000000000001'
const ownCategory = '30000000-0000-4000-8000-000000000001'
const otherCategory = '30000000-0000-4000-8000-000000000002'
const audience = 'https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent'

test('PostgreSQL policies limit OAuth grants even when the client bypasses the tool server', async (t) => {
  const db = new PGlite()
  t.after(() => db.close())
  // Minimal schema fixture mirrors the live ownership policies; no production data is loaded.
  await db.exec(`
    create role authenticated;
    create role anon;
    create role supabase_auth_admin;
    create schema auth;
    create schema storage;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims', true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    grant usage on schema auth, public, storage to authenticated, anon;
    create table public.tasks (id uuid primary key default gen_random_uuid(), user_id uuid not null, category_id uuid, name text);
    create table public.categories (id uuid primary key, user_id uuid not null, name text);
    create table public.sessions (id uuid primary key default gen_random_uuid(), user_id uuid not null, deleted_at timestamptz, name text);
    create table public.active_timers (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text);
    create table public.user_settings (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text);
    create table public.subtasks (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text);
    create table storage.objects (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text);
    grant all on all tables in schema public, storage to authenticated;
    do $$declare tab text; begin
      foreach tab in array array['public.tasks','public.categories','public.sessions','public.active_timers','public.user_settings','public.subtasks','storage.objects'] loop
        execute format('alter table %s enable row level security', tab);
        execute format('create policy own_rows on %s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', tab);
      end loop;
    end$$;
    insert into categories values ('${ownCategory}', '${owner}', 'Mine'), ('${otherCategory}', '${other}', 'Other');
    insert into tasks values ('${ownTask}', '${owner}', '${ownCategory}', 'Mine'), (gen_random_uuid(), '${other}', '${otherCategory}', 'Other');
    insert into sessions(user_id,name) values ('${owner}','Saved');
    insert into sessions(user_id,name,deleted_at) values ('${owner}','Deleted',now());
    insert into active_timers(user_id,name) values ('${owner}','working');
    insert into user_settings(user_id,name) values ('${owner}','settings');
    insert into subtasks(user_id,name) values ('${owner}','subtask');
    insert into storage.objects(user_id,name) values ('${owner}','avatar');
  `)
  await db.exec(
    await readFile(
      new URL('../supabase/migrations/20261012230439_restrict_agent_access.sql', import.meta.url),
      'utf8'
    )
  )
  const setClaims = async (extra: Record<string, unknown>) => {
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: owner, role: 'authenticated', is_anonymous: false, ...extra }),
    ])
  }
  const count = async (table: string) =>
    (await db.query<{ count: number }>(`select count(*)::int as count from ${table}`)).rows[0].count
  await db.exec('set role authenticated')
  await setClaims({ client_id: 'test-client', aud: ['authenticated', audience] })
  assert.equal(await count('tasks'), 1, 'Other owner is invisible')
  assert.equal(await count('categories'), 1)
  assert.equal(await count('sessions'), 1, 'Deleted sessions are invisible')
  assert.equal(await count('subtasks'), 0)
  assert.equal(await count('storage.objects'), 0)
  assert.equal(await count('active_timers'), 1)
  assert.equal(await count('user_settings'), 1)
  await db.exec(`insert into tasks(user_id,name) values ('${owner}','Agent created')`)
  assert.equal(
    (await db.query(`update tasks set name='Completed' where id='${ownTask}' returning id`)).rows
      .length,
    1
  )
  await assert.rejects(
    db.exec(`insert into tasks(user_id,name) values ('${other}','Forbidden')`),
    /row-level security/
  )
  await assert.rejects(
    db.exec(`update tasks set category_id='${otherCategory}' where id='${ownTask}'`),
    /row-level security/
  )
  assert.equal((await db.query('delete from tasks returning id')).rows.length, 0)
  for (const table of [
    'categories',
    'sessions',
    'active_timers',
    'user_settings',
    'subtasks',
    'storage.objects',
  ]) {
    assert.equal(
      (await db.query(`update ${table} set name='Forbidden' returning id`)).rows.length,
      0,
      table
    )
    assert.equal((await db.query(`delete from ${table} returning id`)).rows.length, 0, table)
    await assert.rejects(
      db.exec(
        `insert into ${table}(id,user_id,name) values (gen_random_uuid(),'${owner}','Forbidden')`
      ),
      /row-level security/
    )
  }
  await setClaims({ client_id: 'test-client', aud: 'authenticated' })
  assert.equal(await count('tasks'), 0, 'Wrong-audience OAuth tokens cannot bypass the server')
  await setClaims({ client_id: 'test-client', aud: [audience], is_anonymous: true })
  assert.equal(await count('tasks'), 0, 'Guest OAuth access is denied')
  await setClaims({ aud: 'authenticated' })
  assert.equal(await count('sessions'), 2, 'Browser can still read deleted sessions for undo')
  assert.equal(await count('storage.objects'), 1, 'Browser avatar access remains')
  assert.equal(
    (await db.query(`update active_timers set name='breaking' returning id`)).rows.length,
    1
  )
  assert.equal(
    (await db.query('delete from tasks returning id')).rows.length,
    2,
    'Browser still deletes its own tasks'
  )
  await assert.rejects(
    db.query('select private.flowtime_agent_token_hook($1)', [{ claims: {} }]),
    /permission denied/
  )
  await db.exec('reset role; set role supabase_auth_admin')
  const regular = { claims: { aud: 'authenticated', sub: owner } }
  const unchanged = await db.query<{ result: unknown }>(
    'select private.flowtime_agent_token_hook($1) as result',
    [regular]
  )
  assert.deepEqual(unchanged.rows[0].result, regular)
  const oauth = await db.query<{ result: { claims: { aud: string[] } } }>(
    'select private.flowtime_agent_token_hook($1) as result',
    [{ ...regular, client_id: 'test-client' }]
  )
  assert.deepEqual(oauth.rows[0].result.claims.aud, ['authenticated', audience])
})
