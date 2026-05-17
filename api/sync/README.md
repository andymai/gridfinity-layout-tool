# Sync (`api/sync/`)

Server endpoints for the multi-device sync feature. Stores per-user layouts and Bin Designer designs in Vercel Blob, with a per-user index in Redis. All endpoints require an authenticated session — see [`../auth/README.md`](../auth/README.md).

> **Status: server-only.** PR 3 lands these endpoints. The client engine (PR 4) will start calling them, and the UI gate flips on in PR 6. Until then nothing in the SPA calls these — they're verified via tests + curl.

## Endpoints

| Endpoint                 | Method | Rate Limit | Purpose                                         |
| ------------------------ | ------ | ---------- | ----------------------------------------------- |
| `/api/sync/layouts/[id]` | GET    | 240/min    | Fetch envelope (200 / 404 / 410)                |
| `/api/sync/layouts/[id]` | PUT    | 60/min     | LWW write; 409 stale-write, 410 stale-resurrect |
| `/api/sync/layouts/[id]` | DELETE | 60/min     | Tombstone + blob delete                         |
| `/api/sync/designs/[id]` | GET    | 240/min    | Fetch envelope (200 / 404 / 410)                |
| `/api/sync/designs/[id]` | PUT    | 60/min     | LWW write; reuses designer-payload validator    |
| `/api/sync/designs/[id]` | DELETE | 60/min     | Tombstone + blob delete                         |
| `/api/sync/manifest`     | GET    | 240/min    | Full per-user index + `If-Modified-Since` 304   |
| `/api/sync/export`       | GET    | 240/min    | ZIP of all live items + manifest.json           |
| `/api/sync/account`      | DELETE | 60/min     | Cascade-delete sessions + KV + blobs            |

Rate limits are keyed by `userId`, not IP — each authenticated user gets their own budget.

## Storage shape

### Cloud envelope (per item)

```ts
// users/{uid}/layouts/{id}.json (Vercel Blob)
{
  layout: Layout,           // sanitized via validateShareLayout
  modifiedAt: number,       // ms since epoch (LWW comparison value)
  schemaVersion: 1,
}

// users/{uid}/designs/{id}.json
{
  design: BinParams,        // sanitized via validateDesignerShare
  modifiedAt: number,
  schemaVersion: 1,
}
```

### Per-user index entry (Redis hash field value)

```ts
// HGETALL users:{uid}:index:layouts → { [id]: IndexEntry }
type IndexEntry = {
  modifiedAt: number;
  sizeBytes: number;
  deletedAt?: number; // tombstone marker, permanent
};

// Adjacent: SET users:{uid}:indexUpdatedAt {ms} on every mutation
//           bumps the cache key for /api/sync/manifest's 304 path.
```

`sizeBytes` is measured against the **sanitized** payload — the same bytes the
blob stores — so quota accounting matches reality. Each kind also has a
**pre-validation cap** that bounds CPU on huge inputs: layouts use
`SHARE_CONSTRAINTS.MAX_SIZE_BYTES` (500 KB, measured on `{ layout }`); designs
use `CONSTRAINTS.MAX_PAYLOAD_BYTES` (100 KB, measured on
`{ name, type, version, params }`). The pre-validation count is intentionally a
subset of the request body, not the full HTTP payload — its only job is to gate
the validator's workload.

## LWW + tombstone semantics (PUT)

Every write supplies a `modifiedAt` (ms epoch) representing the client's view of when the change happened. The server compares against the existing entry:

- **Existing live, server `modifiedAt` ≥ request `modifiedAt`** — `409 Conflict` with the stored envelope. Client should pull and replace local.
- **Existing tombstone, `deletedAt` ≥ request `modifiedAt`** — `410 Gone`. The local edit predates the deletion; client must re-edit (bumping `modifiedAt`) to resurrect.
- **No existing OR tombstone with `deletedAt` < request `modifiedAt`** — write succeeds (resurrection clears the tombstone).
- **Quota check** — happens after the LWW gate; PUT only consumes a slot when it's actually accepted.

## Quotas

`api/lib/quota.ts` enforces:

| Resource      | Cap            |
| ------------- | -------------- |
| Layouts count | 100 per user   |
| Layouts bytes | 10 MB per user |
| Designs count | 100 per user   |
| Designs bytes | 10 MB per user |

Tombstones don't count. Quotas are independent per kind. Concurrent writes can briefly exceed by one item — caps are soft ceilings at this scale, not hard invariants.

## Why content filtering is skipped

The existing share endpoints (`/api/share`) run `filterLayoutContent` because shares are publicly accessible by their URL. Sync data is **user-private**: a user's own layouts / designs, never exposed to other users. Adding a content filter here would block users from saving their own work due to false positives in their own bin labels — a worse UX with no security benefit. Documented intentional skip.

## Account deletion cascade

`DELETE /api/sync/account` runs in this order:

1. `SMEMBERS users:{uid}:sessions` → `DEL session:{token}` for each
2. `HKEYS users:{uid}:index:{layouts|designs}` → `del()` each blob
3. `DEL users:{uid}:*` (indexes, profile, sessions set, indexUpdatedAt)
4. Clear session cookie on responding device

Idempotent: each step uses unconditional `DEL`, so a partial-failure replay is safe. Per-blob errors are logged but don't block the cascade — leftover blobs are storage cost only. Worst-case time at 200 items × ~50 ms = ~10 s, well within Vercel's 60 s function limit.

## Testing

Each endpoint has a sibling test that mocks Redis + Blob and exercises the full state-write path. The tests don't mock `userIndex` or `quota` — they run against the in-memory Redis stub, so the tests double as integration coverage for those modules.

```bash
pnpm exec vitest run api/sync api/lib/userIndex api/lib/quota
```

## Manual verification (post-deploy, with PR 2 cookie)

```bash
# After signing in via /api/auth/login/google in a browser,
# copy the __Host-gflt_session cookie and curl with it:

curl -H 'Cookie: __Host-gflt_session=…' \
     -H 'X-Requested-With: gflt' \
     -X PUT https://example.com/api/sync/layouts/abc-1234567 \
     -H 'Content-Type: application/json' \
     -d '{"layout": {...}, "modifiedAt": 1700000000000}'

curl -H 'Cookie: __Host-gflt_session=…' \
     https://example.com/api/sync/manifest

curl -H 'Cookie: __Host-gflt_session=…' \
     -OJ https://example.com/api/sync/export
```
