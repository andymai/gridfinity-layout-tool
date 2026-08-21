# CLAUDE.md

Gridfinity Layout Tool: React + TypeScript web app for 3D-printed drawer organizer layouts.

## Git & Quality

- **Main is protected** - all changes via PRs
- Pre-commit **blocks** on: lint-staged, module boundaries, design system, i18n (4 checks), exhaustiveness, component structure, doc drift
- Pre-commit **warns only**: missing tests, readme reminders. `test:affected` is commented out of the hook, so **no tests run at commit time** — CI is the gate

## Docs

Internal docs are agent context, so they are budgeted. `pnpm run check:doc-drift`
(pre-commit on any staged `.md`, and in CI) blocks two things: a backticked
reference to code that no longer exists, and growth past a doc's recorded size.

The budget in `scripts/doc-budget.json` is a **ratchet**: it lowers by itself when
a doc shrinks, so trimming never needs a config edit, but growth has to be
justified by raising the number in the same commit. To add detail, prefer moving
it into the matching `.claude/skills/*/SKILL.md`, which loads only for relevant
tasks, over CLAUDE.md or a README, which are read far more often.

## Code Style (Enforced)

| Required                      | Prohibited                |
| ----------------------------- | ------------------------- |
| `import type` for types       | `any` (use `unknown`)     |
| Explicit types                | `console.log`             |
| `useShallow` for multi-select | `var`, `==`               |
| `@/` path alias               | Non-null assertions (`!`) |

## Core Architecture

Undo/redo (max 100) lives in `src/core/cqrs/undo/historyStore.ts`, captured automatically by the CQRS undo middleware.

### Critical Gotchas

Orientation facts that are cheap to state and expensive to get wrong:

1. **Coordinate System**: Grid (0,0) is **bottom-left**. `layers[0]` is bottom. UI reverses via `getDisplayLayers()`.
2. **Staging**: `layerId === '__staging__'` = off-grid stash. Auto-used when bins displaced.
3. **Half-Bin Mode**: 0.5 increments. Helpers: `snapToHalf()`, `snapToGrid()`, `isFractional()`. `HALF_BIN_SCALE = 2`.
4. **Multi-Layout**: Each layout stored by UUID (`gridfinity-layout-{uuid}`). Library index tracks metadata only.

Subsystem invariants live in `.claude/skills/`, which load on the matching task.
The geometry ones matter most, because their failures are invisible to
bounding-box, triangle-count and watertight assertions: see `geometry-debugging`
before trusting a passing mesh test.

### Result Type (`src/core/result/`)

Use `Result<T, E>` for fallible operations. Import `ok`, `err`, `isOk`, `isErr` from `@/core/result`.

Error types: `LayoutError`, `ValidationError`, `StorageError`, `ApiError`. Use `getUserMessage()` for display.

### Storage (`src/core/storage/`)

**Atomic ops (preferred):** `saveLayoutWithMetadata()`, `createLayoutEntry()`, `deleteLayoutWithEntry()`, `switchActiveLayout()`

Import from `@/core/storage` (public facade).

### CQRS (`src/core/cqrs/`)

See `src/core/cqrs/README.md` for architecture details, adding new commands/events, and migration guide.

## Testing

- **Convention:** Colocated sibling tests — `foo.ts` + `foo.test.ts` in the same directory
- **Infrastructure (`src/test/`):** `setup.ts`, `testUtils.ts`, `mocks/` — shared test utilities (stays centralized)
- `check-component-structure.sh` **blocks** (exit 1) when a staged uppercase-named `.tsx`/`.ts` under `src/**/components/` lacks its named folder or a sibling test on disk. `check-missing-tests.sh` covers everything else and only **warns** (always exits 0)
- Run `pnpm run test:coverage` before commit — nothing at commit time does
- **Test files are type-checked.** `tsconfig.test.json` is in the root `tsconfig.json` references, so `pnpm run typecheck` covers every `*.test.ts(x)`, `src/test/**`, `scripts/**/*.test.ts` and `__kernel-tests__` file. Keep it that way — a test that does not type-check can assert against a property that does not exist and still pass.

## Debugging & Bug Fixing

- **Real dependencies only** — never substitute mocks/stubs for runtime libraries (brepjs, Three.js) to bypass setup issues. Fix the loading problem instead.
- **Reproduce first** — write or run a failing test before changing code.
- **Fix all layers** — bugs spanning UI → store → computation must be verified at each layer. Don't stop at the first fix that silences the visible symptom.
- **Geometry/math validation** — after any generation change, verify: output > 0, no NaN/Infinity, correct coordinate system (grid origin bottom-left, Y-up). Run scenario tests:
  ```bash
  pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario
  ```
- **Coordinate transforms** — grid units ↔ mm conversions use `gridUnitMm` (42mm). Height units use `heightUnitMm` (7mm). Never mix unit systems.
- **Common traps**: stale closures in hooks (missing deps), `useShallow` omitted on multi-select, `layers[0]` = bottom (UI reverses display).

## Environment Variables

**Vercel (required):** `BLOB_READ_WRITE_TOKEN`, `REDIS_URL`, `TOKEN_SALT`

**Sign-in (required):** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` — see `api/auth/README.md`. Vercel derives the OAuth redirect base automatically, but local dev must set `OAUTH_REDIRECT_BASE_URL` to the Vite origin: `getBaseUrl()` falls back to `https://localhost:3000`, so sign-in otherwise fails with a redirect URI mismatch.

**Optional:** `VITE_LIVEBLOCKS_PUBLIC_KEY`, `LIVEBLOCKS_SECRET_KEY`, `VITE_PUBLIC_POSTHOG_KEY`, `KOFI_VERIFICATION_TOKEN` (Ko-fi webhook; `/api/kofi-webhook` 503s without it), `COMMUNITY_PUBLISH_ENABLED` (server kill switch for community publishing; unset or anything but `true` makes the publish/update endpoints return 503), `COMMUNITY_ADMIN_TOKEN` (enables admin DELETE on community designs; unset disables it), `COMMUNITY_PRINTS_ENABLED` (kill switch for community print reports, the photo + settings + fit-verdict records on a published design; unset or anything but `true` makes every `/api/community/prints` method return 503. Off by default because prints carry user-submitted photos), `COMMUNITY_REQUIRE_DESCRIPTION` (description-required publish policy; default ON. Publish/update reject a design whose description is empty, under `COMMUNITY_DESCRIPTION_MIN_LENGTH`, or keysmash, unless this is set to the literal string `false`. The server is the final authority; not the `sensitive` type)
