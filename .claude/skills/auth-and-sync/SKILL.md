---
name: auth-and-sync
description: 'OAuth sign-in (api/auth/: login, callback, me, logout, Arctic providers) and per-user cloud sync (api/sync/: layouts, designs, manifest, export, account; src/core/sync/ engine). Use when debugging sync 401/403/409/410/413, forced sign-out, LWW conflicts, tombstone resurrection, manifest 304/If-Modified-Since staleness, index↔blob drift (pnpm sync-admin), GOOGLE_/GITHUB_CLIENT_ID / OAUTH_REDIRECT_BASE_URL env, or the __Host-gflt_session cookie.'
---

# Auth & Cloud Sync

Read `api/auth/README.md` and `api/sync/README.md` first — they accurately document endpoints, cookies, session lifecycle, CSRF layers, LWW/tombstone rules, quotas, and the account-deletion cascade. This skill covers the client engine, operations, and what the READMEs get wrong. Shares and Liveblocks are a separate anonymous subsystem — see the **share-api-collab** skill.

**Stale README corrections (verified against source):**

- Both "Status: not yet user-facing" banners are obsolete. The `VITE_ENABLE_SYNC_UI` build gate was replaced by the `cloud_sync` Labs flag (CHANGELOG #1605), which is `status: 'graduated'` in `src/core/labs/features.ts` — `useFeatureFlag('cloud_sync')` is always true, so sync is live in production. The `VITE_ENABLE_SYNC_UI` block in `.env.example` is dead too.
- Auth README's manual-verification step 5 is wrong: `GET /api/auth/me` returns 200 `{ authenticated: false, user: null }` for anonymous callers, never 401 — a 4xx on every anonymous page load would trip the post-promote smoke check (comment in `api/auth/me.ts`).

## When to use

- Sync requests failing: 401 (session), 403 (CSRF), 409/410 (LWW/tombstone), 413 (quota), 429 (rate limit), or users spontaneously signed out.
- Changing anything under `api/auth/`, `api/sync/`, `api/lib/session.ts`, `api/lib/userIndex.ts`, or `src/core/sync/`.
- Cloud data integrity questions: index↔blob drift, orphan blobs, stale tombstones — the `pnpm sync-admin` toolkit.
- OAuth provider setup or auth env vars on a new environment.

## Mental model

1. **Session** = opaque 64-hex token in the `__Host-gflt_session` cookie (name drops to `gflt_session` over plain HTTP — `api/lib/cookies.ts`), validated by exact-match Redis lookup in `requireSession()` (`api/lib/session.ts`). Every `api/sync/*` handler starts with it. 401 means no/expired session; **403 means CSRF** — cross-origin, or a non-safe method missing the `X-Requested-With: gflt` header.
2. **All client sync traffic goes through `apiFetch`** (`src/core/sync/apiFetch.ts`): it adds `credentials: 'include'` + the CSRF header, and on any 401 dispatches the `gflt:forced-sign-out` window event. `useSessionLifecycle` (`src/core/sync/session/useSession.ts`) reacts by wiping the outbox, calling `resetPullState()`, and flipping to anonymous — pending edits are deliberately sacrificed to prevent cross-account leakage. A raw mutating `fetch` (PUT/DELETE/POST) to a sync endpoint gets 403; route everything through `apiFetch` anyway so 401 handling stays centralized.
3. **Push path**: store subscriptions → adapters (`src/core/sync/adapters/layoutAdapter.ts`, `designAdapter` from `@/features/bin-designer`) → IndexedDB outbox (`outbox.ts`: one entry per (kind, id), newest snapshot wins, `MAX_ATTEMPTS = 8`, backoff 1s→5min) → `engine.ts` PUTs/DELETEs. 429s don't burn the attempts budget (separate `rateLimitedRetries` counter; `Retry-After` wins). Payload is re-read from the adapter at push time, never from the queue.
4. **Pull path**: `poller.ts` fetches `/api/sync/manifest` every 45s while visible (`triggers/usePeriodicPoll.ts`), sending `If-Modified-Since` as a **millisecond number, not RFC 1123** — the server compares it to `users:{uid}:indexUpdatedAt`, one Redis GET on the 304 hot path. Only `upsertEntry`/`tombstone` in `api/lib/userIndex.ts` bump that key (pipelined with the hash write); mutate the index any other way and every client 304s forever on stale data.
5. **Conflicts**: server LWW on `modifiedAt`. Remote newer → 409 with the stored envelope; the engine applies it locally and emits `remote-replaced-local` (toast). Equal-ms tie → deterministic canonical-JSON SHA-256 tiebreaker (`api/lib/lwwTiebreaker.ts`) so concurrent devices converge. Tombstone `deletedAt >= modifiedAt` → 410; the client drops the entry ("deleted elsewhere" toast) and only a fresh edit resurrects. LWW gates run **before** quota so rejected writes never consume a slot.
6. **Sign-in boot**: `App.tsx` lazy-mounts `src/shared/sync/SyncSessionMount.tsx`, which runs `runClaim` (`claim.ts`) **before** `engine.start()` — claim merges local↔cloud, and if `gflt-last-signed-in-user` (localStorage) differs from the new userId with local data present, it shows `AccountMismatchDialog` (merge/discard; discard clears the outbox _first_ — that ordering is the leakage gate). Session state syncs across tabs via `BroadcastChannel('gflt-session')`.
7. **Server env** (see the auth README table): `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `REDIS_URL`, `BLOB_READ_WRITE_TOKEN` (blobs at `users/{uid}/{layouts|designs}/{id}.json`), optional `OAUTH_REDIRECT_BASE_URL` (falls back to `getBaseUrl()` in `api/lib/shared.ts`, Vercel-derived).

## Recipes

### Change a sync endpoint / add a synced field

1. Server: copy the handler shape in `api/sync/layouts/[id].ts` — `requireMethod` → `requireSession` → id validation → `checkRateLimit(session.userId, 'sync.read'|'sync.write')` → LWW gates → quota → `putJson` + `upsertEntry`. Keep `.js` extensions on relative imports (Vercel ESM — see share-api-collab).
2. Payloads are sanitized by `validateShareLayout` / `validateDesignerShare` — the same validators as shares, so a new layout field must land in `api/lib/validation.ts` per the share-api-collab recipe. `sizeBytes` in the index must be measured on the **sanitized** payload or quota accounting drifts (sync-admin flags it as `sanitization_drift`).
3. Client: adapters in `src/core/sync/adapters/`; `normalizeIncomingLayout` in `layoutAdapter.ts` heals legacy blobs missing `notes`/`label` — new required fields need the same treatment, old envelopes serve forever.
4. Bump nothing lightly: envelopes carry `schemaVersion: 1` and there is no migration registry yet.

### Exercise the flow end-to-end

`pnpm run dev` does not serve `/api` (no vite proxy) — runtime verification means a Vercel preview deploy (or `npx vercel dev`; not a project dep). Set up OAuth apps per the provider walkthroughs in `api/auth/README.md`, then sign in via the UserDock (`src/shared/components/UserDock/UserDock.tsx` → `signInUrl('google'|'github')`) or hit `/api/auth/login/google` directly. Curl recipes for the sync endpoints (copying the session cookie) are at the bottom of `api/sync/README.md`.

### Diagnose index↔blob drift

```bash
vercel env pull .env.production.local
pnpm sync-admin audit --suggest        # findings + inline fix commands
pnpm sync-admin user <uid>             # one user's blobs/entries/tombstones
pnpm sync-admin suggest drift          # emits reviewed-then-pasted fixes
```

`scripts/sync-admin/` is read-only against production; mutations only ever print as shell commands. The finding-kind table and shared flags are in `scripts/sync-admin/README.md`. It imports the real validators from `api/lib/`, so validator changes retroactively reclassify stored payloads — run `audit` after tightening validation.

## Verification

```bash
pnpm run test:run api/auth api/lib/session api/lib/cookies     # auth surface
pnpm run test:run api/sync api/lib/userIndex api/lib/quota api/lib/lwwTiebreaker
pnpm run test:run src/core/sync                                 # engine/poller/claim/session
pnpm run typecheck
```

API tests run in the `unit` (node) vitest project and mock Redis/Blob at the edges only — `userIndex`/`quota` run against the in-memory stub, so they double as integration coverage. `api/**` is coverage-excluded; real 401/CSRF/cookie behavior only shows on a preview deploy.

## Traps

| Symptom                                                 | Cause                                                                                                                                 | Fix                                                                                                                                           |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Every sync call 401s; user flips to anonymous           | Forced sign-out: one 401 anywhere wipes outbox + session (by design, `useSession.ts`)                                                 | Find the 401's source: expired 30-day session, or Redis flush/`REDIS_URL` rotation (all sessions live in Redis — rotation signs everyone out) |
| 403 `Missing CSRF header` / `Forbidden origin`          | Request bypassed `apiFetch`, or cross-origin call                                                                                     | Route through `apiFetch`; the deployment never grants CORS, so cross-origin is unsupported                                                    |
| `/api/auth/me` says anonymous despite a fresh sign-in   | Wrong cookie name for the context: `__Host-` prefix requires HTTPS; plain-HTTP dev uses `gflt_session`                                | Expected (`api/lib/cookies.ts`); also check `readSession`'s expiry + `users:{uid}:profile` existence                                          |
| Save loops 409 between two devices                      | Equal-ms writes hit the tiebreaker; one side must lose                                                                                | Expected — loser applies the stored envelope and stops. A _persistent_ loop means something re-enqueues without bumping `modifiedAt`          |
| 410 on save; item vanished locally                      | Deleted on another device after this edit's `modifiedAt`                                                                              | By design: re-edit (bumps mtime) to resurrect. `claim.ts` handles the local-newer-than-tombstone case by pushing                              |
| 413 on save                                             | Per-kind quota: 100 items / 10 MB (`api/lib/quota.ts`)                                                                                | Engine drops the entry + quota toast; user deletes items. Tombstones don't count                                                              |
| Beacon flush on tab close never lands (405 server-side) | `sendBeacon` always POSTs; sync handlers allow GET/PUT/DELETE only (`useBeaconFlush.ts` vs `api/lib/method.ts`)                       | Durable delivery is actually the outbox replay on next visit. Flag to a maintainer before "fixing" either side                                |
| Clients never see new manifest data (perpetual 304)     | `users:{uid}:indexUpdatedAt` not bumped — index mutated outside `upsertEntry`/`tombstone`                                             | Only mutate via `api/lib/userIndex.ts`; for existing damage, `pnpm sync-admin audit`                                                          |
| OAuth callback 400 `Invalid OAuth state`                | State cookie (10-min TTL) expired mid-consent, cookies blocked, or callback URL host ≠ login host                                     | Retry; verify provider redirect URI matches `OAUTH_REDIRECT_BASE_URL`/`getBaseUrl()` exactly                                                  |
| Sign-in 503 in production                               | Redis down — sessions can't be minted/read; auth fails closed in prod, open (anonymous) in dev                                        | Restore Redis; don't weaken the `VERCEL_ENV === 'production'` branches                                                                        |
| New user inherits prior user's pending pushes           | Would require skipping the claim-before-start ordering or the discard's clear-outbox-first order (`SyncSessionMount.tsx`, `claim.ts`) | Never reorder those; both carry explanatory comments                                                                                          |

For deploy/env plumbing see **release-and-ci**; for the shared validators, Redis conventions, and `.js`-extension rule see **share-api-collab**.
