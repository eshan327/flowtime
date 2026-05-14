# Flowtime

Flowtime is a production-ready focus timer app built around the Flowtime (Flowmodoro) method:

- Work until you naturally stop.
- Earn a proportional break: break length = work length / 5.

Live app: https://flowtimeboard.vercel.app

Specification source: [FLOWTIME_SPEC.md](FLOWTIME_SPEC.md)

## Project Status

- All spec phases (1-9) are implemented.
- UI and data-layer refactors are complete (shared primitives, centralized query keys, shared ordering logic).
- Local quality gates pass (`pnpm lint`, `pnpm build`, `pnpm exec tsc --noEmit`).
- Production deploy is active on Vercel.

## Core Features

- Google OAuth authentication via Supabase.
- Task management with:
	- Categories and uncategorized tasks.
	- Subtasks with completion and reorder support.
	- Drag-and-drop ordering for categories, tasks, and subtasks.
- Timer workflow:
	- Start work on a selected task (or no task).
	- Stop anytime and automatically compute earned break.
	- Run break, skip break, and resume next session.
	- Session persistence to Supabase.
- Stats dashboard:
	- Range views (day/week/month/year).
	- Streak tracking.
	- Category/task aggregation.
	- Heatmap-style historical activity.
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

## Deployment Notes

- Vercel config for SPA rewrites is in [vercel.json](vercel.json).
- Build output directory is `dist`.
- For auth to work in production, Supabase and Google OAuth callback/origin settings must match the deployed domain.

## Notes

- The spec for this project does not require an automated test suite.
- Keep implementation changes aligned with [FLOWTIME_SPEC.md](FLOWTIME_SPEC.md) unless intentionally revising product scope.
