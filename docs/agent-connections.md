# Connecting assistants to Flowtime

## Decision

Expose Flowtime capabilities through one Supabase Edge Function, with an MCP transport for ChatGPT and a small JSON transport for a Muse custom connector. Both call the same validated tools. Use the existing Supabase identity, OAuth authorization-code flow with PKCE, and row-level security (RLS). Do not give assistants a `service_role`/secret key, a database password, a personal Supabase management token, or a copied browser session.

Muse's suggestion correctly identifies Supabase as the data source, but its proposed administrator credential bypasses RLS. The attached ChatGPT assessment is the better starting point. One extra protection is essential: narrow tool definitions alone do not restrict a Supabase OAuth token's direct database access. The migration also restricts OAuth clients in Postgres.

The backend was activated and smoke-tested on October 12, 2026: the migration is present, the Edge Function is deployed, Supabase OAuth and the private token hook are enabled, and public discovery responds successfully. The frontend includes the consent and connections routes. Dynamic registration is disabled. Muse is registered and allowlisted as a public OAuth client; ChatGPT is also registered and allowlisted; its ChatGPT-side sign-in/consent is pending verification. Muse still needs to configure its connector and initiate user consent before it can access account data.

To finish linking, obtain each assistant's exact OAuth callback URL and supported client authentication method from its connection setup. Register a separate client, add its ID to `FLOWTIME_AGENT_CLIENT_IDS`, then complete the user's sign-in and consent in that assistant. For Muse, first confirm OAuth support; the screenshot does not establish it. Do not guess callback URLs or substitute an administrator key. No OpenAI API key or model calls are needed: the assistant supplies the intelligence and Flowtime supplies tools.

## Capabilities

| Tool                | Behavior                                                                                        |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `list_tasks`        | Active/completed/all tasks with pagination                                                      |
| `list_categories`   | Categories, including archive status                                                            |
| `create_task`       | Create in an owned, active category, or uncategorized; caller UUID prevents duplicate retries   |
| `update_task`       | Rename, move, complete, or reopen; no deletion                                                  |
| `list_sessions`     | Saved history with original task/category snapshots, excluding deleted rows and notes           |
| `get_focus_summary` | Recorded focus seconds and historical task/category breakdown within explicit date boundaries   |
| `get_timer`         | Last synchronized timer, its revision, timezone and break divisor; explicitly potentially stale |

Dates require an offset (`Z` or `±HH:MM`). Ranges are `[from, to)`, at most 90 days. Sessions overlapping a boundary contribute a rounded proportion of recorded work; totals do not include unsaved/offline sessions. The summary stops with an error above 10,000 sessions rather than returning partial totals. Offset pagination is intended for ordinary personal histories; changes between pages can shift results, so avoid editing history while exporting or summarizing.

Remote start/stop, settings writes, category management, session edits, SQL, deletion, subtasks, and file access are intentionally excluded. Timer control needs a transactional command design that combines revision checks, session snapshots, and idempotent session persistence. Merely overwriting `active_timers.state` would bypass the browser's session pipeline.

## Security boundary

- The Edge Function uses only a publishable key plus the incoming user token. Every query also specifies the verified user's ID. No user/owner ID is accepted in tool arguments.
- Verify the signature with Supabase Auth, then check issuer, expiry, optional not-before, `authenticated` role, non-anonymous identity, the exact resource audience, and a configured OAuth client allowlist. Check the user still exists. Normal browser access tokens cannot call this endpoint.
- The private Custom Access Token hook adds the dedicated resource audience to OAuth tokens. It leaves ordinary app sessions alone. Keep `authenticated` in the audience list for Supabase APIs. The resource URL is fixed to this project's canonical endpoint in the migration; if deploying elsewhere, update the hook, policy audience, test fixture, and `FLOWTIME_AGENT_URL` together.
- New **restrictive** policies combine with existing own-row policies. OAuth tokens can read tasks/categories/nondeleted history/timers/settings and insert/update tasks. They cannot delete anything, modify the timer/history/settings/categories, access subtasks, or access Storage. Foreign-category assignment is rejected at the database boundary too. Ordinary Google and guest app sessions have no OAuth-server `client_id` claim and retain their previous behavior.
- The database limits apply to every OAuth-server client on this dedicated project. The HTTP client allowlist is an additional restriction at the tool endpoint, not a replacement for RLS. Do not enable dynamic client registration. Only register trusted Flowtime connectors with exact callback URLs. An authorized token can call the Data API within its database permissions, including reading session notes/settings fields omitted by the tools; consent therefore describes access to history and settings broadly.
- Revoke connections in Account → Agent connections (`/connections`). Refresh tokens are revoked; existing access tokens may remain valid until expiry. Configure a short access-token lifetime appropriate to your project. Removing a client from the endpoint allowlist blocks this endpoint immediately, but does not revoke an already-issued JWT's direct Data API rights.
- New tables, Storage policies, and RPCs must explicitly account for OAuth clients; an ownership-only policy would otherwise grant them access too.
- Request bodies are capped at 16 KiB, pages at 100 rows, and tool inputs reject unknown fields. Responses use `Cache-Control: no-store`; database errors are sanitized. Browser cross-origin access is not enabled. Put deployment-level request/rate limits in front of the endpoint before wider distribution.

## Activation order

1. Review the live schema/migration history first. This repository contains incremental migrations but no complete baseline; do not blindly reset production or apply every historical migration. Reconcile the linked history, then apply **only the pending** `20261012230439_restrict_agent_access.sql`. It adds policies and a private hook, not public table columns, so existing generated application types are unchanged. Recheck schema types when capturing the baseline.
2. Deploy the web frontend, which includes `/oauth/consent` and `/connections`. Set Supabase's Site URL to `https://flowtimeboard.vercel.app`. Allow the Google sign-in return URL `https://flowtimeboard.vercel.app/oauth/consent` (including its authorization query parameters), so linking a guest account returns to consent.
3. In Supabase Auth, configure the Custom Access Token hook as `pg-functions://postgres/private/flowtime_agent_token_hook`. If a hook already exists, merge its logic instead of replacing it. Use asymmetric JWT signing keys. Test a normal Google login and refresh after enabling the hook.
4. Enable the Supabase OAuth 2.1 server with authorization path `/oauth/consent`. Leave dynamic registration **disabled**. Register separate OAuth clients for ChatGPT and Muse using their exact published callback URLs and PKCE. Use the client authentication method each connector supports. Register only clients intended to get the permissions listed above.
5. Set these Edge Function environment variables through the Supabase dashboard or CLI. These values are not assistant credentials:

   | Variable                    | Value                                                                                        |
   | --------------------------- | -------------------------------------------------------------------------------------------- |
   | `FLOWTIME_PUBLISHABLE_KEY`  | This project's publishable key (legacy anon key also works); never a secret/service-role key |
   | `FLOWTIME_AGENT_URL`        | `https://dnnoyvwsvkdquijfdgtj.supabase.co/functions/v1/agent`                                |
   | `FLOWTIME_AGENT_CLIENT_IDS` | Comma-separated registered OAuth client IDs                                                  |
   | `SUPABASE_URL`              | Supabase supplies this automatically                                                         |

6. Deploy the function using `pnpm exec supabase functions deploy agent --project-ref dnnoyvwsvkdquijfdgtj`. Its `verify_jwt = false` gateway setting allows public OAuth discovery; the handler itself authenticates every tool request. An empty client allowlist fails closed with 503. Do not use `supabase config push` with this minimal function-only config.
7. Check OAuth discovery, complete consent in a test account, and inspect a freshly issued token without logging it: the audience must contain both `authenticated` and the exact agent URL. Verify token exchange, refresh, and revocation against the hosted Auth service. Local fixtures cannot establish hosted OAuth compatibility.
8. Run the round-trip test below before connecting the account containing your real study history.

### ChatGPT

A private portable plugin package is saved in `plugins/flowtime` and uploaded at https://chatgpt.com/plugins/plugins_6acd74e367fc81919cef8d88c11ad20b (release `pluginrel_6acd74e44d0c81918b89e6a9a7c08ff5`). The browser's separate custom MCP connection setup reached **Continue to Flowtime**; completion and live tool discovery are not yet verified. Package upload alone does not establish OAuth access.

The ChatGPT custom MCP setup uses public client ID `f63444b4-d1b2-448d-b20c-194048a94eac`, auth method `none`, the exact displayed callback `https://chatgpt.com/connector/oauth/-_-dxb_gDlGD`, and base scopes `openid offline_access`. This client was registered and read back successfully; its ID was appended to the allowlist while preserving Muse's ID. Keep the current setup rather than recreating it: a new setup can generate a different callback URL. Complete user sign-in/consent in the host before testing a read-only tool. No client secret belongs in the package.

Create a custom MCP connection/plugin using the agent URL and OAuth, with the registered client credentials if required. Use the exact callback URL displayed for that connection, not a guessed historical callback. Account/workspace eligibility and publishing are separate setup steps. The server supports stateless Streamable HTTP with JSON responses and exposes OAuth resource metadata in its 401 challenge. It does not implement the obsolete `ai-plugin.json` HTTP plugin protocol.

Official references: [OpenAI MCP connections](https://developers.openai.com/api/docs/guides/custom-mcp-server), [OAuth authentication](https://developers.openai.com/plugins/build/auth).

### Muse

Muse confirmed authorization-code OAuth with S256 PKCE, client authentication `none`, and JSON API support (not arbitrary MCP connections). Its registered configuration is:

- Client ID: `7b56d04e-3de8-4475-97e0-f153c34810d0` (public identifier, not a secret).
- Exact callback: `https://agent.meta.ai/api/hatch/oauth/callback`.
- Authorization endpoint: `https://dnnoyvwsvkdquijfdgtj.supabase.co/auth/v1/oauth/authorize`.
- Token endpoint: `https://dnnoyvwsvkdquijfdgtj.supabase.co/auth/v1/oauth/token`.
- Scopes: `openid offline_access`; resource: the canonical agent URL above.
- Client secret: none. Send PKCE `code_challenge_method=S256` and exchange using the corresponding verifier.

Registration readback, the allowlist digest, the PKCE redirect to the canonical consent page, and the unauthenticated API's 401 challenge were verified. Muse's actual connector and user consent remain pending. Use the JSON API:

- `GET <agent URL>/tools` returns tool descriptions and JSON Schemas.
- `POST <agent URL>/tools/<name>` executes that tool with a JSON argument object.
- Send the user's OAuth token as `Authorization: Bearer ...`. Do not put it in a prompt, URL, source file, or skill body. Manage refresh tokens in the connector's credential store.
- `GET <agent URL>/oauth-protected-resource` is public discovery.

Example `create_task` body:

```json
{ "id": "bdcd5b37-9cfa-4695-a0e9-fd982df30ae6", "name": "Review chapter 4", "category_id": null }
```

Reuse that UUID when retrying the same creation. A 409 means inspect the existing task before further changes; never silently replace another task. Other JSON errors use 400 for invalid inputs, 401 for auth, 404 for missing data/tools, 413 for oversized bodies, 422 for overly large summaries, and 502 for database failures.

If Muse only supports a static API key, this implementation is not yet compatible with that credential mode. Add a separately scoped, hashed, expiring, revocable personal-token mechanism after confirming Muse's requirements; do not substitute a Supabase administrator key or browser token.

## Verification

```sh
pnpm test
pnpm lint
pnpm build
pnpm format:check
# With Deno installed:
deno check --frozen --config supabase/functions/agent/deno.json supabase/functions/agent/index.ts
```

Tests use signed test JWTs and mock Auth/Data API responses for the HTTP boundary, plus real embedded PostgreSQL (PGlite) and isolated schema fixtures for RLS. They verify ownership, cross-user denial, protected-table writes/deletes, audience checks, anonymous denial, browser behavior, token-hook privileges, retries, pagination, summaries, and MCP discovery/initialization/calls. They do not connect ChatGPT/Muse or replace hosted acceptance testing.

A separate hosted smoke test on October 12, 2026 used a disposable account and public OAuth client. It verified normal password sign-in, consent, PKCE token exchange, dedicated token audience, authenticated tool access, refresh, task creation with an idempotent retry, completion, browser-token readback, direct OAuth task-deletion denial, and grant revocation preventing refresh. The temporary user/client were deleted and the client allowlist restored to empty. This did not exercise Google sign-in, the rendered consent UI, cross-account live isolation, timer round trips, or an actual ChatGPT/Muse connection; local policy tests cover cross-account isolation.

Round-trip acceptance test: connect test user A, create a task from the assistant, verify it appears in the app, complete it in the app, then list completed tasks from the assistant. Repeat creation with the same UUID and verify one row. Start work in the app, check the assistant's timer snapshot, stop in the app, and compare saved history. Test user B must never see A's rows. Attempt a direct OAuth Data API timer/history write and task deletion: all must be rejected. Revoke the grant and verify refresh fails; retest after the access token expires.

Supabase references: [MCP on Edge Functions](https://supabase.com/docs/guides/ai-tools/byo-mcp), [OAuth server setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started), [OAuth token security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security).
