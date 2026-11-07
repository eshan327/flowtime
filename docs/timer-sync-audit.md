# Timer and ChatGPT UX audit — November 6, 2026

## Scope and evidence

Traced browser buttons and keyboard shortcuts, automatic break/runaway transitions, the persisted timer store, command journal and recovery UI, session outbox, settings synchronization, MCP/REST tool registration, plugin instructions, and SQL timer/receipt handling. Inspected production `private.flowtime_timer` and `private.flowtime_command` read-only: their revision checks, timestamp validation, per-user lock and receipts match the repository. No production timers, tasks, sessions, settings or approvals were modified.

The available last-24-hour backend logs include PostgREST timeout messages. Those messages are not correlated to the reported clicks and do not establish the cause of a particular failure. Browser-local conflicts cannot be inspected through server logs.

## Findings and changes

| Finding | User effect | Fix in this patch |
| --- | --- | --- |
| `get_timer` and `list_tasks` advertised the MCP UI resource on every ordinary read. `get_timer` is required before timer commands. | Routine conversation and timer commands could open a window without an explicit request. | Removed UI resource registration, tool UI metadata, the panel implementation and instructions advertising it. All fourteen tools remain available as text/structured data. |
| `useTimerSync.send` rejected every action while the three-second poll was in progress. | Start/stop intermittently failed with “Timer is synchronizing.” | Serialize actions and refreshes; coalesce background refreshes. A click waits for the poll instead of being rejected. Failed jobs do not poison later jobs. |
| Browser commands used the last polled revision without refreshing. | A ChatGPT change just before a click became a stale-revision rejection and offline recovery prompt. | Refresh before a new action when no uncommitted commands are pending. Preserve the existing dependency chain when offline commands remain. Server revision checks still protect truly simultaneous changes. |
| Any truthy API error code permanently marked all pending commands conflicted. | Temporary authentication/service failures could strand commands behind manual recovery. | Only explicit conflict/validation rejections trigger recovery. Other failures retain the same request IDs and payloads for retry. |
| Automatic expiry callbacks could wait while another actor changed the timer. | A delayed automatic action could target a newer timer. | Bind automatic work-cap and break-expiry actions to the revision that scheduled them; discard them when a refresh observes a different revision. |
| Remote timer changes did not invalidate session queries. | History could remain stale after ChatGPT stopped work, even though the timer had updated. | Invalidate the user's session queries when a different server timer revision is observed. |

The removed panel also had its own five-second refresh loop, with refresh results able to race button requests. Removing the unused surface eliminates that additional controller rather than maintaining a second timer UI.

## Data protection and remaining behavior

The database already atomically commits the timer transition, session segments, revision and idempotency receipt under a per-user lock. This patch keeps that mechanism, OAuth permissions, focus lock, break credit, the six-hour limit and history attribution unchanged. No schema migration or dependency is needed.

Real simultaneous edits and divergent offline branches still need review. Automatically rebasing them could stop a different run or duplicate recorded work. Existing conflict records are not silently discarded or retried: their history must first be compared. Temporary failures that were already marked as conflicts by an older version may therefore still require review.

Synchronization remains polling-based: passive browser updates can take about three seconds plus network time. A new online action now performs a refresh before committing; this adds network latency and queued actions wait for in-flight requests. This patch does not add Realtime, a background timer service, or an automatic conflict merge.

## Verification and rollout

Regression coverage exercises the actual browser controller with delayed/mocked RPCs: clicking during a poll, a changed ChatGPT revision, start/stop ordering, retrying identical requests after a temporary error, preserving genuine conflicts, cleanup of queued actions, and dropping stale automatic expiry. MCP protocol tests verify that every tool lacks UI metadata and initialization no longer advertises resources. Existing PostgreSQL tests exercise actual migrations in PGlite, including atomic timer transitions, idempotency, stale revisions, focus lock, legacy saves and permission enforcement.

Release requires deploying the updated agent Edge Function and browser build, then publishing the updated skill through the existing plugin release process. Preserve existing endpoint, OAuth identities and approvals. Refresh ChatGPT connector metadata and verify in a new chat that task/timer reads show no embedded panel. Reload existing browser tabs so they use the new controller. The repository changes alone do not update deployed clients or cached ChatGPT metadata.

A real signed-in ChatGPT/browser interaction was not performed, and no synthetic work was written to the user's production history. The intended host verification after release is: read tasks/timer without a panel, start/stop a user-authorized session in chat, observe the browser update, and confirm one saved session without spurious recovery.


## Mobile startup and performance follow-up

The reported device is iPhone Safari. Auditing the startup path found three unbounded waits: session restoration, the timer RPC, and the independent settings read. Both timer and settings readiness gate the controls; settings errors were not propagated to the timer loading message. A queued timer poll could therefore block subsequent clicks indefinitely. A signed-out session also had no terminal message on the timer screen.

The follow-up bounds complete API operations (including waiting for authentication) to 15 seconds, aborts timed-out requests, bounds authentication network requests, and exposes account/settings errors with a reload action. The existing poll can retry after failure. Signed-out sessions show the Account sign-in instruction. Late request results cannot overwrite a completed timeout. Timer command IDs remain stable across uncertain retries; no timeout automatically repeats unrelated writes.

Performance changes verified by regression tests:

- Successful online timer actions use the command response directly: two sequential RPCs instead of three (fresh read, then command; no duplicate final read).
- Polls with an unchanged revision preserve the timer state object and timestamp identities. Successful unchanged status updates also preserve React state.
- Insights requests two summaries instead of two summaries plus range/year raw session lists. Heatmap details load only for the selected day, with explicit loading/error/retry states and shared history caching.
- Today's timer totals request only the first summary page (`limit: 1`); the database returns complete totals on each page, so breakdown pagination is unnecessary here.

Route chunks and the chart library were already lazy-loaded, so no new bundler dependency or chart rewrite was introduced. Fast timer polling remains at three seconds; no cache-duration increase delays cross-device timer updates. No database schema or permissions change is required.

Tests simulate stalled initial timer/settings requests, aborts, late completions, recovery, request counts and state identity. These reproduce the indefinite-wait failure mechanism, not a captured trace from the user's iPhone. Physical-device Safari performance and the exact original network/authentication failure remain unverified; request-count reductions are not claimed as measured mobile load-time improvements.
