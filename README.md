# Flowtime

Flowtime is a production-ready focus timer app built around the Flowtime (Flowmodoro) method:

- Work until you naturally stop.
- Earn a proportional break: break length = work length / 5.

Live app: https://flowtimeboard.vercel.app

## Project Status

- Production app is deployed on Vercel.
- Local quality gates: `pnpm lint` and `pnpm build`.
- Data model now supports immutable historical attribution plus explicit session correction.

## Core Features

- Google OAuth authentication via Supabase.
- Task management with:
  - Categories and uncategorized tasks.
  - Category archive lifecycle (archive, restore, archived views).
  - Active/completed task split with a completed archive toggle.
  - Subtasks with completion and reorder support.
  - Reordering via drag-and-drop plus move up/down fallback controls.
- Timer workflow:
  - Start work only after selecting a task.
  - Quick-add task directly from task selector.
  - Quick replay from the last completed session.
  - Stop anytime and automatically compute earned break.
  - Run break, skip break, and resume next session.
  - Optional focus mode lock prevents task switching while working.
  - Global keyboard shortcuts for timer controls and panel actions.
  - Configurable break divisor with a sensible global default.
  - Visual timer progress cues (break countdown ring + work progress bar).
  - Session persistence to Supabase with an IndexedDB-backed offline queue and idempotent retries.
  - Reload-safe timer state that is cleared when the signed-in user changes.
  - Quick correction actions on completed sessions (edit/delete last session).
- Stats dashboard:
  - Range views (day/week/month/year).
  - Streak tracking.
  - Category/task aggregation.
  - Heatmap-style historical activity.
  - CSV/JSON export for current range and full history.
  - Session logs in Stats and History with edit, notes, and soft-delete + undo.
  - Historical attribution uses session snapshots so task/category drift does not rewrite old stats.
- Responsive shell for desktop and mobile navigation.

## Tech Stack

- React 18 + Vite
- TypeScript (strict)
- Tailwind CSS v3
- React Router v6
- TanStack Query v5
- Zustand
- Supabase
- Recharts + Lucide
- ESLint + Prettier + simple-git-hooks + lint-staged

## Architecture Conventions

- Shared infrastructure and framework-agnostic helpers live in [src/lib](src/lib).
- Supabase client usage must import from [src/lib/supabaseClient.ts](src/lib/supabaseClient.ts) only.
- Context files define providers/state containers; consumer hooks live in [src/hooks](src/hooks).
- Feature-specific UI, hooks, and stores stay in their feature folders under [src/features](src/features).
- Reusable domain workflows live in a dedicated feature (for example, [src/features/sessions](src/features/sessions)) and are imported directly by their consumers.
- Shared data shapes live in [src/types](src/types); feature folders should not duplicate them.

## Local Development

1. Install dependencies:

```bash
pnpm install
```

2. If your environment requires build-script approvals (pnpm v11+):

```bash
pnpm approve-builds simple-git-hooks supabase
```

3. Start the app:

```bash
pnpm dev
```

## Environment Variables

Documented in [.env.example](.env.example).

Required:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional fallback:

- `VITE_SUPABASE_ANON_KEY`

## Scripts

- `pnpm dev` - run local dev server
- `pnpm lint` - lint source files
- `pnpm build` - type-check and build for production
- `pnpm preview` - preview production bundle locally
- `pnpm update-types` - regenerate Supabase types in [src/types/supabase.ts](src/types/supabase.ts)

## Data Integrity Rules

- Session rows store task/category snapshot fields at save-time.
- Renaming, recoloring, archiving, or deleting tasks/categories does not retroactively change old stats attribution.
- Editing a session is an explicit correction action and intentionally updates historical aggregates.
- Deleting a session in-app is soft-delete (`deleted_at`) so it can be undone in the UI window.
- New Supabase schema changes must include generated migration files and regenerated TypeScript types.

## Schema Migrations

This checkout does not currently contain a committed schema baseline. Capture and review the linked project's current schema before introducing the next database migration. After schema changes, run:

```bash
supabase db push
pnpm update-types
```

## Deployment Notes

- Vercel config for SPA rewrites is in [vercel.json](vercel.json).
- Build output directory is `dist`.
- For auth to work in production, Supabase and Google OAuth callback/origin settings must match the deployed domain.
