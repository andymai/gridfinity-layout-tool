# CLAUDE.md

Gridfinity Layout Tool: React + TypeScript web app for 3D-printed drawer organizer layouts.

## Git & Quality

- **Main is protected** - all changes via PRs
- Pre-commit hooks enforce lint-staged, module boundaries, i18n (4 checks), exhaustiveness, affected tests, component structure, missing tests, readme reminders

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

1. **Coordinate System**: Grid (0,0) is **bottom-left**. `layers[0]` is bottom. UI reverses via `getDisplayLayers()`.
2. **Staging**: `layerId === '__staging__'` = off-grid stash. Auto-used when bins displaced.
3. **Half-Bin Mode**: 0.5 increments. Helpers: `snapToHalf()`, `snapToGrid()`, `isFractional()`. `HALF_BIN_SCALE = 2`.
4. **Multi-Layout**: Each layout stored by UUID (`gridfinity-layout-{uuid}`). Library index tracks metadata only.
5. **Wall Pattern Border Rule**: Any feature that cuts through a wall (cutouts, handles, etc.) MUST have corresponding border clipping in `wallPatternBuilder.ts`. Cutout/handle clips use `CUTOUT_BORDER_WIDTH` (1.5mm); divider junction clips use `max(CUTOUT_BORDER_WIDTH, shapeRadius)` so larger hex prisms (4u+ bins) can't bleed into divider walls. Without border clipping, hex prisms overlap the cut region producing jagged edges.
6. **Compartment IDs are not stable**: `normalizeIds()` renumbers `compartments.cells` on every merge/split, so any parallel per-compartment array (e.g. `compartmentTexts`) must be reindexed in lockstep via `normalizeIdsWithRemap()` + `remapCompartmentTexts()`. Resetting the grid (`setCompartmentGrid`) regenerates IDs from scratch — drop parallel arrays rather than carry ghost values onto unrelated cells.
7. **Custom-perimeter frame**: never consume `drawer.outline` raw for gating/rendering/generation — go through `@/shared/utils/outlineFrame` (lattice registration + `drawer.gridShiftX/Y`), or the layout's placeable cells and the plate's kept sockets diverge (#3157). Authoring editors are the exception (raw anchor); the stored outline is never mutated by the frame (#3149).
8. **The perimeter is the material; the grid extent is not its bound**: the frame keeps the grid fixed and translates the perimeter, so a shift toward an edge the shape touches (or an imported oversize shape) puts the perimeter outside `[0, extent]`. Anything that bounds material by the extent — the generator's slab, split-piece windows, the layout overlay's canvas — must widen by `outlineOverhang`, or that strip is silently cut off (#3169). Split pieces are the exception: a piece's slab IS its clip window, so only the outermost pieces take their outer side's share.

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
- Pre-commit **blocks** if edited component file has no sibling test
- Run `pnpm run test:coverage` before commit
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

**Optional:** `VITE_LIVEBLOCKS_PUBLIC_KEY`, `LIVEBLOCKS_SECRET_KEY`, `VITE_PUBLIC_POSTHOG_KEY`, `KOFI_VERIFICATION_TOKEN` (Ko-fi webhook; `/api/kofi-webhook` 503s without it), `COMMUNITY_PUBLISH_ENABLED` (server kill switch for community publishing; unset or anything but `true` makes the publish/update endpoints return 503), `COMMUNITY_ADMIN_TOKEN` (enables admin DELETE on community designs; unset disables it), `COMMUNITY_PRINTS_ENABLED` (kill switch for community print reports, the photo + settings + fit-verdict records on a published design; unset or anything but `true` makes every `/api/community/prints` method return 503. Off by default because prints carry user-submitted photos), `COMMUNITY_REQUIRE_CUTOUTS` (cutout-only launch policy; default ON. Publish/update reject a bin with no tool cutout unless this is set to the literal string `false`, the relax-later lever. The server is the final authority; not the `sensitive` type)
