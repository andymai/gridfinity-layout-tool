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

Each line is the invariant. The reasoning, the failure it prevents and the test that
catches it live in the named skill, which loads when you work on that subsystem.

1. **Coordinate System**: Grid (0,0) is **bottom-left**. `layers[0]` is bottom. UI reverses via `getDisplayLayers()`.
2. **Staging**: `layerId === '__staging__'` = off-grid stash. Auto-used when bins displaced.
3. **Half-Bin Mode**: 0.5 increments. Helpers: `snapToHalf()`, `snapToGrid()`, `isFractional()`. `HALF_BIN_SCALE = 2`.
4. **Multi-Layout**: Each layout stored by UUID (`gridfinity-layout-{uuid}`). Library index tracks metadata only.
5. **Anything cutting through a wall needs matching border clipping** in `wallPatternBuilder.ts`, or hex prisms bleed into the cut and print jagged. → `geometry-generation`
6. **Compartment IDs are not stable**: `normalizeIds()` renumbers on every merge/split, so parallel arrays (`compartmentTexts`, `labelPlateWidths`, `labelIcons`) must be reindexed via `normalizeIdsWithRemap()`. `setCompartmentGrid` regenerates from scratch: drop the arrays, don't carry them. → `bin-designer`
7. **Never consume `drawer.outline` raw**: go through `@/shared/utils/outlineFrame`, or placeable cells and kept sockets diverge. Authoring editors are the exception. → `geometry-generation`
8. **The grid extent does not bound the material**: the frame translates the perimeter, so it can land outside `[0, extent]`. Anything bounding material by the extent must widen by `outlineOverhang`. Split pieces are the exception, and still frame on their nominal padded extent. → `geometry-generation`
9. **A `dividerOverride` moves the compartment wall**, so the grid line is not the compartment edge. Size and place against `compartmentTabXSpan()`, never `-innerW/2 + col * cellW`. Worker shelf, socket plate and ghost overlay must agree. → `bin-designer`
10. **The feet never touch**: the continuous floor is the box's `wallThickness` slab, not the feet. A base skipping the box must build that slab itself. Separately, a stacking lip needs `LIP_TAPER_WIDTH + LIP_OVERLAP` of material below it: read `dim.lipHasSupport`, never assume. → `geometry-debugging`
11. **`bin.update` is the only thing enforcing the size lock**: every flow that resizes on the user's behalf must skip `locked` bins BEFORE dispatching, or a batch strands the bins already written. Hiding the affordance is not enough. → `bin-designer`
12. **Standing a 2D elevation upright is `rotate(+90, X)`, never `-90`** (which inverts the drawing's vertical). Invisible on a symmetric profile. Prefer the `sketchOnPlane('YZ', -len/2)` + `extrude(len)` idiom. → `geometry-generation`
13. **Moderation binds to content, not to the account**: takedowns write a `communityModeratedContentKey()` tombstone keyed by content, since re-publishing or deleting the account purges the card. Any map written to Redis needs a `MAX_*_ENTRIES` bound plus a client cap that truncates. A new text field is unmoderated until its key is in `TEXT_BEARING_KEYS`. → `share-api-collab`
14. **`totalHeight` already spans the socket**, so `baseOffsetZ + totalHeight` is never the rim. Read `dimensions.wallTopZ` or `dimensions.lipTopZ` instead of restating the chain. Errors here are sub-millimetre and invisible to every mesh check. → `geometry-debugging`
15. **Magnets meeting is not the lid closing**: the mating plane is bounded by `wallBottomZ`, not the rim, because the bin's gusset pads span the band the lid's skirt drops through. Verify by sweeping the whole footprint, never an aimed probe. → `geometry-debugging`
16. **Not every `Mesh` in the preview scene is model geometry**: drei `<Line>` and troika `<Text>` are `Mesh` subclasses whose shape lives in instanced attributes, so `exportPreviewGlb` must filter on `isInstancedBufferGeometry`. Never filter by library name. → `three-preview`
17. **Which foot layout seats is a function of where the bin sits, per axis**: a full 1u foot centred on a cell boundary perches on the ridge between two pockets. `base.footLatticeX/Y` answers a half-offset axis; `halfSockets` is the placement-agnostic override; `fractionalEdgeX/Y` already answers a fractional axis. → `geometry-debugging`
18. **The top ~3.15mm of a bin's cavity belongs to the lid**: any interior feature reaching that band must be cut from the lid's rail run, via the one shared plan (`dividerRailPlan`, `labelTabPlan`). Which walls an obstruction takes is a question about its footprint, never about its anchor. `lid.relieveInterior` enforces it as the last pipeline stage. → `geometry-debugging`
19. **An absence is an obstruction too**: a cutout or handle hole removes the lip a rail hooks, so the rail grips nothing while colliding with nothing. Ask whether the bin still has lip wherever the lid has rail (`ungrippedRailMm`). `relieveInterior` cannot restore removed material. → `geometry-debugging`
20. **A STEP export is a different operation from an STL one**: `format` forks at the piece, `EXPORT_COMBINED` returns one compound containing the bin, so a split export's companion pass needs `separatePieces`. Verify by re-importing and measuring, never by byte length or piece count. → `print-export`
21. **A cut sized off the cell is not sized off the foot**: a foot's bottom face is `SOCKET_TAPER_WIDTH` narrower per side. Cut a scaled copy of the socket profile, not a prism plus a clamp. Use `liteFloorOpen`, not `dimensions.lightweight`, for "is the interior floor gone". → `geometry-generation`
22. **A knife slot's open end is a wall breach**: `knifeSlotWallExits` is the one statement of where the exits are, and `planKnifeRest` the one statement of the rest. A block and its rest are two bins sharing a `pairId`. → `geometry-generation`
23. **Type is a plan**: `@/shared/utils/typePlan` is the one statement of where glyphs land; worker, panel, specimen and ghost overlay all read it. `sketchText` negates `startX` but not `startY`. The fit and the placement must reserve the same vertical extent. → `geometry-generation`

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

**Optional:** `VITE_LIVEBLOCKS_PUBLIC_KEY`, `LIVEBLOCKS_SECRET_KEY`, `VITE_PUBLIC_POSTHOG_KEY`, `KOFI_VERIFICATION_TOKEN` (Ko-fi webhook; `/api/kofi-webhook` 503s without it), `COMMUNITY_PUBLISH_ENABLED` (server kill switch for community publishing; unset or anything but `true` makes the publish/update endpoints return 503), `COMMUNITY_ADMIN_TOKEN` (enables admin DELETE on community designs; unset disables it), `COMMUNITY_PRINTS_ENABLED` (kill switch for community print reports, the photo + settings + fit-verdict records on a published design; unset or anything but `true` makes every `/api/community/prints` method return 503. Off by default because prints carry user-submitted photos), `COMMUNITY_REQUIRE_DESCRIPTION` (description-required publish policy; default ON. Publish/update reject a design whose description is empty, under `COMMUNITY_DESCRIPTION_MIN_LENGTH`, or keysmash, unless this is set to the literal string `false`. The server is the final authority; not the `sensitive` type)
