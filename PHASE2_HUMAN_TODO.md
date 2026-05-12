# Phase 2 Human Actions TODO

Use this checklist to complete all manual setup required for Phase 2 before moving to Phase 3.

## 1. Create Supabase Project

- [ ] Create a new project at https://supabase.com.
- [ ] Save these values for later:
  - Project ref (Project Settings -> General)
  - Project URL (Project Settings -> API)
  - anon public key (Project Settings -> API)

Done when:
- You can open the project dashboard and have all 3 values recorded.

## 2. Run SQL Schema Migrations (In Order)

Run each SQL block from the spec, in this exact sequence, using Supabase SQL Editor:

- [ ] 6.1 Enable UUID extension
- [ ] 6.2 Create `categories`
- [ ] 6.3 Create `tasks`
- [ ] 6.4 Create `subtasks`
- [ ] 6.5 Create `sessions`

Notes:
- All `position` columns must be `float8`.
- RLS must be enabled for each table.
- Policies and indexes in each block must be created.

Quick verification SQL:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('categories', 'tasks', 'subtasks', 'sessions')
order by table_name;
```

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('categories', 'tasks', 'subtasks')
  and column_name = 'position'
order by table_name;
```

Done when:
- All 4 tables exist.
- `categories.position`, `tasks.position`, and `subtasks.position` are `double precision` (`float8`).

## 3. Configure Google OAuth (Supabase + Google Cloud)

- [ ] In Supabase: Authentication -> Providers -> Google -> Enable.
- [ ] In Google Cloud Console, create OAuth 2.0 Web Application credentials.
- [ ] Add Supabase callback URL as an authorized redirect URI (copy exact value from Supabase provider page), e.g.:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`
- [ ] Copy Google Client ID + Client Secret into Supabase Google provider settings and save.
- [ ] In Supabase Authentication -> URL Configuration:
  - Set Site URL to your production URL (or local URL for now).
  - Add redirect URLs allowlist including:
    - `http://localhost:5173`
    - your production app URL

Done when:
- Google provider shows enabled in Supabase.
- OAuth credentials are saved and callback URI matches exactly.

## 4. Create Local Environment File

At project root, create `.env.local`:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
```

- [ ] File created with real values.
- [ ] Restart dev server after creating/updating the file.

Done when:
- App starts without "Missing Supabase environment variables" errors.

## 5. Replace Project Ref In `update-types` Script

Edit `package.json` script `update-types`:

- [ ] Replace `<your-project-ref>` with your real project ref.

Target format:

```json
"update-types": "supabase gen types typescript --project-id <REAL_PROJECT_REF> > src/types/supabase.ts"
```

Done when:
- Script contains your real ref and no placeholder text.

## 6. Generate Supabase Types

From project root:

```bash
pnpm update-types
```

If prompted for auth, run:

```bash
pnpm supabase login
```

Then run `pnpm update-types` again.

- [ ] Type generation command completed successfully.
- [ ] `src/types/supabase.ts` now contains real table types.

Done when:
- `src/types/supabase.ts` includes typed `Database.public.Tables` entries for your schema.

## 7. Final Validation

Run:

```bash
pnpm lint
pnpm build
pnpm dev
```

- [ ] Lint passes.
- [ ] Build passes.
- [ ] Dev server starts.
- [ ] Browser flow works:
  - Login page appears when signed out.
  - Google sign-in succeeds.
  - Authenticated shell appears.
  - Sign out returns you to login page.

Done when:
- All checks above pass.

## Completion Criteria

Phase 2 human actions are complete when Sections 1 through 7 are all checked off.
