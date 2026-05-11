# Flowtime App — Full Project Specification

> This document is the single source of truth for building the Flowtime application. It is written to be fed to an AI coding agent such as yourself. Follow every instruction exactly. You should only deviate from the architecture, naming conventions, or design decisions described here with a clear reason.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository & Tooling Setup](#3-repository--tooling-setup)
4. [Folder Structure](#4-folder-structure)
5. [Design System](#5-design-system)
6. [Database Schema (Supabase)](#6-database-schema-supabase)
7. [Authentication](#7-authentication)
8. [State Management](#8-state-management)
9. [Feature: Timer](#9-feature-timer)
10. [Feature: Tasks](#10-feature-tasks)
11. [Feature: Stats](#11-feature-stats)
12. [Shared Components](#12-shared-components)
13. [Routing](#13-routing)
14. [Notifications & Audio](#14-notifications--audio)
15. [Data Layer & React Query](#15-data-layer--react-query)
16. [Environment Variables](#16-environment-variables)
17. [Deployment (Vercel)](#17-deployment-vercel)
18. [Code Quality Standards](#18-code-quality-standards)
19. [Build Order](#19-build-order)

---

## 1. Project Overview

**Name:** Flowtime

**What it is:** A personal focus timer application built on the Flowtime (Flowmodoro) technique. The user works until they naturally want to stop, then takes a break proportional to the time they worked (break = work time ÷ 5). The app pairs this timer with a task management system and a stats/history visualization screen.

**Target user:** A single user (the developer), used for university coursework and self-directed learning. This is a personal productivity tool, not a multi-tenant SaaS product. It is authenticated (single Google account), with all data persisted in a Supabase database so it syncs across devices.

**Three core screens:**
- **Timer** — the primary focus experience.
- **Tasks** — manage categories and tasks; select the active task for a session.
- **Stats** — curiosity-driven visualizations of focus history.

**Non-goals (explicitly out of scope):**
- Due dates, priorities, or time estimates on tasks.
- Integration with Notion, Todoist, or any external app.
- Team or sharing features.
- A native mobile app (the web app should be mobile-responsive but is not a PWA).
- Accountability features like daily targets or goal-setting.
- Offline support — if the user has no internet connection, session saves will fail with a visible inline error. No local queuing, no IndexedDB fallback, no retry. This is acceptable for a personal tool used at a desk.
- Automated testing — no unit tests, integration tests, or end-to-end tests are required. The build order in §19 specifies manual verification steps at each stage instead.

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | React 18 + Vite | Fast dev server, modern React, trivial Vercel deployment |
| Language | TypeScript (strict mode) | Type safety, better DX, fewer runtime bugs |
| Styling | Tailwind CSS v3 | Utility-first, no CSS file sprawl, easy dark mode |
| Routing | React Router v6 | Standard, file-based-friendly, nested routes |
| Server state | TanStack Query (React Query) v5 | Caching, refetching, loading/error states for all Supabase calls |
| Client state | Zustand | Minimal, non-boilerplate store for timer state and UI state |
| Backend / DB | Supabase | Postgres DB, auth, row-level security, JS SDK |
| Charts | Recharts | Composable, React-native chart library |
| Icons | Lucide React | Consistent, clean icon set |
| Fonts | Geist (via `@fontsource-variable/geist`) | Clean, modern, designed for interfaces |
| Notifications | Web Notifications API (native browser) | No library needed |
| Audio | Web Audio API (native browser) | No library needed; synthesize a soft tone, no audio files required |
| Linting | ESLint + Prettier | Enforced formatting and code quality |
| Package manager | pnpm | Faster, more efficient than npm |

---

## 3. Repository & Tooling Setup

### 3.1 Init

```bash
pnpm create vite@latest flowtime -- --template react-ts
cd flowtime
pnpm install
```

### 3.2 Install all dependencies

```bash
# Core
pnpm add @supabase/supabase-js @tanstack/react-query zustand react-router-dom

# UI
pnpm add recharts lucide-react clsx tailwind-merge

# Fonts
pnpm add @fontsource-variable/geist

# Dev
pnpm add -D @vitejs/plugin-react @types/node tailwindcss postcss autoprefixer eslint prettier eslint-config-prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint-plugin-react-hooks simple-git-hooks lint-staged supabase
```

> **Note:** `@vitejs/plugin-react` is specified explicitly in the dev install command — the Vite template ships it by default, but specifying it here ensures it is never accidentally dropped. `supabase` (the CLI) is installed as a dev dependency here so the project is ready to generate types from the start. `@types/node` is required for `path.resolve` in `vite.config.ts`. `simple-git-hooks` + `lint-staged` enforce linting on commit.

### 3.3 Tailwind init

```bash
pnpm dlx tailwindcss init -p
```

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['GeistVariable', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Warm near-black background
        surface: {
          base: '#0f0e0d',
          raised: '#1a1917',
          overlay: '#242220',
          border: '#2e2c29',
          'border-subtle': '#201f1d',
        },
        ink: {
          primary: '#f0ede8',
          secondary: '#9e9a94',
          tertiary: '#5c5955',
        },
      },
    },
  },
  plugins: [],
} satisfies Config
```

`src/index.css`:

```css
@import '@fontsource-variable/geist';
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    background-color: #0f0e0d;
    color: #f0ede8;
  }

  * {
    font-family: 'GeistVariable', system-ui, sans-serif;
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2e2c29; border-radius: 9999px; }
}
```

### 3.4 TypeScript config

`tsconfig.json` — ensure `"strict": true` and `"baseUrl": "."` with `"paths": { "@/*": ["src/*"] }` so absolute imports work cleanly.

> **Note:** Vite scaffolds both `tsconfig.json` and `tsconfig.app.json`. Add the `paths` alias to **both** files. If only `tsconfig.json` is updated, the Vite dev server may still resolve imports correctly, but editor tooling (language server) will show errors in `tsconfig.app.json`-scoped files.

Also configure Vite to resolve the `@` alias:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

### 3.5 Prettier config

`.prettierrc`:
```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 3.6 ESLint config

`.eslintrc.cjs`:
```js
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
    'prettier',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-hooks', '@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',
  },
}
```

### 3.7 Git hooks (lint-staged)

`package.json` additions:
```json
{
  "scripts": {
    "update-types": "supabase gen types typescript --project-id <your-project-ref> > src/types/supabase.ts"
  },
  "simple-git-hooks": {
    "pre-commit": "pnpm lint-staged"
  },
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

The `update-types` script regenerates TypeScript types from the live Supabase schema. Run `pnpm update-types` any time you add or modify a table. Replace `<your-project-ref>` with your Supabase project ID (found in Project Settings → General).

After adding the hooks config, run once to register the hooks:
```bash
pnpm dlx simple-git-hooks
```

Also create a `.env.example` file at the project root and commit it (this file contains no secrets — it is a template):
```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

---

## 4. Folder Structure

Strict feature-based structure. Every feature owns its components, hooks, and types. Nothing reaches into another feature's internals — only shared `/components/ui` and `/lib` are cross-cutting.

```
src/
├── app/
│   ├── App.tsx               # Root component: providers, router
│   ├── Router.tsx            # All route definitions
│   └── QueryClientProvider.tsx
│
├── context/
│   └── UserContext.tsx        # React context that owns the single Supabase auth listener
│
├── features/
│   ├── timer/
│   │   ├── components/
│   │   │   ├── TimerClock.tsx
│   │   │   ├── TimerControls.tsx
│   │   │   ├── TaskSelector.tsx
│   │   │   └── SessionSummary.tsx   # Shown in 'done' phase — displays completed session stats
│   │   ├── hooks/
│   │   │   ├── useTimer.ts
│   │   │   └── useSessionSave.ts
│   │   ├── stores/
│   │   │   └── timerStore.ts   # Zustand store for timer state
│   │   └── TimerPage.tsx
│   │
│   ├── tasks/
│   │   ├── components/
│   │   │   ├── CategoryTabs.tsx
│   │   │   ├── TaskList.tsx
│   │   │   ├── TaskItem.tsx
│   │   │   ├── AddTaskForm.tsx
│   │   │   ├── AddCategoryForm.tsx
│   │   │   ├── SubtaskList.tsx
│   │   │   └── ColorPicker.tsx
│   │   ├── hooks/
│   │   │   ├── useCategories.ts
│   │   │   ├── useTasks.ts
│   │   │   └── useSubtasks.ts
│   │   └── TasksPage.tsx
│   │
│   ├── stats/
│   │   ├── components/
│   │   │   ├── TimeRangeSelector.tsx
│   │   │   ├── DailyBarChart.tsx
│   │   │   ├── HeatmapGrid.tsx
│   │   │   ├── CategoryBreakdown.tsx
│   │   │   ├── TaskBreakdown.tsx
│   │   │   └── SummaryCards.tsx
│   │   ├── hooks/
│   │   │   └── useStats.ts
│   │   └── StatsPage.tsx
│   │
│   └── auth/
│       ├── components/
│       │   └── AuthGuard.tsx
│       └── LoginPage.tsx
│
├── components/
│   └── ui/
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Input.tsx
│       ├── Badge.tsx
│       ├── Tooltip.tsx
│       ├── Spinner.tsx
│       ├── EmptyState.tsx
│       └── Layout.tsx        # App shell: sidebar nav + main content area
│
├── lib/
│   ├── supabaseClient.ts     # Single Supabase client instance
│   ├── queryClient.ts        # TanStack Query client config
│   └── utils.ts              # Shared pure utility functions (formatTime, cn, etc.)
│
├── hooks/
│   └── useUser.ts            # Consumes UserContext — thin hook, no direct Supabase call
│
└── types/
    └── index.ts              # All shared TypeScript types/interfaces
```

**Rules:**
- No feature imports from another feature. If two features share something, extract it to `/components/ui` or `/lib`.
- No raw Supabase calls in components. All DB access happens in custom hooks inside `/features/*/hooks/`.
- Every custom hook that fetches data uses TanStack Query (`useQuery` / `useMutation`).
- The Zustand store is only for the timer's ephemeral runtime state (not persisted to DB until the session ends).

---

## 5. Design System

### 5.1 Philosophy

The app should look like something a thoughtful developer designed for their own use. The aesthetic is **warm dark minimal** — not glossy or corporate. The background is a near-black with a warm undertone (`#0f0e0d`). Surfaces lift slightly in warmth as they stack. The only real color in the UI comes from category colors — all chrome is monochrome. When you look at the stats or task list, your eye goes directly to the meaningful color.

Think: the quiet focus of a desk lamp at night. Not a dashboard. Not a SaaS product.

### 5.2 Color

**App chrome (always monochrome):**
- Background base: `#0f0e0d`
- Raised surface (cards, sidebars): `#1a1917`
- Overlay surface (modals, dropdowns): `#242220`
- Border default: `#2e2c29`
- Border subtle: `#201f1d`
- Text primary: `#f0ede8`
- Text secondary: `#9e9a94`
- Text tertiary: `#5c5955`

**Accent (used sparingly — interactive focus rings, primary action buttons):**
- A warm off-white: `#f0ede8` (same as text primary) for button fills
- Active timer state: a very dim warm amber glow (`#b45309` at low opacity) on the clock container — subtle, not loud

**Category colors — the palette:**
Offer exactly 20 preset swatches plus a color wheel fallback. The presets should be visually distinct and aesthetically considered — not garish. Use mid-saturation values that look good on dark backgrounds. The hex values:

```ts
export const COLOR_PRESETS = [
  '#e06c75', // rose
  '#e5534b', // red
  '#f0883e', // orange
  '#d19a66', // warm amber
  '#e5c07b', // yellow
  '#89ca78', // green
  '#56b6c2', // teal
  '#61afef', // sky blue
  '#528bff', // blue
  '#c678dd', // purple
  '#be5ab0', // magenta
  '#ff7eb6', // pink
  '#4ec9b0', // mint
  '#3dc9b0', // seafoam
  '#73c991', // sage
  '#b5cea8', // muted green
  '#9cdcfe', // light blue
  '#ce9178', // terracotta
  '#d4a574', // tan
  '#a8a8a8', // neutral gray
] as const
```

The color wheel is an `<input type="color">` styled to match the UI — hide the native appearance, show a circular swatch that opens the picker on click. Use a `useRef` to trigger the input programmatically (see §10.7 for implementation details).

**Color assignment rules:**
- A category has one color. All tasks within that category inherit that color.
- An uncategorized task has its own individually set color (defaults to the first preset).
- Color appears as: a small colored dot/pill next to the category name, task row left-border accent, chart fill, heatmap cell fill.

### 5.3 Typography

Single font: **Geist Variable**. No mixed pairings.

| Usage | Size | Weight |
|---|---|---|
| Page heading | 20px | 500 |
| Section heading | 14px | 500 |
| Body / task name | 14px | 400 |
| Secondary text | 13px | 400 |
| Timer clock | 80px | 300 (light) |
| Break clock | 64px | 300 |
| Stat numbers | 32px | 400 |
| Labels / caps | 11px | 500, letter-spacing: 0.08em |

All labels and categories use **sentence case**. Never all-caps in user-facing text (the 11px stat labels are an exception — they use uppercase as a visual treatment only).

### 5.4 Spacing & Radius

- Base spacing unit: 4px (Tailwind's default scale — use `gap-2`, `p-4`, etc.)
- Card border radius: `rounded-xl` (12px)
- Button border radius: `rounded-lg` (8px)
- Input border radius: `rounded-lg` (8px)
- Small badge/dot: `rounded-full`

### 5.5 Layout

**App shell:** Fixed left sidebar (240px wide on desktop, collapsible to icon-only on mobile) + main content area. The sidebar contains the logo/app name, navigation links (Timer, Tasks, Stats), and the user avatar + logout button at the bottom.

On mobile (< 768px): sidebar becomes a bottom tab bar with icons only.

**Main content:** Max width `max-w-3xl` centered for Timer and Tasks. Stats can be wider (`max-w-5xl`) to accommodate charts.

### 5.6 Motion

Keep it subtle. Never animate for its own sake.
- Page transitions: simple `opacity` fade, 150ms ease
- Timer clock number transitions: use CSS `transition: all 80ms` on the displayed value container — this gives a faint snap when digits change
- Task completion: the row slides out with `opacity → 0` + `max-height → 0` over 300ms before being removed from the list
- Modal entrance: `scale(0.97) → scale(1)` + `opacity 0 → 1` over 150ms
- Break phase transition on timer: the clock color crossfades from the work color (ink-primary) to a calm teal (`#4ec9b0`) over 400ms

---

## 6. Database Schema (Supabase)

Run all of this in the Supabase SQL editor, in order.

### 6.1 Enable UUID extension

```sql
create extension if not exists "uuid-ossp";
```

### 6.2 Categories table

```sql
create table categories (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#61afef',
  -- float8 (not integer) for fractional indexing.
  -- Using integers where all rows default to 0 makes reordering require updating
  -- every row. With float8, inserting between two items is always possible by
  -- taking the midpoint: newPos = (posA + posB) / 2.
  position    float8 not null default 0,
  created_at  timestamptz not null default now()
);

alter table categories enable row level security;

create policy "Users manage their own categories"
  on categories for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_categories_user_id on categories(user_id);
```

### 6.3 Tasks table

```sql
create table tasks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  category_id   uuid references categories(id) on delete set null,
  name          text not null,
  color         text,         -- only used when category_id is null
  -- float8 for the same fractional indexing reason as categories.position
  position      float8 not null default 0,
  completed_at  timestamptz,  -- null = active; set = completed/archived
  created_at    timestamptz not null default now()
);

alter table tasks enable row level security;

create policy "Users manage their own tasks"
  on tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_tasks_user_id on tasks(user_id);
create index idx_tasks_category_id on tasks(category_id);
create index idx_tasks_completed_at on tasks(completed_at);
```

### 6.4 Subtasks table

```sql
create table subtasks (
  id            uuid primary key default uuid_generate_v4(),
  task_id       uuid not null references tasks(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  -- float8 for consistency with the fractional indexing pattern
  position      float8 not null default 0,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

alter table subtasks enable row level security;

create policy "Users manage their own subtasks"
  on subtasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_subtasks_task_id on subtasks(task_id);
create index idx_subtasks_user_id on subtasks(user_id);
```

### 6.5 Sessions table

```sql
create table sessions (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  task_id       uuid references tasks(id) on delete set null,
  work_seconds  integer not null,
  break_seconds integer not null default 0,
  started_at    timestamptz not null,
  ended_at      timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "Users manage their own sessions"
  on sessions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_sessions_user_id on sessions(user_id);
create index idx_sessions_task_id on sessions(task_id);
create index idx_sessions_started_at on sessions(started_at);
```

### 6.6 Schema notes

- `completed_at` being `null` vs. set is the canonical "active vs. archived" distinction. Never delete completed tasks — they're needed for stats. The tasks list query filters `where completed_at is null`. The stats query joins sessions to tasks regardless of `completed_at`.
- `work_seconds` and `break_seconds` are stored as integers (total seconds) for simplicity. All formatting to human-readable strings happens in the frontend.
- `started_at` is set on the frontend when the user clicks "Start" — it is not auto-generated by the DB because we want to accurately reflect when the session began, not when it was saved.
- `position` on categories, tasks, and subtasks uses `float8` for fractional indexing. When inserting a new item at the end, use `Math.max(...existingPositions) + 1`. When inserting between two items A and B, use `(A.position + B.position) / 2`. When the gap between two adjacent positions shrinks below `0.0001`, renormalize all positions for that user to integers (0, 1, 2, …) — this is rare in practice but prevents floating point precision loss over many reorders.

> Renormalization ownership: The gap check and renormalization logic lives inside the `reorderCategory` mutation in `useCategories` and the `reorderTask` mutation in `useTasks`. After each reorder write, check the new gap against its neighbours. If the gap is below `0.0001`, issue a second batch update (a single Supabase `upsert`) that resets all positions for that entity type to integers `0, 1, 2, …` ordered by current position. This second update fires only when needed — it is not a routine step. The same pattern applies to subtask reordering in `useSubtasks`.

---

## 7. Authentication

### 7.1 Supabase setup (one-time, manual)

1. Create a Supabase project at supabase.com.
2. Go to **Authentication → Providers → Google** and enable it.
3. In Google Cloud Console, create an OAuth 2.0 credential. Set the authorized redirect URI to the callback URL shown in Supabase (e.g. `https://your-project.supabase.co/auth/v1/callback`).
4. Paste the Google Client ID and Secret back into Supabase.
5. In **Authentication → URL Configuration**, set:
   - Site URL: your production Vercel URL (e.g. `https://flowtime.vercel.app`)
   - Redirect URLs (allowlist): also add `http://localhost:5173` for local dev

### 7.2 Supabase client

`src/lib/supabaseClient.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
```

This is a singleton. Import `supabase` from this file everywhere. Never call `createClient` again anywhere else. The client is typed with the generated `Database` type — this gives full type inference on all `.from()` calls.

### 7.3 UserContext and `useUser` hook

`useUser` is backed by a single React context that owns exactly one Supabase auth listener at the root of the app. Never call `supabase.auth.onAuthStateChange` directly in a component or hook — if multiple components register their own listeners, it wastes resources and can produce subtle race conditions. All components that need the user consume the context via the `useUser()` hook.

**`src/context/UserContext.tsx`:**

```tsx
import { createContext, useContext, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabaseClient'

interface UserContextValue {
  user: User | null
  loading: boolean
}

const UserContext = createContext<UserContextValue>({ user: null, loading: true })

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Single listener for the entire app — registered once here, never duplicated
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <UserContext.Provider value={{ user, loading }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
```

**`src/hooks/useUser.ts`:**

```ts
// Re-export from context for convenient import path
export { useUser } from '@/context/UserContext'
```

> **Canonical import path:** Always import `useUser` from `@/hooks/useUser`, never directly from `@/context/UserContext`. Both resolve to the same function, but two valid import paths for the same hook will produce inconsistent imports across the codebase that a linter will not catch. The re-export in `hooks/useUser.ts` exists specifically to provide a single stable, short path — use it exclusively.

Wrap the entire app in `<UserProvider>` in `App.tsx`, above `QueryClientProvider` and the router.

### 7.4 AuthGuard

`src/features/auth/components/AuthGuard.tsx`:

Wrap the entire authenticated app in this component. If `loading` is true, show a centered spinner. If `user` is null, show the `LoginPage`. If `user` is set, render children.

```tsx
import { useUser } from '@/hooks/useUser'
import { LoginPage } from '@/features/auth/LoginPage'
import { Spinner } from '@/components/ui/Spinner'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser()

  if (loading) return <div className="flex h-screen items-center justify-center"><Spinner /></div>
  if (!user) return <LoginPage />
  return <>{children}</>
}
```

### 7.5 Login page

`src/features/auth/LoginPage.tsx`:

A centered full-screen layout. The background matches the app (warm dark). Show the app name "Flowtime" in large light-weight type. Below it, a brief one-line description. Then a single "Continue with Google" button. The button has a subtle border, the Google SVG icon inline, and uses the standard Tailwind hover state.

Sign-in function:
```ts
await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: window.location.origin,
  },
})
```

No email/password option. Google only.

### 7.6 Sign out

In the sidebar, a small button at the bottom. On click:
```ts
await supabase.auth.signOut()
```
No confirmation dialog needed. On sign-out, Supabase clears the session and the `onAuthStateChange` listener in `UserProvider` updates the user to null, which causes `AuthGuard` to show the login page.

---

## 8. State Management

### 8.1 What lives where

| State | Where | Why |
|---|---|---|
| Timer running/paused, elapsed seconds, break countdown, phase | Zustand (`timerStore`) | Ephemeral runtime state — not fetched, not cached, needs to update every second |
| Current selected task for the session | Zustand (`timerStore`) | Coupled to timer state |
| All categories | TanStack Query | Fetched from Supabase, cached, invalidated on mutation |
| All active tasks | TanStack Query | Same |
| Sessions history | TanStack Query | Same |
| Stats/aggregated data | TanStack Query | Derived queries, may be expensive — benefit from caching |
| Current user | React context (`UserContext`) | Single source of truth; one Supabase listener at the root |
| Active category tab (Tasks page) | React local state (`useState`) | Pure UI state, no need for global store |
| Stats time range selection | React local state | Pure UI state |

### 8.2 Zustand timer store

`src/features/timer/stores/timerStore.ts`:

```ts
import { create } from 'zustand'

export type TimerPhase = 'idle' | 'working' | 'breaking' | 'done'

// Maximum session length guard. If a user starts a session and their laptop
// sleeps, the wall-clock calculation would produce an absurdly large elapsed
// time when they reopen the lid. Sessions are capped at 6 hours. If the
// calculated elapsed time exceeds this, useTimer will auto-stop the session
// and flag it for the user.
export const MAX_SESSION_SECONDS = 6 * 60 * 60 // 6 hours

interface TimerState {
  phase: TimerPhase
  workSeconds: number        // counts up during 'working' — SET FROM WALL CLOCK, not incremented naively
  breakEndAt: Date | null    // wall-clock time when break ends; set when break starts
  breakTotal: number         // full break duration earned (for display purposes)
  startedAt: Date | null     // wall-clock time when the work session started
  selectedTaskId: string | null
  runawayDetected: boolean   // true if session was auto-stopped due to exceeding MAX_SESSION_SECONDS

  // Actions
  startWork: () => void
  stopWork: () => void            // transitions working → breaking; sets breakEndAt
  setWorkSeconds: (s: number) => void  // called every tick by useTimer from wall clock
  finishBreak: () => void         // break countdown reached zero → 'done'
  skipBreak: () => void           // skip remaining break → 'idle'
  reset: () => void               // called when starting a fresh session from 'done' or 'idle'
  setSelectedTask: (taskId: string | null) => void
  triggerRunaway: () => void      // called by useTimer when session exceeds cap
  dismissRunaway: () => void      // called when user acknowledges the runaway message
}

export const useTimerStore = create<TimerState>((set, get) => ({
  phase: 'idle',
  workSeconds: 0,
  breakEndAt: null,
  breakTotal: 0,
  startedAt: null,
  selectedTaskId: null,
  runawayDetected: false,

  startWork: () => set({
    phase: 'working',
    workSeconds: 0,
    breakEndAt: null,
    breakTotal: 0,
    startedAt: new Date(),
    runawayDetected: false,
  }),

  stopWork: () => {
    const { workSeconds } = get()
    const breakDuration = Math.floor(workSeconds / 5)
    const breakEndAt = new Date(Date.now() + breakDuration * 1000)
    set({ phase: 'breaking', breakEndAt, breakTotal: breakDuration })
  },

  // Called by useTimer every tick — sets workSeconds directly from wall clock (drift-safe)
  setWorkSeconds: (s) => set({ workSeconds: s }),

  finishBreak: () => set({ phase: 'done', breakEndAt: null }),

  skipBreak: () => set({
    phase: 'idle',
    breakEndAt: null,
    breakTotal: 0,
    workSeconds: 0,
    startedAt: null,
    // selectedTaskId intentionally kept — allows quick restart on the same task
  }),

  reset: () => set({
    phase: 'idle',
    workSeconds: 0,
    breakEndAt: null,
    breakTotal: 0,
    startedAt: null,
    runawayDetected: false,
    // selectedTaskId intentionally kept
  }),

  setSelectedTask: (taskId) => set({ selectedTaskId: taskId }),

  // Caps the session at MAX_SESSION_SECONDS and transitions to 'done' with a flag.
  // TimerPage detects this via a useEffect on runawayDetected and fires useSessionSave
  // automatically (since no user button press triggers the save in this case).
  triggerRunaway: () => {
    const breakDuration = Math.floor(MAX_SESSION_SECONDS / 5)
    set({
      phase: 'done',
      workSeconds: MAX_SESSION_SECONDS,
      breakEndAt: null,
      breakTotal: breakDuration,
      runawayDetected: true,
    })
  },

  dismissRunaway: () => set({ runawayDetected: false }),
}))
```

**Critical design notes:**

1. **No `tickWork` or `tickBreak` — both timers are wall-clock-anchored.** `useTimer` (§9.4) reads `startedAt` and `breakEndAt` from the store and computes elapsed/remaining time via `Date.now()`. This prevents drift when the browser tab is throttled or backgrounded.

2. **`selectedTaskId` is preserved across `skipBreak` and `reset`** — this is intentional UX. The user can immediately start another session on the same task without re-selecting it.

3. **`done → working` transition:** When the user clicks "Start working" from the `done` phase, call `startWork()` directly. It resets `workSeconds`, `startedAt`, etc. and sets `phase: 'working'`. There is no separate idle step required — `startWork` is idempotent from any phase.

4. **Runaway detection:** When `runawayDetected` is true, `TimerPage` renders a non-blocking inline warning below `SessionSummary`: *"Looks like you left the timer running. We capped this session at 6 hours."* The user can dismiss it. The capped session is still saved to the database.

### 8.3 TanStack Query client

`src/lib/queryClient.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,    // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

Wrap the app in `<QueryClientProvider client={queryClient}>` in `App.tsx`.

### 8.4 App.tsx provider order

```tsx
// src/app/App.tsx
import { UserProvider } from '@/context/UserContext'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Router } from './Router'

export function App() {
  return (
    <UserProvider>
      <QueryClientProvider client={queryClient}>
        <Router />
      </QueryClientProvider>
    </UserProvider>
  )
}
```

`UserProvider` must be outermost because `QueryClientProvider` hooks may call `useUser()` (e.g., in enabled guards), and the router renders `AuthGuard` which also calls `useUser()`.

---

## 9. Feature: Timer

### 9.1 Overview

The Timer page is the default/home screen. It is the primary focus experience. It should feel calm and focused — minimal visual noise. The session management (save to DB) happens automatically when the user finishes a session.

### 9.2 Page layout (`TimerPage.tsx`)

```
┌─────────────────────────────────────┐
│  [Task selector dropdown]           │
│                                     │
│                                     │
│         00:00                       │  ← TimerClock (80px, light weight)
│    Break earned: 00:00              │  ← secondary line
│                                     │
│   [Start working]                   │  ← TimerControls
│                                     │
│  ─────────────────────────────────  │
│  Today: 3 sessions · 1h 24m        │  ← quick daily summary
└─────────────────────────────────────┘
```

Content is centered horizontally and vertically in the main area. The clock is the dominant element. Everything else recedes.

### 9.3 Timer phases and UI behavior

**Idle phase:**
- Clock shows `00:00` in ink-primary color
- Secondary line: "Select a task to begin" (if no task selected) or the selected task name
- Single button: "Start working" (filled, warm off-white background)
- Task selector visible

**Working phase:**
- Clock counts up: `workSeconds` derived from `Date.now() - startedAt.getTime()`
- Clock color: ink-primary
- Secondary line: "Break earned: MM:SS" (updates live as `Math.floor(workSeconds / 5)`)
- Button changes to "Done, take a break" (outlined, no fill)
- Task selector locked (grayed, non-interactive — you can't change task mid-session)
- A very subtle pulsing dot (2px, amber) appears somewhere near the clock to indicate the session is live

**Breaking phase:**
- Clock shows remaining break time counting down: computed as `Math.ceil((breakEndAt.getTime() - Date.now()) / 1000)`
- Clock color transitions to teal (`#4ec9b0`)
- Secondary line: "You earned MM:SS — take it easy"
- Two buttons: "Skip break" (text only, small); break ends naturally when countdown hits 0
- When break reaches 0, fire desktop notification + audio tone, and auto-transition to Done phase

**Done phase (break complete):**
- Clock shows `00:00`
- Secondary line: "Break complete — ready for the next session"
- Button: "Start working" again (calls `startWork()` directly — no idle step needed)
- Session was already saved to DB at the `stopWork` transition
- `SessionSummary` component is shown (see §9.8)
- If `runawayDetected` is true, show the runaway warning message above `SessionSummary`

### 9.4 `useTimer` hook

`src/features/timer/hooks/useTimer.ts`

This hook owns the `setInterval`. It derives both elapsed work time and remaining break time from wall-clock timestamps — never by incrementing a counter. This prevents drift.

Browsers throttle `setInterval` in background tabs to as little as once per minute. To handle this, a `visibilitychange` listener immediately snaps the displayed time to the correct wall-clock value when the user refocuses the tab, without waiting up to 60 seconds for the next interval tick.

```ts
import { useEffect } from 'react'
import { useTimerStore, MAX_SESSION_SECONDS } from '@/features/timer/stores/timerStore'

export function useTimer() {
  const {
    phase,
    startedAt,
    breakEndAt,
    setWorkSeconds,
    finishBreak,
    triggerRunaway,
  } = useTimerStore()

  useEffect(() => {
    if (phase !== 'working' && phase !== 'breaking') return

    const tick = () => {
      if (phase === 'working' && startedAt) {
        const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000)

        // Runaway session guard: if elapsed time exceeds the cap (e.g. the user
        // left the tab open overnight), auto-stop the session and flag it.
        // TimerPage will detect runawayDetected and trigger the session save.
        if (elapsed >= MAX_SESSION_SECONDS) {
          triggerRunaway()
          return
        }

        setWorkSeconds(elapsed)
      } else if (phase === 'breaking' && breakEndAt) {
        const remaining = Math.ceil((breakEndAt.getTime() - Date.now()) / 1000)
        if (remaining <= 0) {
          finishBreak()
        }
        // TimerClock reads breakEndAt directly — no separate state needed here
      }
    }

    const interval = setInterval(tick, 1000)

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [phase, startedAt, breakEndAt, setWorkSeconds, finishBreak, triggerRunaway])
}
```

**Important:** `TimerClock` derives break countdown display directly from `breakEndAt`:
```ts
const remaining = breakEndAt
  ? Math.max(0, Math.ceil((breakEndAt.getTime() - Date.now()) / 1000))
  : 0
```
There is no separate `breakSeconds` counter in the store — `breakEndAt` is the single source of truth for break progress.

Call `useTimer()` once, at the top of `TimerPage.tsx`. Do not call it from child components.

### 9.5 `useSessionSave` hook

`src/features/timer/hooks/useSessionSave.ts`

A `useMutation` that inserts a completed work session into the `sessions` table.

```ts
// Mutate with:
{
  user_id: user.id,
  task_id: selectedTaskId,          // may be null
  work_seconds: workSeconds,        // already capped at MAX_SESSION_SECONDS if runaway occurred
  break_seconds: Math.floor(workSeconds / 5),
  started_at: startedAt.toISOString(),
  ended_at: new Date().toISOString(),
}
```

On success: invalidate the `['sessions']` query key so stats auto-refresh.

> **Session save failure — full behaviour spec:** If the mutation fails (network error, Supabase unavailable, RLS violation):
>
> 1. Show an inline error banner directly below `TimerControls`: *"Couldn't save session — check your connection. You focused for [formatted work time]."* The banner includes the session duration so the user can log it manually if they care. The banner has a dismiss (×) button.
> 2. **Do not block the break phase.** The user's flow continues normally. The break countdown runs. Notifications and audio still fire at break end.
> 3. **No automatic retry.** TanStack Query mutations do not retry by default, and this spec does not override that. The global `QueryClient` config sets `retry: 1` for *queries* only — this has no effect on mutations. A failed session save is gone.
> 4. **The session data is not recoverable** after dismissal — there is no local cache or drafts system. This is an explicit non-goal (see §1).

### 9.6 Runaway session auto-save

When `triggerRunaway()` fires in `useTimer`, the store transitions directly to the `done` phase — no user button press occurs, so the normal save flow (clicking "Done, take a break") never runs. `TimerPage` must detect this and trigger the save automatically.

Add the following `useEffect` to `TimerPage.tsx`:

```tsx
const { runawayDetected, startedAt, selectedTaskId } = useTimerStore()
const saveSession = useSessionSave()
const { user } = useUser()

useEffect(() => {
  if (runawayDetected && startedAt && user) {
    saveSession.mutate({
      user_id: user.id,
      task_id: selectedTaskId,
      work_seconds: MAX_SESSION_SECONDS,
      break_seconds: Math.floor(MAX_SESSION_SECONDS / 5),
      started_at: startedAt.toISOString(),
      ended_at: new Date().toISOString(),
    })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [runawayDetected])
```

The dependency array is intentionally limited to `runawayDetected` — the effect should fire exactly once when the flag flips to true, not on every render.

### 9.7 Task selector (`TaskSelector.tsx`)

A dropdown/combobox at the top of the Timer page. Shows all active tasks (where `completed_at is null`), grouped by category. The category name is shown as a non-selectable group header. Each task row shows a small colored dot (the category/task color) and the task name.

There is also a "No task" option at the top which sets `selectedTaskId` to null.

The selected task's color dot and name appear in a small pill above the clock when a task is selected. This gives visual confirmation without being intrusive.

When in "working" phase, the selector is disabled.

### 9.8 Today's summary row

At the bottom of the Timer page, show a quiet one-line summary using data from `useQuery`:
- Number of sessions completed today
- Total work time today (formatted as "Xh Ym" or "Ym")

Query: `select count(*), sum(work_seconds) from sessions where user_id = $1 and started_at >= today`.

### 9.9 Session summary (`SessionSummary.tsx`)

Shown only in the `done` phase, below `TimerControls`. A quiet inline card (not a modal) that shows the stats for the session that just completed:

```
┌──────────────────────────────────┐
│  Session complete                │
│  Focused for  1h 12m             │
│  Break earned  14m               │
│  Task: Problem Set 7  [dot]      │
└──────────────────────────────────┘
```

Props: `workSeconds`, `breakTotal`, `taskName` (string | null), `taskColor` (string | null).

This component reads from the Zustand store snapshot at the moment the done phase begins. It displays using `formatDuration(workSeconds)` and `formatClock(breakTotal)`. It disappears when the user clicks "Start working" again.

---

## 10. Feature: Tasks

### 10.1 Overview

The Tasks page manages categories and tasks. It is not a full to-do list manager — it is a simple, clean list of things the user might work on. Tasks persist until explicitly completed. Completed tasks disappear from the list.

### 10.2 Page layout (`TasksPage.tsx`)

```
┌─────────────────────────────────────┐
│  [+ New category]                   │
│                                     │
│  [All] [MATH 301] [ML Course] [...]  │  ← CategoryTabs
│                                     │
│  ── MATH 301 ──────────────────     │
│  ⠿ ○ Problem Set 7            ⋯     │
│  ⠿ ○ Midterm Review           ⋯     │
│  [+ Add task]                       │
│                                     │
└─────────────────────────────────────┘
```

### 10.3 Category tabs (`CategoryTabs.tsx`)

Horizontal scrollable tab row. Each tab is the category name with a small colored dot. The "All" tab is always first and shows tasks from all categories merged. A "+" icon at the end opens the add-category modal.

Active tab is indicated by a bottom border (the category's color, or off-white for "All") and slightly brighter text — NOT a filled background. The tab design is minimal.

On the "All" tab, tasks are grouped by category with category name headers.

Tabs can be right-clicked (or long-pressed on mobile) to get options: Rename, Change color, Delete. Deleting a category does not delete its tasks — they become uncategorized (set null in category_id).

### 10.4 Task list (`TaskList.tsx` + `TaskItem.tsx`)

Each task row:
- Left: a `GripVertical` icon (Lucide) drag handle for reordering (see §10.5 for drag-and-drop spec)
- A colored left-border accent (2px, category/task color)
- A circle checkbox button — clicking it marks the task complete (sets `completed_at`)
- The task name (editable inline on double-click — see editing spec below)
- Right: a `⋯` overflow menu with: Edit name, Change color (only if uncategorized), Move to category, Delete
- If the task has subtasks, a small chevron to expand the subtask list inline

Completing a task: animate the row out (slide + fade, 300ms), then remove from the list. The task is archived in the DB, not deleted.

**Task completion animation:** Do not remove the item from the React state immediately. First set a local `completing` CSS class that plays the exit animation. After 300ms, call the mutation and let React Query's cache update remove it.

> **Task editing — full UX spec:** Editing is available via two entry points: double-clicking the task name, or clicking "Edit name" in the `⋯` overflow menu. Both produce the same behaviour.
>
> **Inline name edit:**
> 1. The task name text is replaced with a single-line `<input>` pre-filled with the current name. The input is auto-focused and the text is selected.
> 2. **Save:** Press Enter, or click anywhere outside the input (onBlur). Call `updateTask({ name: newName.trim() })`. If the trimmed value is empty, revert to the original name without saving.
> 3. **Cancel:** Press Escape. Revert to the original name without saving. No mutation fires.
> 4. The task selector on the Timer page is locked during an active edit — task mid-rename cannot be changed.
>
> **Move to category (`useTasks` mutation: `moveTask`):**
> The `⋯` overflow menu shows a "Move to category" item that opens a submenu listing all the user's categories plus a "Remove from category" option at the top. Selecting a category sets `category_id` on the task. Selecting "Remove from category" sets `category_id` to null and assigns the task a color (the first COLOR_PRESET if it has none). On success, invalidate `['tasks', userId]`.
>
> **Change color:**
> Only shown in the overflow menu when `category_id` is null (uncategorized tasks). Clicking it opens the `ColorPicker` component inline below the task row (not in a modal). Selecting a color calls `updateTask({ color: newColor })` immediately.
>
> **Delete:**
> No confirmation dialog for individual task delete — this is a personal tool with low consequence. The row animates out (same as completion animation) and the task is hard-deleted from the DB (not archived). Hard-deleting a task sets `task_id` to null on any sessions that referenced it, per the `on delete set null` FK constraint in §6.4. This is acceptable — the session time is still recorded, just unattributed.

### 10.5 Drag-and-drop reordering

Tasks and categories can be reordered via drag and drop. Use the HTML5 Drag and Drop API — no additional library is needed.

**Drag handle:** Each row has a `GripVertical` icon (Lucide) on the left. The handle element has `draggable={false}` itself; the parent row has `draggable={true}` and the drag is initiated via `onMouseDown` on the handle (set `e.currentTarget.parentElement.draggable = true` on press, and reset on release). This prevents accidental drags when the user clicks text or buttons.

**Drag events on each row:**
- `onDragStart`: store the dragged item's id in a ref or local state
- `onDragOver`: `e.preventDefault()` to allow drop; apply a visual gap/highlight to indicate insertion point
- `onDrop`: compute new fractional position (midpoint between neighbours), call `reorderTask` or `reorderCategory` mutation
- `onDragEnd`: clear all drag state

**Visual feedback:** When dragging, the dragged row renders at 50% opacity. A 2px accent line appears between rows to indicate the drop target position.

**Subtask reordering** follows the same pattern inside the expanded subtask list.

### 10.6 Adding tasks (`AddTaskForm.tsx`)

A "+ Add task" text button at the bottom of each category section. Clicking it expands an inline input field (not a modal). The user types the task name and presses Enter or clicks a checkmark to save. Pressing Escape cancels. The input should auto-focus when it appears.

### 10.7 Adding categories (`AddCategoryForm.tsx`)

Opens a small modal. Fields:
- Category name (text input, required)
- Color picker (20 preset swatches in a grid + "Custom" swatch that opens the native color wheel)

Submit creates the category and switches the active tab to it.

### 10.8 Color picker (`ColorPicker.tsx`)

A reusable component used in both the Add Category modal and the task overflow menu (for uncategorized tasks).

```
Layout:
- 4×5 grid of circular color swatches (20 presets)
- At the end: a "custom" circle swatch that shows a color wheel icon
- Currently selected color has a white ring/outline around it
```

Use a `useRef` to open the native color input programmatically — do not use `document.querySelector`:

```tsx
import { useRef } from 'react'

interface ColorPickerProps {
  value: string
  onChange: (color: string) => void
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  return (
    <div className="grid grid-cols-[repeat(5,1fr)] gap-2">
      {COLOR_PRESETS.map((hex) => (
        <button
          key={hex}
          onClick={() => onChange(hex)}
          style={{ backgroundColor: hex }}
          className={`h-7 w-7 rounded-full transition-shadow ${
            value === hex ? 'ring-2 ring-white ring-offset-1 ring-offset-surface-base' : ''
          }`}
        />
      ))}

      {/* Custom color swatch */}
      <button
        onClick={() => colorInputRef.current?.click()}
        className="flex h-7 w-7 items-center justify-center rounded-full border border-surface-border"
      >
        {/* color wheel icon SVG or Lucide Palette icon */}
      </button>

      <input
        ref={colorInputRef}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
    </div>
  )
}
```

### 10.9 Subtasks (`SubtaskList.tsx`)

Shown when a TaskItem is expanded (chevron click). The subtask list is indented under the parent task. Each subtask has the same left-border accent color as the parent. Subtasks can be:
- Added inline (same "+ Add subtask" pattern)
- Marked complete (sets `completed_at` on the subtask row only — does NOT complete the parent task)
- Deleted
- Reordered via drag and drop (same pattern as tasks, see §10.5)

Completed subtasks disappear from the list. A completed subtask count badge shows on the parent task row: "3/5 done" in tertiary text — this is computed from subtask data.

### 10.10 Data hooks

**`useCategories`** — `useQuery(['categories', userId])` — fetches all categories for the user, ordered by `position, created_at`.

Mutations exposed: `addCategory`, `renameCategory`, `recolorCategory`, `deleteCategory`, `reorderCategory`.

> `addCategory` mutation: When inserting, compute the new position as `Math.max(...existingPositions) + 1` from the current query cache to append at the end. Read the cached data via `queryClient.getQueryData<Category[]>(['categories', user?.id])` before issuing the insert:
> ```ts
> const existing = queryClient.getQueryData<Category[]>(['categories', user?.id]) ?? []
> const maxPosition = existing.length > 0 ? Math.max(...existing.map(c => c.position)) : -1
> // insert with position: maxPosition + 1
> ```

> `reorderCategory` mutation: Accepts `{ id, newPosition: number }`. Writes the new `position` value to Supabase. After the write, checks whether the gap between the reordered item and its new neighbours has fallen below `0.0001`. If so, runs a follow-up batch `upsert` that resets all categories for the user to integer positions `0, 1, 2, …` (ordered by current `position`). See §6.6 for the full renormalization policy.

**`useTasks`** — `useQuery(['tasks', userId])` — fetches all active (non-completed) tasks with their category info. Use a Supabase join: `tasks.*, categories(name, color)`.

Mutations exposed: `addTask`, `updateTask` (name and/or color), `completeTask`, `deleteTask`, `moveTask` (change `category_id`), `reorderTask`.

> `addTask` mutation: Same position logic as `addCategory` — compute `Math.max(...positionsInCategory) + 1` from the cache.

> `reorderTask` mutation: Same renormalization logic as `reorderCategory`, scoped to tasks for the current user. `moveTask` (changing category) resets the task's `position` to `Math.max(...tasksInNewCategory) + 1` — it always appends to the end of the new category, never mid-list.

**`useSubtasks(taskId)`** — `useQuery(['subtasks', taskId])` — fetches subtasks for a given task, active only.

Mutations exposed: `addSubtask`, `renameSubtask`, `completeSubtask`, `deleteSubtask`, `reorderSubtask`.

All mutations (add, rename, complete, delete, reorder) invalidate the relevant query key on success.

---

## 11. Feature: Stats

### 11.1 Overview

The Stats page is for curiosity — the user opens it to see patterns in their focus history. It should feel like an interesting personal dashboard, not a productivity audit. The visualizations should be visually polished and use category colors as the primary visual variable.

### 11.2 Page layout (`StatsPage.tsx`)

```
┌─────────────────────────────────────────────┐
│  [Day] [Week] [Month] [Year]                │  ← TimeRangeSelector
│                                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 12       │ │ 8h 34m   │ │ 6 day    │    │  ← SummaryCards
│  │ Sessions │ │ Focus    │ │ Streak   │    │
│  └──────────┘ └──────────┘ └──────────┘    │
│                                             │
│  Focus time by day ─────────────────────   │
│  [DailyBarChart]                            │
│                                             │
│  Activity heatmap ──────────────────────   │
│  [HeatmapGrid]                              │
│                                             │
│  Time by category ──────────────────────   │
│  [CategoryBreakdown]                        │
│                                             │
│  Time by task ──────────────────────────   │
│  [TaskBreakdown]                            │
└─────────────────────────────────────────────┘
```

### 11.3 Time range selector (`TimeRangeSelector.tsx`)

Four options: Day, Week, Month, Year. Default: Week. This is a simple pill toggle — plain text buttons, the active one has a subtle filled background. Changing the range re-queries all chart data and re-renders.

The date range corresponding to each option:
- Day: today (midnight to now)
- Week: last 7 days
- Month: last 30 days
- Year: last 365 days

### 11.4 Summary cards (`SummaryCards.tsx`)

Three stat cards in a row:
1. **Sessions** — count of sessions in the selected range
2. **Focus time** — total `sum(work_seconds)` formatted as "Xh Ym"
3. **Current streak** — consecutive days with at least one session (computed in JS from session data, not DB)

Cards are dark surface raised (`bg-surface-raised`), no border, minimal padding. The number is large (32px, 400 weight), the label below is small (11px, 500 weight, uppercase, tertiary color).

### 11.5 Daily bar chart (`DailyBarChart.tsx`)

A stacked bar chart (Recharts `BarChart` with `Bar` stacked). Each bar is stacked by category — each segment colored with the category color. Days with no sessions show an empty bar. Y-axis label: "hours". Chart height: 200px.

- **Day range:** X-axis = hours of the day (0–23), one bar per hour, data from `aggregateByHour()`
- **Week range:** X-axis = 7 days, one bar per day, data from `aggregateByDay()`
- **Month range:** X-axis = 30 days, one bar per day, data from `aggregateByDay()`
- **Year range:** X-axis = 52 weeks, one bar per ISO week, data from `aggregateByWeek()`

The chart does not have a visible legend. On hover/tooltip, show the date/period label, total time, and breakdown by category.

### 11.6 Heatmap grid (`HeatmapGrid.tsx`)

A GitHub-style contribution heatmap. Always shows the last 52 weeks (full year) regardless of the time range selector — the time range selector does NOT affect this component. The heatmap is the year-at-a-glance.

Grid layout: 7 rows (days of the week, Mon–Sun) × 52 columns (weeks). Each cell is a 12×12px square with 2px gap. Month labels appear above the columns.

Cell color: the user's most-used category color for that day, at varying opacity:
- No sessions: `surface-border` color (very dim)
- 1–30 min: category color at 30% opacity
- 30–60 min: 55% opacity
- 60–120 min: 80% opacity
- 120+ min: 100% opacity

If multiple categories were used in a day, use the color of the dominant category (most time spent). This gives the heatmap a "what was I working on" character beyond just streak tracking.

Tooltip on hover: date, total time, breakdown of categories.

### 11.7 Category breakdown (`CategoryBreakdown.tsx`)

A horizontal bar chart. One bar per category. X-axis: total hours in the selected range. Bars are colored with the category color. Sorted descending by total time.

To the right of each bar, show the formatted total time. Below the bar, in tertiary text, show the session count.

Built with Recharts `BarChart` layout="vertical".

### 11.8 Task breakdown (`TaskBreakdown.tsx`)

Same as category breakdown but one bar per task (within the selected range, tasks that had at least one session). Bars are colored by the task's category color. The category name appears in tertiary text below each task name.

### 11.9 `useStats` hook

`src/features/stats/hooks/useStats.ts`

A single hook that accepts the current time range and returns all the data the stats page needs. It makes **three** separate queries:
1. Sessions for the selected range (drives bar chart, breakdowns, summary cards)
2. Sessions for the fixed 365-day heatmap window (always a full year, independent of the range selector)
3. All sessions ever, for accurate streak calculation — uses only `started_at` with no join, so it is lightweight even as history grows

The streak query is intentionally unbounded. Computing it from the 365-day heatmap window would silently undercount a streak longer than 365 days.

```ts
type TimeRange = 'day' | 'week' | 'month' | 'year'

interface StatsData {
  sessions: SessionWithTask[]
  totalSessions: number
  totalWorkSeconds: number
  currentStreak: number
  longestStreak: number
  byDay: DaySummary[]              // for bar chart; byHour for day range, byWeek for year range
  byCategory: CategorySummary[]    // for category breakdown
  byTask: TaskSummary[]            // for task breakdown
  allDays: HeatmapDay[]            // always last 365 days, for heatmap
}

export function useStats(range: TimeRange): StatsData & { isLoading: boolean; error: unknown } {
  const { user } = useUser()
  const { from, to } = getRangeDates(range)

  // Query 1: sessions for the selected range
  const rangeQuery = useQuery({
    queryKey: ['sessions', user?.id, { range, from: from.toISOString() }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('*, tasks(name, color, category_id, categories(name, color))')
        .eq('user_id', user!.id)
        .gte('started_at', from.toISOString())
        .lte('started_at', to.toISOString())
        .order('started_at', { ascending: true })
      if (error) throw error
      return data as SessionWithTask[]
    },
    enabled: !!user,
  })

  // Query 2: full year for heatmap
  const heatmapQuery = useQuery({
    queryKey: ['sessions', user?.id, 'heatmap'],
    queryFn: async () => {
      const yearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const { data, error } = await supabase
        .from('sessions')
        .select('*, tasks(name, color, category_id, categories(name, color))')
        .eq('user_id', user!.id)
        .gte('started_at', yearAgo.toISOString())
        .order('started_at', { ascending: true })
      if (error) throw error
      return data as SessionWithTask[]
    },
    enabled: !!user,
  })

  // Query 3: all sessions ever, minimal columns, for streak calculation
  const streakQuery = useQuery({
    queryKey: ['sessions', user?.id, 'streak'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select('id, started_at, work_seconds')
        .eq('user_id', user!.id)
        .order('started_at', { ascending: true })
      if (error) throw error
      return data as Pick<Session, 'id' | 'started_at' | 'work_seconds'>[]
    },
    enabled: !!user,
  })

  const sessions = rangeQuery.data ?? []
  const allSessions = heatmapQuery.data ?? []
  const streakSessions = streakQuery.data ?? []

  const streak = computeStreak(streakSessions)

  return {
    isLoading: rangeQuery.isLoading || heatmapQuery.isLoading || streakQuery.isLoading,
    error: rangeQuery.error ?? heatmapQuery.error ?? streakQuery.error,
    sessions,
    totalSessions: sessions.length,
    totalWorkSeconds: sessions.reduce((sum, s) => sum + s.work_seconds, 0),
    currentStreak: streak.current,
    longestStreak: streak.longest,
    byDay: range === 'day'
      ? aggregateByHour(sessions)
      : range === 'year'
        ? aggregateByWeek(sessions)
        : aggregateByDay(sessions, from, to),
    byCategory: aggregateByCategory(sessions),
    byTask: aggregateByTask(sessions),
    allDays: buildHeatmapData(allSessions),
  }
}
```

---

## 12. Shared Components

### 12.1 `Button.tsx`

Props: `variant` (`'filled' | 'outlined' | 'ghost'`), `size` (`'sm' | 'md' | 'lg'`), `loading` (boolean, shows spinner), `disabled`, plus all native button props.

Never style buttons ad-hoc in feature components. Always use this component.

### 12.2 `Modal.tsx`

A generic modal wrapper. Renders a backdrop overlay + a centered card. Trap focus inside when open. Close on Escape key and on backdrop click. Use React's `createPortal` to render into `document.body`.

Props: `isOpen`, `onClose`, `title` (optional), `children`.

### 12.3 `Input.tsx`

A styled text input. Props: `label` (optional, renders above), `error` (optional, renders below in red), plus all native input props.

### 12.4 `Layout.tsx`

The app shell. Renders:
- Left sidebar (240px, fixed)
  - App name "Flowtime" at the top in 16px, 500 weight
  - Nav links: Timer (home icon), Tasks (checkbox icon), Stats (bar chart icon)
  - Bottom: user avatar circle (initials from Google name), small "Sign out" button
- Main content area: `flex-1`, `overflow-y-auto`, `p-8`

On mobile (Tailwind `md:` breakpoint): sidebar hides, bottom tab bar appears with the three nav icons.

### 12.5 `Badge.tsx`

A small colored pill. Props: `color` (hex string), `label`. Used for category labels in various places.

### 12.6 `Spinner.tsx`

A simple CSS-animated circular spinner. No library. Used for loading states.

### 12.7 `EmptyState.tsx`

Props: `icon`, `title`, `description`, `action` (optional JSX button). Used when lists are empty (no tasks, no sessions, etc.).

### 12.8 `Tooltip.tsx`

A lightweight hover tooltip. Use CSS `title` attribute or a simple hover-show div. No library needed for this.

---

## 13. Routing

`src/app/Router.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthGuard } from '@/features/auth/components/AuthGuard'
import { Layout } from '@/components/ui/Layout'
import { TimerPage } from '@/features/timer/TimerPage'
import { TasksPage } from '@/features/tasks/TasksPage'
import { StatsPage } from '@/features/stats/StatsPage'

export function Router() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Layout>
          <Routes>
            <Route path="/" element={<TimerPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/stats" element={<StatsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthGuard>
    </BrowserRouter>
  )
}
```

The `Layout` component wraps the authenticated routes and provides the sidebar. `AuthGuard` intercepts unauthenticated users and shows the login page (full-screen, outside the Layout).

---

## 14. Notifications & Audio

Both are implemented without any external library — pure Web APIs.

### 14.1 Desktop notifications

`src/lib/notifications.ts`:

```ts
export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title: string, body: string) {
  if (Notification.permission !== 'granted') return
  new Notification(title, { body, icon: '/icon.png' })
}
```

Request permission once — on the first time the user completes a session (not on page load, as that is bad UX and browsers may block it). After that, permission is stored by the browser.

`/icon.png` must be present in the `public/` directory. A simple 192×192px PNG works. Add it as a static asset alongside `index.html`.

Notification triggers:
- Break countdown reaches 0: `sendNotification('Break complete', 'Time to focus again.')`
- (No notification for break start — that's a visual event the user triggers themselves)

### 14.2 Audio

`src/lib/audio.ts`:

Use the Web Audio API to synthesize a soft, pleasant tone. No audio file needed.

A new `AudioContext` is created per call and explicitly closed after the chime finishes. Browsers cap simultaneous `AudioContext` instances (typically to 6). Without closing them, repeated chimes on a long work day would eventually fail silently. The `oscillator.onended` callback handles cleanup.

```ts
export function playDoneChime(): void {
  const ctx = new AudioContext()
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(528, ctx.currentTime)        // C5-ish
  oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.15) // E5
  oscillator.frequency.setValueAtTime(792, ctx.currentTime + 0.3)  // G5

  gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)

  oscillator.start(ctx.currentTime)
  oscillator.stop(ctx.currentTime + 1.2)

  // Close the context after the chime ends to release browser resources
  oscillator.onended = () => {
    ctx.close()
  }
}
```

This plays a gentle three-note ascending chime that fades out over ~1.2 seconds.

Play this chime at the same time as the break-complete notification (when `finishBreak()` fires).

---

## 15. Data Layer & React Query

### 15.1 Query key conventions

Use array keys with a consistent structure:
```ts
['categories', userId]
['tasks', userId]
['subtasks', taskId]
['sessions', userId, { range: 'week', from: '2025-01-01' }]
['sessions', userId, 'heatmap']
['sessions', userId, 'streak']
```

### 15.2 All Supabase queries

Each feature hook wraps a Supabase call in `useQuery`. Example structure showing the full `useCategories` hook including correct position handling for `addCategory`:

```ts
// src/features/tasks/hooks/useCategories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useUser } from '@/hooks/useUser'
import type { Category } from '@/types'

export function useCategories() {
  const { user } = useUser()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('user_id', user!.id)
        .order('position', { ascending: true })
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!user,
  })

  const addCategory = useMutation({
    mutationFn: async (values: { name: string; color: string }) => {
      // Read existing positions from cache to correctly append at the end
      const existing = queryClient.getQueryData<Category[]>(['categories', user?.id]) ?? []
      const maxPosition = existing.length > 0 ? Math.max(...existing.map(c => c.position)) : -1
      const { error } = await supabase.from('categories').insert({
        ...values,
        user_id: user!.id,
        position: maxPosition + 1,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['categories', user?.id] }),
  })

  // ... renameCategory, recolorCategory, deleteCategory, reorderCategory mutations

  return { ...query, addCategory, /* ... */ }
}
```

Follow this same pattern for all hooks. Each hook returns both the query result (data, isLoading, error) and the mutation objects.

### 15.3 Error handling

- If a query fails, show an inline error message near the component that uses it (not a global toast system — keep it simple)
- If a mutation fails, show an error below the relevant form field or inline near the action
- Never silently swallow errors

---

## 16. Environment Variables

Create `.env.local` at the project root (never commit this file — it is in `.gitignore`). Use `.env.example` (committed, no secrets) as the template:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

On Vercel: add these same variables in the Vercel project dashboard under Settings → Environment Variables. Vercel injects them at build time.

---

## 17. Deployment (Vercel)

### 17.1 Initial deploy

1. Push the repo to GitHub.
2. Go to vercel.com → New Project → Import the GitHub repo.
3. Vercel auto-detects Vite. Framework Preset: Vite. Build command: `pnpm build`. Output directory: `dist`.
4. Add the two environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
5. Deploy.

### 17.2 Subsequent deploys

Automatic. Every push to the `main` branch triggers a new production deploy. Every PR gets a preview URL.

### 17.3 `vercel.json`

Required for client-side routing (so that refreshing `/tasks` doesn't 404):

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### 17.4 Custom domain (optional)

In Vercel project → Settings → Domains. Add your domain and follow the DNS instructions.

---

## 18. Code Quality Standards

### 18.1 Principles to follow (non-negotiable)

**DRY** — If you write the same JSX structure twice, extract it into a component. If you write the same logic twice, extract it into a utility function or custom hook. The only exception: if two things look similar today but are genuinely likely to diverge, don't prematurely abstract.

**KISS** — Choose the simpler implementation unless there is a concrete reason not to. No clever abstractions without payoff. Zustand over Redux. A simple `Date.now()` calculation over a time library. `clsx` over complex conditional style objects.

**SOLID (adapted for React):**
- *Single Responsibility*: One component does one thing. `TimerClock` only renders the clock. `useTimer` only manages the interval. `useSessionSave` only saves sessions.
- *Open/Closed*: UI components accept `className` and children so they can be extended without modification.
- *Interface Segregation*: Custom hooks expose only what the component needs — don't return the raw Supabase response, return shaped data.
- *Dependency Inversion*: Components depend on abstractions (hooks), not directly on Supabase.

**SRP in file terms:** Each file has one primary export. No multi-concept files. `Button.tsx` exports `Button`. `useTimer.ts` exports `useTimer`.

### 18.2 TypeScript rules

- Strict mode: enabled.
- No `any`. Use `unknown` and type-narrow, or define a proper type.
- All Supabase table rows have TypeScript types defined in `src/types/index.ts`.
- Generate Supabase types with the CLI. The `supabase` CLI was installed as a dev dependency in §3.2. Run the `update-types` script defined in §3.7:
  ```bash
  pnpm update-types
  ```
  Run this every time you add or modify a database table.

```ts
// src/types/index.ts — define app-level types here, referencing generated Supabase types

import type { Database } from './supabase'

export type Category = Database['public']['Tables']['categories']['Row']
export type Task = Database['public']['Tables']['tasks']['Row']
export type Subtask = Database['public']['Tables']['subtasks']['Row']
export type Session = Database['public']['Tables']['sessions']['Row']

// Extended types with joins
export type TaskWithCategory = Task & {
  categories: Pick<Category, 'name' | 'color'> | null
}
export type SessionWithTask = Session & {
  tasks: (Pick<Task, 'name' | 'color' | 'category_id'> & {
    categories: Pick<Category, 'name' | 'color'> | null
  }) | null
}

// Aggregation types used by stats utilities and useStats
export interface DaySummary {
  // ISO date string 'YYYY-MM-DD' for day/week/month ranges
  // Week start date 'YYYY-MM-DD' for year range
  // Hour key 'YYYY-MM-DDTHH' for day (hour) range
  date: string
  totalSeconds: number
  byCategory: { categoryId: string | null; color: string; seconds: number }[]
}

export interface CategorySummary {
  categoryId: string | null
  categoryName: string
  color: string
  totalSeconds: number
  sessionCount: number
}

export interface TaskSummary {
  taskId: string | null
  taskName: string
  categoryName: string | null
  color: string
  totalSeconds: number
  sessionCount: number
}

export interface HeatmapDay {
  date: string                              // ISO date string 'YYYY-MM-DD'
  totalSeconds: number
  dominantColor: string | null              // hex color of most-used category that day; null if no sessions
}
```

### 18.3 Naming conventions

| Thing | Convention | Example |
|---|---|---|
| Components | PascalCase | `TaskItem.tsx` |
| Hooks | camelCase prefixed with `use` | `useTimer.ts` |
| Stores | camelCase, file ends in `Store` | `timerStore.ts` |
| Utilities | camelCase | `formatSeconds.ts` |
| Types/interfaces | PascalCase | `type TimerPhase` |
| Constants | SCREAMING_SNAKE_CASE | `COLOR_PRESETS` |
| CSS classes | Tailwind utilities only — no custom class names except in `index.css` base layer |

### 18.4 Utility functions

`src/lib/utils.ts` — keep this file as pure functions only. No hooks, no Supabase, no side effects.

**Timezone note:** All date bucketing in aggregation utilities must use the user's **local** time, not UTC. Sessions are stored in the database as UTC `timestamptz`, but grouping by "day" should reflect the user's local midnight. Use `new Date(session.started_at).toLocaleDateString('en-CA')` to produce `'YYYY-MM-DD'` keys in local time — `'en-CA'` reliably formats as ISO date regardless of locale.

Required utilities:
```ts
// Format seconds into "MM:SS" string
export function formatClock(seconds: number): string

// Format seconds into "Xh Ym" human-readable
export function formatDuration(seconds: number): string

// Merge Tailwind classes safely (uses clsx + tailwind-merge)
export function cn(...inputs: ClassValue[]): string

// Get the effective color for a task (category color if categorized, task color otherwise)
export function getTaskColor(task: TaskWithCategory): string

// Compute current and longest streak from array of sessions (sorted by date asc).
// Accepts any array with a started_at field — not tied to SessionWithTask so it
// can be called with the lightweight streak query result from useStats.
// Uses local date (not UTC) for day boundary calculations.
export function computeStreak(sessions: { started_at: string }[]): { current: number; longest: number }

// Aggregate sessions by hour of a single day (0–23), for the Day range bar chart.
// Returns 24 DaySummary entries, one per hour, keyed by 'YYYY-MM-DDTHH' in local time.
// Hours with no sessions are included as empty entries (totalSeconds: 0, byCategory: []).
export function aggregateByHour(sessions: SessionWithTask[]): DaySummary[]

// Aggregate sessions by day for bar chart (day/week/month ranges).
// Keys are local-time 'YYYY-MM-DD' strings.
export function aggregateByDay(sessions: SessionWithTask[], from: Date, to: Date): DaySummary[]

// Aggregate sessions by ISO week for bar chart (year range — returns 52 DaySummary
// entries keyed by week start date in local time)
export function aggregateByWeek(sessions: SessionWithTask[]): DaySummary[]

// Aggregate sessions by category
export function aggregateByCategory(sessions: SessionWithTask[]): CategorySummary[]

// Aggregate sessions by task
export function aggregateByTask(sessions: SessionWithTask[]): TaskSummary[]

// Build heatmap data structure from sessions (last 365 days).
// Day keys are local-time 'YYYY-MM-DD' strings.
export function buildHeatmapData(sessions: SessionWithTask[]): HeatmapDay[]

// Get start/end Date for a given TimeRange relative to now
export function getRangeDates(range: 'day' | 'week' | 'month' | 'year'): { from: Date; to: Date }
```

### 18.5 Linting and formatting

Run before committing:
```bash
pnpm eslint src --ext .ts,.tsx
pnpm prettier --check src
```

Pre-commit hook is configured via `simple-git-hooks` + `lint-staged` (see §3.7).

### 18.6 File length guideline

If a component file exceeds ~200 lines, it is doing too much. Split it. The same applies to hooks at ~100 lines.

### 18.7 Automated testing

No automated tests are required. Do not scaffold Vitest, Testing Library, Playwright, or any other test framework. The build order in §19 specifies manual verification checkpoints at each stage.

The reasoning: this is a single-user personal tool built and maintained by one developer. The cost of a comprehensive test suite outweighs the benefit at this stage. If the project grows in scope or is shared with other users in the future, automated tests should be added at that point, starting with the utility functions in `src/lib/utils.ts` (pure functions — trivially unit-testable) and `useTimer` behaviour.

---

## 19. Build Order

Build the application in this exact order. Each step should be fully working before moving to the next.

**Step 1 — Project scaffold**
- Init Vite + React + TypeScript
- Install all dependencies (including `@vitejs/plugin-react` and `supabase` CLI explicitly)
- Configure Tailwind, fonts, TypeScript paths (in both `tsconfig.json` and `tsconfig.app.json`), Prettier, ESLint, git hooks
- Add `update-types` script to `package.json`
- Create the folder structure (empty files are fine)
- Create `.env.example`
- Add `icon.png` (192×192px) to the `public/` directory
- Confirm `pnpm dev` runs without errors

**Step 2 — Supabase & Auth**
- Create the Supabase project
- Run all SQL schema migrations in order (using `float8` for all `position` columns)
- Run `pnpm update-types` to generate TypeScript types
- Create `supabaseClient.ts`
- Create `UserContext.tsx` and `UserProvider`
- Wrap `App.tsx` with `UserProvider` (outermost) and `QueryClientProvider`
- Create the thin `useUser.ts` re-export hook
- Build `LoginPage` with Google OAuth
- Build `AuthGuard`
- Test: visit the app → see login page → sign in with Google → see a blank authenticated shell

**Step 3 — App shell**
- Build `Layout.tsx` (sidebar + main area)
- Build `Router.tsx` with the three routes
- Build placeholder pages for Timer, Tasks, Stats
- Build sidebar nav with `react-router-dom` `NavLink`
- Confirm navigation works and active states highlight correctly

**Step 4 — Tasks feature (before Timer, because Timer depends on task data)**
- Build `useCategories`, `useTasks`, `useSubtasks` hooks
- Build `CategoryTabs`
- Build `TaskList` + `TaskItem`
- Build `AddTaskForm` (inline)
- Build `AddCategoryForm` (modal)
- Build `ColorPicker` (using `useRef` for the native color input)
- Build `SubtaskList` + subtask add form
- Implement drag-and-drop reordering for tasks, categories, and subtasks (HTML5 DnD + `GripVertical` handle)
- Test: create categories, create tasks, complete tasks, reorder tasks, verify DB state in Supabase dashboard

**Step 5 — Timer feature**
- Build `timerStore` (Zustand) with `runawayDetected` flag and `MAX_SESSION_SECONDS` cap
- Build `useTimer` hook (wall-clock-anchored, drift-safe for both work and break phases, with `visibilitychange` snap and runaway guard)
- Build `useSessionSave` mutation
- Build `TaskSelector`
- Build `TimerClock`
- Build `TimerControls`
- Build `SessionSummary`
- Implement all phase transitions (idle → working → breaking → done → working)
- Add the runaway auto-save `useEffect` in `TimerPage` (§9.6)
- Test: run a full session (work → break → done), verify session saved in DB
- Test runaway detection: manually set `MAX_SESSION_SECONDS` to 5 for testing, verify the cap triggers, the session auto-saves correctly, and the warning banner appears; then restore the original value

**Step 6 — Notifications & Audio**
- Implement `notifications.ts`
- Implement `audio.ts` (with `AudioContext` cleanup via `oscillator.onended`)
- Hook both into the timer's break-complete transition
- Test with browser notifications enabled
- Verify the chime fires on repeated sessions without failing

**Step 7 — Stats feature**
- Build all aggregation utilities in `utils.ts` (`aggregateByHour`, `aggregateByDay`, `aggregateByWeek`, etc.) — all using local-time date bucketing
- Build `useStats` hook (three queries: range, heatmap, unbounded streak)
- Build `SummaryCards`
- Build `TimeRangeSelector`
- Build `DailyBarChart` (Recharts) — verify Day range uses `aggregateByHour`, Year range uses `aggregateByWeek`
- Build `HeatmapGrid`
- Build `CategoryBreakdown`
- Build `TaskBreakdown`
- Test with real session data from Step 5

**Step 8 — Polish**
- All loading states (spinners where data is fetching)
- All empty states (EmptyState component, with helpful messages)
- All error states
- Mobile responsive layout (bottom tab bar)
- Task completion animation (slide out)
- Timer phase color transition (work → break)
- Subtle pulsing dot during active session
- Tooltips on chart elements
- Runaway warning banner in the done phase (dismissable)

**Step 9 — Deploy**
- Add `vercel.json`
- Push to GitHub
- Connect to Vercel
- Add environment variables
- Deploy
- Test on production URL (Google OAuth callback URL must be updated in Supabase and Google Cloud Console to match the production domain)
- Test on a second device to verify cross-device sync works
- Test on mobile viewport to confirm bottom tab bar and responsive layout

---

*End of specification.*
