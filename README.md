# Flowtime

Flowtime is a personal focus timer app based on the Flowtime (Flowmodoro) technique:
- Work until you naturally stop.
- Take a proportional break: break length = work length / 5.

This repository is built from the specification in [FLOWTIME_SPEC.md](FLOWTIME_SPEC.md).

## Current Status

- Phase 0 planning: complete
- Phase 1 scaffold: complete
- Phase 2+ feature implementation: pending

Phase 1 includes:
- React 18 + Vite + strict TypeScript setup
- Tailwind v3 + Geist font + warm dark design tokens
- Path aliases configured in both [tsconfig.json](tsconfig.json) and [tsconfig.app.json](tsconfig.app.json)
- ESLint + Prettier
- simple-git-hooks + lint-staged pre-commit linting
- Full feature-first folder structure scaffold
- [.env.example](.env.example) template
- [public/icon.png](public/icon.png) notification icon (192x192)

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

## Human-Required Actions (Before/At Phase 2)

These actions require your direct account access and cannot be fully automated by the coding agent:

1. Create a Supabase project.
2. Run SQL migrations in the Supabase SQL editor (in order, from the spec).
3. Configure Google OAuth in Supabase Auth and Google Cloud Console.
4. Create `.env.local` with real values from your Supabase project.
5. Replace `<your-project-ref>` in the `update-types` script in [package.json](package.json).
6. Run `pnpm update-types` after schema changes.

## Notes

- The project intentionally does not include automated tests per the current spec.
- Keep implementation decisions aligned with [FLOWTIME_SPEC.md](FLOWTIME_SPEC.md) unless there is a clear reason to deviate.
