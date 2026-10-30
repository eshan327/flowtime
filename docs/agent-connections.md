# Flowtime assistant integration

Flowtime uses one Supabase Edge Function at `https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent` for MCP and JSON tools. Both transports share strict schemas and user-bound database operations. The browser calls those same operations. The assistant supplies intelligence; no model calls or OpenAI API key are required.

## Tools and workflows

The original seven names remain available. There are fourteen tools:

| Tool | Behavior |
| --- | --- |
| `list_tasks` | Search/filter active/completed tasks, context, categories, selectable tasks, and explicit trash |
| `list_categories` | Search/filter categories, archive status, and explicit trash |
| `create_task`, `update_task` | Compatible single-task operations, optional color/context fields |
| `manage_tasks` | Atomic batches for creation, editing, reordering, trash and restoration |
| `manage_categories` | Create, rename, recolor, reorder, archive/unarchive, trash and restore |
| `list_sessions`, `get_session` | Full saved history and individual details, including notes and snapshots |
| `manage_sessions` | Explicit manual entry, corrections, soft-delete and restoration |
| `get_focus_summary` | Complete totals, counts, streaks, snapshot breakdowns, daily trends and calendar-day hourly data |
| `get_timer`, `control_timer` | Server timer state and revision-checked commands; compact MCP Apps controls |
| `get_settings`, `update_settings` | Actual synced settings, revision checks and reset |

Management tools accept typed `operations`, a stable UUID `request_id`, and at most 50 operations within the 16 KiB request limit. Batches commit completely or roll back. Bulk trash requires the user's confirmation and `confirmed: true`. There is no permanent-delete or arbitrary-SQL tool.

Task/category trash preserves IDs, ordering, membership, completion and archive status. Trashing a category hides its tasks without separately trashing them. Restore the category first; individually trashed tasks stay in Trash. A restored archived category stays archived. Optional task context consists of notes (4,000 characters), a date-only due date, low/normal/high priority, and an HTTP(S) reference URL.

## History, ranges and statistics

History bounds use explicit-offset ISO timestamps and `[from,to)` semantics. Omit bounds for all time; the previous 90-day limit is removed. Search includes notes and attribution. Normal lists exclude deleted sessions; recovery explicitly requests trash.

Follow `next_cursor` until all requested rows/breakdown pages are read. Cursors bind the dataset revision and filters; an intervening mutation returns a restartable conflict rather than silently combining incompatible pages. Legacy `next_offset` remains supported. Summary totals/counts/streaks are complete on each page, while detailed breakdowns/trends may span pages. There is no 10,000-session truncation. Saved totals exclude unsynchronized offline work.

Calendar day/week/month/year periods use the account's IANA timezone (or an explicit query timezone); weeks start Sunday. Boundaries account for DST. Allocation uses differences of rounded cumulative proportions so adjacent windows retain recorded totals. Browser history, Insights and exports use the same read operations and allocation rules. CSV/JSON exports include entry source and work-run IDs.

Editing notes/timing preserves snapshots. Explicitly changing task attribution replaces the task/category snapshots. New manual entries require actual user-reported work, valid past timestamps and nonnegative durations fitting elapsed time; they are labeled `manual`. Historical timer entries retain their original snapshots through renames, trash, archive and restoration.

## Timer commands and offline recovery

`control_timer` requires a stable `request_id` and the latest `expected_revision` from `get_timer`. Commands select a task, start/stop work, finish/skip a break, or acknowledge runaway work. Reusing an identical request ID returns the recorded result before revision checks; changing its arguments fails. A stale revision requires refreshing and reconsidering the action.

A per-user database lock serializes commands. The timer transition, segment history, snapshots, new revision and command receipt commit together. New work requires an incomplete, available task in an active category. Focus lock is enforced centrally. Existing work remains stoppable after its task becomes unavailable.

Switching tasks while working commits the previous segment and continues immediately. Segment IDs differ but share one continuous run ID. Break credit and the six-hour cap span the whole run. The divisor is frozen at run start; later settings apply to future runs. Stopping starts the earned break. Pause is unsupported. Runaway work is capped and requires acknowledgement before restarting.

The browser stores each command durably before changing its local display. Separate localStorage records preserve concurrent branches, and dependency ordering preserves replay order. Stable IDs make uncertain responses safe to retry. A server-calibrated clock detects wall-clock jumps or an uncalibrated offline reload; uncertain timestamps are retained for review rather than automatically replayed. The existing IndexedDB session outbox remains intact and continues retrying pre-upgrade saves. An already-saved legacy segment is adopted without being rewritten or saved twice.

Conflicting offline actions retain their candidate work and load the server result. The recovery screen compares candidates with saved history, offers explicit manual import of uncovered time, and separately confirms discarding a local action. It does not overwrite history or automatically invent duplicate sessions. Old tabs cannot overwrite command-managed timer state or segment history; they must reload. Device storage failure prevents an unqueued optimistic command.

The server cannot know uncommitted actions on offline devices. The compact ChatGPT panel derives its clock from server timestamps and calls the same tools through the MCP Apps host bridge. Preferences do not control ChatGPT's device-local audio or OS shortcuts.

## OAuth and database security

Keep the existing project, exact resource audience, Auth token hook, endpoint, clients and callbacks. Dynamic registration remains disabled. No service-role key is used by the browser or agent.

The Edge Function checks signature, issuer, expiry, authenticated/non-anonymous identity, exact resource audience, live user existence and `FLOWTIME_AGENT_CLIENT_IDS`. Database operations independently derive the owner from `auth.uid()`, validate the audience/trusted client, and require a version-2 per-user/client approval for expanded operations. Internal privileged implementations live in `private`; exposed RPC wrappers are invoker functions. Private tables/helpers are not directly accessible to client roles.

Legacy basic task operations remain available through narrowly validated `legacy_tasks` commands. New task context/trash fields cannot be written through legacy direct OAuth table permissions. Existing restrictive policies still block direct OAuth timer/history/settings/category writes, subtasks and Storage. Recovery reads and new privileged operations require expanded approval.

Approve expanded access in the authenticated Flowtime `/connections` screen for the existing connection. Consent describes the new capabilities. Disabling expanded control removes that approval immediately. Revoking also revokes OAuth refresh grants; basic access tokens can remain valid until expiry. Only normal signed-in browser sessions can grant expanded control; agent tokens cannot approve themselves.

Current registered clients are ChatGPT (`f63444b4-d1b2-448d-b20c-194048a94eac`) and Muse (`7b56d04e-3de8-4475-97e0-f153c34810d0`). The ChatGPT callback remains `https://chatgpt.com/connector/oauth/-_-dxb_gDlGD`, auth method `none`, with `openid offline_access`. Do not recreate the connection or client.

## Release and verification

The schema-only baseline is in `supabase/baseline/20261029.json`; it is a reference/test fixture, not a production migration. Existing historical migrations remain committed. Apply only pending additive migrations; never reset production. Regenerate types after applying schema changes.

Roll out schema and gated operations, configure the trusted-client registry from the existing verified registrations, deploy the agent, release the browser, update the existing plugin packages, then refresh and verify the host tool list. Expanded writes stay gated until browser consent. Rollback disables expanded approval and restores application code while retaining additive schema/data.

Keep these existing identities:

- [Portable Flowtime plugin](https://chatgpt.com/plugins/plugins_6acd74e367fc81919cef8d88c11ad20b)
- [Connected Flowtime plugin](https://chatgpt.com/plugins/plugin_asdk_app_6acd75a1a27481919a2966117f44f02f)
- [Live Flowtime app](https://flowtimeboard.vercel.app)

Public discovery stays unauthenticated (`verify_jwt = false` at the function gateway); every tool request is authenticated by the handler. Existing Edge Function environment values are preserved: `FLOWTIME_PUBLISHABLE_KEY`, `FLOWTIME_AGENT_URL`, `FLOWTIME_AGENT_CLIENT_IDS`, and Supabase's `SUPABASE_URL`.

Run `pnpm test`, `pnpm lint`, `pnpm build`, `pnpm format:check`, and `deno check --config supabase/functions/agent/deno.json supabase/functions/agent/index.ts`. Tests execute the actual migration against the captured schema and cover permission bypasses, consent/revocation, recovery, atomic failure, timer retries/races, offline ordering, legacy saves, snapshots, large histories and DST.

Hosted anonymous sign-in is disabled. Do not enable it merely for QA. Isolated browser write tests use the captured schema/migration with synthetic local Auth; real account checks use authenticated read-only tools. Never test with arbitrary changes to the user's real tasks or history.

Custom ChatGPT connections require a metadata refresh and verification in a new conversation after tool changes. Package updates alone do not establish runtime discovery or OAuth access. See [OpenAI connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt) and [Supabase OAuth token security](https://supabase.com/docs/guides/auth/oauth-server/token-security).
