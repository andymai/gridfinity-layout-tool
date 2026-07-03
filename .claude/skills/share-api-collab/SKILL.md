---
name: share-api-collab
description: Cloud share API (api/share.ts, api/share/[id].ts, api/lib/*) and Liveblocks collab (api/liveblocks-auth.ts, src/liveblocks.config.ts, src/shell/Collab/). Use when changing share validation/rate limits/content filter, adding an /api endpoint, debugging 429/503/409/CONTENT_BLOCKED, "Missing user ID" Liveblocks auth failures, read-only collab rooms, stale shared layouts, TOKEN_SALT/REDIS_URL env issues, or presence fields.
---

# Share API & Liveblocks Collab

Read `api/README.md` first — it accurately documents the share lifecycle, Redis key table, CAS lock, and share-ID formats. This skill covers only what it omits. `api/auth/` and `api/sync/` (OAuth + per-user sync) have their own READMEs and are separate subsystems.

## When to use

- Changing share validation limits, the content filter, rate limits, or adding an `/api` endpoint.
- Debugging share failures (429, 503, 409, 401, CONTENT_BLOCKED) or Liveblocks auth/permission problems.
- Touching owner auto-sync, presence, or anything under `src/shell/Collab/`.

## Mental model

- Shares are anonymous: payload lives in a Vercel Blob at `shares/{id}.json`, served via **public CDN URL**. Never put `deleteTokenHash`, `reportCount`, or `lastAccessedAt` in blob payloads — everything in `ShareData` is world-readable. Secrets live in Redis via builders in `api/lib/redisKeys.ts` (`share:hash:{id}` etc.).
- Share ID === layout UUID, supplied by the client. The `/l/{id}` URL, the Liveblocks room `gridfinity-{id}`, and the library `entry.id` must all agree — owner detection (`CollabProvider.tsx`) and "Shared with me" dedup (`SharedLayoutImporter.tsx`) depend on it.
- `blob put({allowOverwrite: false})` in `api/share.ts` is THE atomic creation lock; Redis hash write follows, with blob rollback on failure (see `git show 7920a7d58` — the MED-1 race fix). `allowOverwrite` must stay `false`.
- `hashToken()` in `api/lib/shared.ts` computes SHA-256(TOKEN_SALT + token). The salt is effectively part of the stored data: rotating it makes every existing share permanently un-updatable and un-deletable. It throws if TOKEN_SALT is unset.
- Room permission comes solely from the share blob's `metadata.permission` (`'view'|'edit'`) — `api/liveblocks-auth.ts` maps edit→`['*:write']`, view→`['*:read']`. The client-supplied `userId` is NOT a privilege boundary. Scopes replaced deprecated `session.FULL_ACCESS`/`READ_ACCESS` (`git show 6cfb2160d`).
- Delete tokens never enter Liveblocks storage — only the owner's local library holds the token, which is why cloud persistence is owner-only (`useCloudShareAutoSync.ts`, 1s debounce in collab; `useOwnedShareSync.ts`, 5s debounce outside; both gate on `lastEditSource === 'local'` to prevent echo loops).

**Env reality (CLAUDE.md is stale here):** the code reads `REDIS_URL` (ioredis, `api/lib/rateLimit.ts:80`), NOT `KV_REST_API_URL`/`KV_REST_API_TOKEN`. Real server vars: `BLOB_READ_WRITE_TOKEN`, `REDIS_URL`, `TOKEN_SALT`, optional `LIVEBLOCKS_SECRET_KEY`; client needs `VITE_LIVEBLOCKS_PUBLIC_KEY` (unset → stub hooks, collab silently off).

**No local /api runtime:** `pnpm run dev` does not serve `/api` (no vite proxy). Verification = colocated vitest tests (`vi.mock` of `@vercel/blob` and ioredis) + Vercel preview deploys (or `npx vercel dev`; the CLI is not a project dep).

## Recipes

### Change a validation limit / add a validated field to shares

1. Edit `SHARE_CONSTRAINTS` + the Shape interface + type guard + sanitization in `api/lib/validation.ts`. Server limits must equal or be stricter than client constants in `src/core/constants.ts` — divergence lets a peer persist a layout the recipient's CQRS Zod schema rejects (see the `HEIGHT_MIN` comment there).
2. Sanitization strips unknown fields: a field you don't copy into the sanitized return object silently disappears from every share. Sanitized bins must always emit `label: ''` and `notes: ''` — never `undefined` — the 3D view calls `bin.notes.trim()` on fetched shares and crashes otherwise (comment at `api/lib/validation.ts:76`).
3. User-visible text fields must be added to `filterLayoutContent()` in `api/lib/contentFilter.ts`.
4. Client read path: `validateImport` (`src/shared/utils/validation.ts`, used by `fetchShare` in `src/core/api/share.ts`) must accept the field.
5. New fields must be optional on read — shares created before the field exists keep serving their old bodies. `vite.config.ts:140` also declares a 7-day StaleWhileRevalidate `shared-layouts` cache for `GET /api/share/{id}`, but its urlPattern (`[a-zA-Z0-9]+$`) matches only legacy hyphen-free 12-char IDs — UUID and base36 shares are never SW-cached (likely unintended; flag to a maintainer before relying on either behavior).
6. Update `api/lib/validation.test.ts` (and `src/core/api/share.test.ts` if the response shape changed).

### Add a new API endpoint

1. Create the file under `api/` (Vercel file-based routing; `[id].ts` for dynamic segments). Copy the handler/OPTIONS/method pattern from `api/share.ts`.
2. All relative imports inside `api/` must keep the `.js` extension (`'./lib/rateLimit.js'`) — Vercel's Node ESM runtime requires it even though vitest and tsc tolerate omission.
3. Add a `RateLimitAction` to `RATE_LIMITS` in `api/lib/rateLimit.ts`; call `checkRateLimit(getClientIP(req), action)` first; return 429 with `ErrorCode.RATE_LIMITED`.
4. New Redis keys go through a builder in `api/lib/redisKeys.ts`. Error bodies are `{ error, code }` with codes from `ErrorCode` in `api/lib/shared.ts`.
5. New custom request header? Add it to `Access-Control-Allow-Headers` in `vercel.json` (statically pinned; currently `Content-Type, x-delete-token`) or browsers strip it at preflight.
6. Colocated `.test.ts` mocking `@vercel/blob`/ioredis (copy `api/liveblocks-auth.test.ts`). Client wrapper in `src/core/api/` returning `Result<T, ApiError>`; map new codes in `src/core/api/mapApiError.ts` (`mapApiErrorResponse`).

### Extend the content filter

1. Edit `BLOCKLIST` / `HARMFUL_PATTERNS` in `api/lib/contentFilter.ts`. Blocklist terms: lowercase ASCII in normalized form — matching runs after NFKD + zero-width strip + confusable folding + 0/1/3/4 leetspeak folding. `HARMFUL_PATTERNS` deliberately test RAW text (the zalgo detector needs the combining marks normalization strips) — do not "fix" that asymmetry.
2. Do not add confusable digit mappings beyond 0/1/3/4 (corrupts names like "Bin 1/4 inch" — see comment near `contentFilter.ts:103`). Matching is `.includes()` — short terms hit inside innocent words.
3. Test both the plain term and a homoglyph/zero-width bypass in `api/lib/contentFilter.test.ts`.
4. The filter runs only on layout-share POST/PUT — never on designer shares, never retroactively on existing blobs.

### Add a presence field (cursors/selection/hints)

1. Add to `UserPresence` (or `InteractionHint`) in `src/liveblocks.config.ts`; the room context is `createRoomContext<any, any>` with typing pinned by the hook re-export casts — update those casts if signatures change.
2. Set `initialPresence` in `src/shell/Collab/CollabProvider/CollabProvider.tsx`; publish via `useUpdateMyPresence`.
3. Consumers (`CollabCursors`, `CollabSelectionRings`, `CollabGhosts`, `ParticipantsPanel`) use safe wrapper hooks that return stubs when Liveblocks is unconfigured — new consumers must tolerate empty/null returns.
4. Presence is ephemeral; `api/liveblocks-auth.ts` never validates it. Persistent `LiveblocksStorage` fields need a manual `metadata.version` bump — no migration registry exists.
5. Manual check: two browsers on a deploy preview, an 'edit' share, both on `/l/{shareId}`.

## Verification

```bash
pnpm run test:run api                            # all API unit tests (node env)
pnpm run test:run api/lib/validation.test.ts     # after limit/shape edits
pnpm run test:run api/lib/contentFilter.test.ts  # after filter edits
pnpm run test:run src/core/api                   # after client fetch/error-mapping edits
pnpm run test:run src/shell/Collab               # after presence/collab edits
pnpm run typecheck                               # api/ has its own tsconfig.api.json
```

`api/share.ts` and `api/share/[id].ts` have no sibling tests, and `api/**` + `src/shell/Collab/**` are coverage-excluded (`vitest.config.ts`) — green coverage proves nothing about endpoints. Runtime behavior only shows on a preview deploy. For test workspace details see the testing skill; for the PR/deploy path see the release-and-ci skill.

## Traps

| Symptom                                                    | Cause                                                                                                                                                                                | Fix                                                                                                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every share op 429s (or POST 503s) in production           | Redis down / `REDIS_URL` unset — rate limiter fails closed in production; POST refuses shares whose token hash can't persist                                                         | Restore Redis; never weaken the fail-closed branches (`api/lib/rateLimit.ts:118`, `api/share.ts:122`)                                                                                                                                       |
| Local dev: rate limiting seems absent                      | No Redis + `VERCEL_ENV !== 'production'` → allow-all by design                                                                                                                       | Expected; production denies instead                                                                                                                                                                                                         |
| All OLD shares 401 on PUT/DELETE, new ones fine            | TOKEN_SALT rotated or differs between envs                                                                                                                                           | Restore original salt; no recovery for hashes made with a lost salt                                                                                                                                                                         |
| Share endpoints 500 on any token op                        | TOKEN_SALT unset — `hashToken` throws                                                                                                                                                | Set TOKEN_SALT in Vercel env                                                                                                                                                                                                                |
| CONTENT_BLOCKED on innocent layout                         | A note/label contains a URL, 11+ repeated chars, or 5+ combining marks — `HARMFUL_PATTERNS` blocks all on raw text                                                                   | By design; change patterns deliberately with tests, not as a "bug fix"                                                                                                                                                                      |
| POST 409 "share with this ID already exists"               | Share ID = layout UUID; blob exists                                                                                                                                                  | Client PUTs with stored `deleteToken` (`useCloudShare` handles via `entry.cloudShare`); never flip `allowOverwrite`                                                                                                                         |
| Liveblocks auth 400 "Missing user ID" on every join        | `authEndpoint` in `src/liveblocks.config.ts` changed to a URL string — SDK then POSTs only `{room}`                                                                                  | Keep it a function POSTing `{room, userId}` (comment at line 98)                                                                                                                                                                            |
| Everyone read-only despite 'edit' share                    | `liveblocks-auth` reads permission from the blob; share was created 'view', or scopes changed                                                                                        | Check `metadata.permission` in the blob and `session.allow` at `api/liveblocks-auth.ts:172`                                                                                                                                                 |
| Viewer sees stale layout after owner edit                  | Auto-sync hadn't fired (5s debounce; staging-only edits never change `createLayoutFingerprint`); only for legacy 12-char IDs can the SW `shared-layouts` cache (7d) also serve stale | Wait out the debounce / make an on-grid edit; staging exclusion is by design (`src/features/cloud-share/utils/cloudShare.ts`) — though when a sync fires, the FULL layout including staging bins uploads. Hard reload only helps legacy IDs |
| PUT of designer-share params fails validation              | `api/share/[id].ts` PUT only knows the layout schema (`validateShareLayout`); designer shares get permission-only PUTs                                                               | By design: delete + re-create, or add a designer branch to `handlePut` mirroring `api/share.ts`                                                                                                                                             |
| Tests pass, deployed function crashes ERR_MODULE_NOT_FOUND | Relative import in `api/` missing `.js` extension                                                                                                                                    | Match existing style (`'./lib/shared.js'`)                                                                                                                                                                                                  |
| Auth userId ≠ presence userId                              | localStorage key `gridfinity-user-id` is read by BOTH `src/liveblocks.config.ts` and `CollabProvider.tsx` via separate implementations                                               | Keep the two in sync                                                                                                                                                                                                                        |

Also: `isValidShareId` accepts three legacy formats — tightening it bricks old links. `getClientIP` trusts the leftmost `x-forwarded-for` (safe only because Vercel overwrites the header). `api/ml-telemetry.ts` deliberately duplicates `getRedis` and returns 200 even on storage errors so clients never retry-storm — don't unify it with `lib/rateLimit.ts`. `api/report/[id].ts` is intentionally toothless (manual-review logs at threshold 5, no automated takedown; its header comment requires CAPTCHA/unique-IP work first). ML telemetry event conventions belong to the analytics-and-labs skill.
