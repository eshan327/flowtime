# Flowtime

Flowtime is a personal focus timer app based on the Flowtime (Flowmodoro) technique:
- Work until you naturally stop.
- Take a proportional break: break length = work length / 5.

This repository is built from the specification in [FLOWTIME_SPEC.md](FLOWTIME_SPEC.md).

## Current Status

- Step 1 (Scaffold): complete
- Step 2 (Supabase/Auth): complete
- Step 3 (App shell): complete
- Step 4 (Tasks): complete
- Step 5 (Timer): complete
- Step 6 (Notifications/Audio): complete
- Step 7 (Stats): complete
- Step 8 (Polish): complete
- Step 9 (Deploy): automated portion complete, human validation pending

Deployment prep in repo:
- [vercel.json](vercel.json) added for SPA rewrites
- [.env.example](.env.example) documents required env vars
- Production build verified with `pnpm build`
- Vercel production env vars configured
- Production alias is live: https://flowtime-weld.vercel.app

## Tech Stack

- React 18, Vite, TypeScript (strict)
- Tailwind CSS v3
- React Router v6
- TanStack Query v5
- Zustand
- Supabase
- Recharts, Lucide, clsx, tailwind-merge
- ESLint, Prettier, simple-git-hooks, lint-staged

## Setup

### 1) Install dependencies

```bash
pnpm install
```

### 2) Approve build scripts (pnpm v11+)

In environments with build-script approval enabled, allow required packages:

```bash
pnpm approve-builds simple-git-hooks supabase
```

This writes approvals into [pnpm-workspace.yaml](pnpm-workspace.yaml).

### 3) Ensure git hooks are registered

If hooks are not present in `.git/hooks/`, run:

```bash
pnpm dlx simple-git-hooks
```

### 4) Start the app

```bash
pnpm dev
```

## Deployment (Step 9)

### 1) Ensure local checks pass

```bash
pnpm lint
pnpm build
```

### 2) Push to GitHub

```bash
git add .
git commit -m "Prepare deployment"
git push origin main
```

### 3) Connect to Vercel

- Import this repository in Vercel (Framework Preset: Vite).
- Build command: `pnpm build`
- Output directory: `dist`
- Confirm [vercel.json](vercel.json) rewrite is detected.

### 4) Add Vercel environment variables

Required:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Optional fallback supported by code:
- `VITE_SUPABASE_ANON_KEY`

### 5) OAuth callback/domain alignment

After first production deploy:
- In Supabase Auth URL configuration:
	- Site URL = production app domain
	- Redirect allowlist includes production app domain and `http://localhost:5173`
- In Google Cloud OAuth settings:
	- Update origins/redirect configuration to match the Supabase callback and production domain setup

### 6) Production validation checklist

- Sign in with Google on production URL
- Start and stop a session, verify session row is created
- Open the app on a second device, verify data sync
- Verify mobile viewport shows the bottom tab bar
- Refresh `/`, `/tasks`, and `/stats` directly to confirm no 404s

## Available Scripts

- `pnpm dev`: run the Vite dev server
- `pnpm build`: type-check and build for production
- `pnpm lint`: lint `src/**/*.ts(x)`
- `pnpm preview`: preview production build
- `pnpm update-types`: regenerate Supabase types in [src/types/supabase.ts](src/types/supabase.ts)

## Manual Validation (Phase 1)

The following checks are passing in this workspace:
- `pnpm lint`
- `pnpm build`
- `pnpm dev`
- [public/icon.png](public/icon.png) is 192x192

## Human-Required Actions

These actions require your direct account access and cannot be fully automated by the coding agent:

1. Align OAuth production domain settings in Supabase and Google Cloud.
2. Validate Google login flow on the production domain.
3. Validate cross-device sync using a second device.
4. Validate mobile behavior on a real phone viewport/device.

## Notes

- The project intentionally does not include automated tests per the current spec.
- Keep implementation decisions aligned with [FLOWTIME_SPEC.md](FLOWTIME_SPEC.md) unless there is a clear reason to deviate.
