# Flowtime Human Todo (Final Mile)

Date: 2026-05-13

## What Is Already Done (Agent)

- All build phases 1-8 are implemented and validated.
- Step 9 deploy automation is complete:
  - Vercel project is linked and deployed.
  - SPA rewrite config exists in [vercel.json](vercel.json).
  - Production env vars exist in Vercel:
    - VITE_SUPABASE_URL
    - VITE_SUPABASE_PUBLISHABLE_KEY
    - VITE_SUPABASE_ANON_KEY
  - Production alias responds successfully:
    - https://flowtime-weld.vercel.app
    - https://flowtime-weld.vercel.app/tasks
    - https://flowtime-weld.vercel.app/stats
- Local checks pass:
  - pnpm lint
  - pnpm build

## Remaining Work (Human Only)

These require your account access and browser-based console actions.

1. Supabase Auth URL configuration
   - Owner: Human
   - In Supabase Dashboard -> Authentication -> URL Configuration:
     - Set Site URL to your production domain.
     - Ensure Redirect URLs include both production and localhost (http://localhost:5173).

2. Google Cloud OAuth configuration alignment
   - Owner: Human
   - In Google Cloud Console (OAuth client):
     - Ensure authorized redirect URI matches Supabase callback requirements.
     - Ensure authorized origins/domains align with production usage.

3. Production sign-in validation
   - Owner: Human
   - Open production app and confirm Google login succeeds end-to-end.

4. Cross-device sync validation
   - Owner: Human
   - Sign in on a second device and verify the same tasks/sessions appear.

5. Mobile UX validation
   - Owner: Human
   - Confirm bottom tab bar and main flows on phone viewport/device.

## Optional But Recommended (Human)

1. Commit and push final deployment/config docs
   - Owner: Human
   - Current repo includes deployment-related changes (README + vercel.json + env template/ignore updates).

## When To Bring Copilot Back

Bring me back after you finish the human-only items above.

What I can do immediately after that:

1. Run a final verification sweep (lint/build + production route checks).
2. Update project status docs to mark Step 9 complete.
3. Create a concise release/closeout checklist from the final state.
