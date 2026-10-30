import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
export const owner = '10000000-0000-4000-8000-000000000001'
export const other = '10000000-0000-4000-8000-000000000002'
export const client = '30000000-0000-4000-8000-000000000001'
const audience = 'https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent'
const baseline = JSON.parse(
  await readFile(new URL('../../supabase/baseline/20261029.json', import.meta.url), 'utf8')
)
const migration = await readFile(
  new URL('../../supabase/migrations/20261030001025_full_agent_integration.sql', import.meta.url),
  'utf8'
)
const quote = (s: string) => '"' + s.replaceAll('"', '""') + '"'

export async function setup() {
  const db = new PGlite()
  await db.exec(`create role authenticated; create role anon; create role service_role; create role supabase_auth_admin;
    create schema auth; create schema extensions; create schema private;
    create table auth.users(id uuid primary key);
    insert into auth.users values ('${owner}'),('${other}');
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function extensions.uuid_generate_v4() returns uuid language sql as $$select gen_random_uuid()$$;
    grant usage on schema public,auth,extensions to authenticated,anon; set search_path=public,extensions;
  `)
  for (const table of baseline.tables) {
    await db.exec(
      `create table public.${quote(table.name)} (${table.columns
        .map(
          (c: { name: string; type: string; not_null: boolean; default: string | null }) =>
            `${quote(c.name)} ${c.type}${c.not_null ? ' not null' : ''}${c.default ? ' default ' + c.default : ''}`
        )
        .join(',')});`
    )
  }
  for (const c of [...baseline.constraints].sort(
    (a, b) =>
      Number(a.definition.startsWith('FOREIGN KEY')) -
      Number(b.definition.startsWith('FOREIGN KEY'))
  ))
    await db.exec(`alter table public.${c.table} add constraint ${quote(c.name)} ${c.definition}`)
  for (const table of baseline.tables)
    await db.exec(
      `alter table public.${quote(table.name)} enable row level security; grant all on public.${quote(table.name)} to authenticated;`
    )
  for (const p of baseline.policies)
    await db.exec(
      `create policy ${quote(p.policyname)} on public.${quote(p.tablename)} as ${p.permissive} for ${p.cmd} to ${p.roles.map(quote).join(',')}${p.qual ? ' using (' + p.qual + ')' : ''}${p.with_check ? ' with check (' + p.with_check + ')' : ''}`
    )
  for (const f of baseline.functions) await db.exec(f)
  await db.exec(migration)
  await db.exec(
    await readFile(
      new URL(
        '../../supabase/migrations/20261030015652_bind_pagination_to_attribution.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  await db.exec(
    await readFile(
      new URL(
        '../../supabase/migrations/20261030020841_preserve_summary_snapshot_colors.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  await db.exec(
    await readFile(
      new URL(
        '../../supabase/migrations/20261030021240_count_only_allocated_streak_days.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  await db.exec(
    await readFile(
      new URL(
        '../../supabase/migrations/20261030022802_make_history_attribution_explicit.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  await db.exec(
    await readFile(
      new URL('../../supabase/migrations/20261030034114_empty_trash.sql', import.meta.url),
      'utf8'
    )
  )
  await db.exec(`insert into private.flowtime_agent_clients values ('${client}');`)
  async function claims(user = owner, oauth = false, extra = {}) {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({
        sub: user,
        role: 'authenticated',
        is_anonymous: false,
        aud: ['authenticated', audience],
        ...(oauth ? { client_id: client } : {}),
        ...extra,
      }),
    ])
    await db.exec('set role authenticated')
  }
  async function command(operation: string, input: unknown, id = crypto.randomUUID()) {
    return (
      await db.query<{ result: any }>('select public.flowtime_command($1,$2,$3) as result', [
        operation,
        JSON.stringify(input),
        id,
      ])
    ).rows[0].result
  }
  async function read(operation: string, input = {}) {
    return (
      await db.query<{ result: any }>('select public.flowtime_read($1,$2) as result', [
        operation,
        JSON.stringify(input),
      ])
    ).rows[0].result
  }
  await claims()
  return { db, claims, command, read }
}
