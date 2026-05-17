# sync-admin

Operator toolkit for the cloud-sync subsystem. Reads from production Vercel Blob
and Redis (via `.env.production.local`) and reports on integrity. **Read-only**:
mutations are emitted as shell commands the operator pastes after review.

## Setup

```bash
vercel env pull .env.production.local
pnpm sync-admin --help
```

Credentials needed in `.env.production.local`:

- `BLOB_READ_WRITE_TOKEN` — Vercel Blob
- `REDIS_URL` — Redis Cloud connection string

A banner with the target Redis host + blob token prefix prints on every run so
the operator can sanity-check what they're about to scan.

## Commands

### `audit`

Full integrity scan: blob ↔ index reconciliation, envelope validation, payload
validation (via the same `validateShareLayout` / `validateDesignerShare` the
PUT endpoints use), and sanitization-drift detection.

```bash
pnpm sync-admin audit                       # human-readable report
pnpm sync-admin audit --suggest             # inline fix commands per finding
pnpm sync-admin audit --no-payload-fetch    # fast path, skips HTTP fetch
pnpm sync-admin audit --strict              # exit non-zero on any finding (CI)
pnpm --silent sync-admin audit --json       # structured output for piping
```

### `user <uid>`

Drill into a single user: list their blobs, live entries, tombstones, and any
findings.

```bash
pnpm sync-admin user 589314dfbe7f...
pnpm sync-admin user 589314dfbe7f... --kind=designs
```

### `users`

Table of all users sorted by total blob bytes desc. Use to spot capacity
outliers.

```bash
pnpm sync-admin users
pnpm --silent sync-admin users --json | jq '.[0]'
```

### `tombstones`

List tombstones across all users (or `--user=<uid>`), with age and stale
status. Default stale threshold: 90 days (matches `TOMBSTONE_RETENTION_MS` in
`api/lib/userIndex.ts`).

```bash
pnpm sync-admin tombstones
pnpm sync-admin tombstones --older-than=180d
```

### `suggest <category>`

Emit shell commands that would remediate findings of one category. Output is
designed to be reviewed and pasted; nothing runs automatically.

| Category           | Emits                                                        |
| ------------------ | ------------------------------------------------------------ |
| `drift`            | `redis-cli EVAL` that rewrites `sizeBytes` to match the blob |
| `orphans`          | `vercel blob rm` (orphan blob) or `HDEL` (missing blob)      |
| `stale-tombstones` | `redis-cli HDEL` for tombstones older than the threshold     |
| `malformed`        | `HGET` (inspect) then commented `HDEL` (uncomment to apply)  |

```bash
pnpm sync-admin suggest drift > drift-fixes.sh
# review drift-fixes.sh, then:
bash drift-fixes.sh
```

## Shared flags

| Flag                      | Applies to                 | Effect                                                                               |
| ------------------------- | -------------------------- | ------------------------------------------------------------------------------------ |
| `--json`                  | all                        | Machine-readable output (use with `pnpm --silent`)                                   |
| `--strict`                | audit, user, tombstones    | Exit 1 if any finding present (errors, warnings, _and_ info — e.g. stale tombstones) |
| `--kind=layouts\|designs` | most                       | Restrict to one item kind                                                            |
| `--user=<uid>`            | audit, suggest, tombstones | Restrict to one user                                                                 |
| `--no-payload-fetch`      | audit, user, suggest       | Skip per-blob HTTP fetch (skips envelope checks)                                     |
| `--suggest`               | audit                      | Inline fix commands beneath each finding                                             |
| `--older-than=Nd`         | tombstones, suggest        | Stale-tombstone age threshold (default 90d)                                          |

## Finding kinds

| Kind                    | Severity | Means                                                        |
| ----------------------- | -------- | ------------------------------------------------------------ |
| `orphan_blob`           | error    | Blob exists, no live index entry                             |
| `missing_blob`          | error    | Live index entry exists, no blob                             |
| `tombstone_with_blob`   | error    | Index says deleted, blob survives                            |
| `malformed_index_entry` | error    | Index hash value isn't parseable JSON                        |
| `modifiedAt_mismatch`   | error    | Envelope's `modifiedAt` differs from index entry's           |
| `envelope_invalid`      | error    | Envelope shape wrong: bad `schemaVersion` / `modifiedAt`     |
| `payload_invalid`       | error    | `validateShareLayout` / `validateDesignerShare` rejected     |
| `sanitization_drift`    | warn     | Index `sizeBytes` over-counts (quota leak in system's favor) |
| `listing_size_mismatch` | warn     | Vercel Blob listing's `size` differs from fetched byte count |
| `stale_tombstone`       | info     | Tombstone older than retention; safe to sweep                |

## CI usage

```bash
pnpm sync-admin audit --strict --no-payload-fetch
```

Exits 1 on any error/warning. `--no-payload-fetch` keeps the run sub-second
without sacrificing membership + drift detection.

## Implementation notes

- Imports `validateShareLayout`, `validateDesignerShare`, `userIndexKey`,
  `TOMBSTONE_RETENTION_MS` directly from `api/lib/` so production validation
  changes are reflected automatically.
- Bounded concurrency of 16 in-flight blob fetches via `lib/concurrency.ts`.
- The envelope-overhead delta math lives in `lib/delta.ts`; see comments
  there for the precise byte accounting that distinguishes "expected" from
  "drift".
