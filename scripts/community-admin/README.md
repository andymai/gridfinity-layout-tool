# community-admin

Moderation and admin CLI for the community showcase. Reads and **writes**
production Vercel Blob and Redis directly, via `.env.production.local`.

## Deviation from sync-admin's read-only rule

`scripts/sync-admin` is read-only by design: it reports findings, and any fix
is emitted as a shell command for the operator to review before running. This
CLI does not follow that pattern. Every mutating command (`hide`, `restore`,
`purge`, `denylist`, `undenylist`, `feature`, `unfeature`) writes to
production the moment it runs.

The reason is the nature of the job: moderation needs same-session takedown.
A report crosses the auto-hide threshold, or a support ticket names an
abusive upload, and the fix has to land before the next page load, not after
someone pastes a reviewed script. Generating a shell command for a human to
paste (sync-admin's model) would reintroduce exactly the delay this tool
exists to remove. Takedown capability ships in the community showcase's
foundation PR, before any content can exist, precisely so this gap is never
open.

Because of that, run every command deliberately. `purge` additionally
requires `--yes` since it is the one irreversible operation (blob deletes are
not recoverable). There is no dry-run flag for any command in this CLI.

## Setup

```bash
vercel env pull .env.production.local
pnpm community-admin --help
```

Credentials needed in `.env.production.local`:

- `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
- `REDIS_URL` (Redis Cloud connection string)
- `TOKEN_SALT` (needed to derive a user's pseudonymous `authorPublicId` for
  `denylist`, see "Known limitation" below)

A banner prints on every run with the target Redis host, blob token
fingerprint, and a reminder that mutations are immediate.

## Commands

### `list [flagged|hidden|all]`

Prints status counts (`live` / `hidden` / `removed` / `flagged`) and a table
of matching designs. `flagged` means status is still `live` but at least one
report is on file (i.e. below the auto-hide threshold, needing a manual
call). Default mode is `all`.

```bash
pnpm community-admin list flagged
pnpm community-admin list hidden
pnpm --silent community-admin list all --json | jq '.counts'
```

### `inspect <id>`

Full record (blob + Redis card) plus report state: reporter count and the
reporting user ids.

```bash
pnpm community-admin inspect abc123DEF456
```

### `hide <id>` / `restore <id>`

Flip a design's status between `hidden` and `live`. Uses the same
`setCommunityDesignStatus` the (future) `PUT`/report-threshold handlers use,
so the sort indexes stay consistent automatically: `hide` removes the design
from all three `community:index:*` sorted sets, `restore` re-adds it.

```bash
pnpm community-admin hide abc123DEF456
pnpm community-admin restore abc123DEF456
```

### `purge <id> --yes`

Hard-delete: the design JSON blob, every known thumbnail, and the mesh GLB,
plus every Redis key that references the design (card hash, all three sort
indexes, likes set with cascade into each liker's reverse index, reports
set, and its own children bookkeeping set). If the design is itself a remix,
also drops it from its parent's children set.

Per the plan's "children keep snapshots" rule, a purge never touches the
records of designs that remixed _this_ one; their `lineage.parentId` is left
pointing at an id that no longer resolves, same as an already-deleted
parent.

```bash
pnpm community-admin purge abc123DEF456 --yes
```

**Known limitation:** `community:published:{userId}` (the quota set) cannot
be cleaned up from a design id alone. `authorPublicId` is deliberately a
one-way hash of `userId` (see `api/lib/communityIds.ts`) so no stored record
lets a purge walk back to the owning account. A purged design leaves a
phantom slot in the former owner's quota until they either republish (same
content hash reuses the slot) or the account is looked up out of band.

### `denylist <userId>` / `undenylist <userId>`

`denylist` bars a user from future publishes (`SADD community:denylist`) and
hides every design currently live under their `authorPublicId`, derived
locally from `userId` + `TOKEN_SALT`, the same derivation
`deriveAuthorPublicId` uses server-side, so no round trip is needed to find
their designs.

`undenylist` only removes the bar; it does not restore anything hidden by
the paired `denylist` call. Restore each design explicitly with `restore` if
appropriate.

```bash
pnpm community-admin denylist 589314dfbe7f...
pnpm community-admin undenylist 589314dfbe7f...
```

### `feature <id>` / `unfeature <id>`

Sets the `featured` flag in both places it's duplicated: the design blob
(detail-view source of truth) and the `community:design:{id}` Redis hash
(gallery-sort source of truth).

```bash
pnpm community-admin feature abc123DEF456
pnpm community-admin unfeature abc123DEF456
```

## Shared flags

| Flag     | Applies to        | Effect                                   |
| -------- | ----------------- | ---------------------------------------- |
| `--json` | `list`, `inspect` | Machine-readable output                  |
| `--yes`  | `purge`           | Required to confirm the irreversible run |
| `--help` | all               | Show usage                               |

## Implementation notes

- Imports key builders (`communityDesignKey`, `communityIndexKey`, etc.) and
  storage helpers (`readCommunityDesignBlob`, `setCommunityDesignStatus`, ...)
  directly from `api/lib/`, the same way `sync-admin` imports
  `validateShareLayout` and `userIndexKey`: production logic changes are
  reflected automatically rather than drifting from a duplicated copy.
- `lib/purgePlan.ts` enumerates every blob path and Redis key a purge must
  touch as a pure function, separate from the `purge` command's I/O. See its
  own doc comment and `__tests__/purgePlan.test.ts`.
- `lib/dispatch.ts` separates command-table routing from `index.ts`'s env
  setup so routing is unit-testable without Redis/Blob credentials. See
  `__tests__/dispatch.test.ts`.
