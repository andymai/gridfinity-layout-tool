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
8. **The perimeter is the material; the grid extent is not its bound**: the frame keeps the grid fixed and translates the perimeter, so a shift toward an edge the shape touches (or an imported oversize shape) puts the perimeter outside `[0, extent]`. Anything that bounds material by the extent — the generator's slab, split-piece windows, the layout overlay's canvas, the split planner's print-bed budget — must widen by `outlineOverhang`, or that strip is silently cut off (#3169) or overshoots the bed (#3212). Split pieces are the exception: a piece's slab IS its clip window, so only the outermost pieces take their outer side's share — but a piece still frames its outline on its NOMINAL padded extent, never on the widened window, or the perimeter lands inside its own slab and the outer strip is truncated (#3212).
9. **A `dividerOverride` moves the compartment wall, so the grid line is not the compartment edge**: anything sized or placed against a compartment's X extent must go through `compartmentTabXSpan()` (`bin-designer/utils/compartments.ts`), never `-innerW/2 + col * cellW`. Three layers have to agree — the worker shelf (`labelTabBuilder`), the socket plate fit (`labelSocketPlan`) and the ghost overlay (`GhostLabelTabs`) — or the shelf floats off its wall and overhangs the neighbour while its plate is sized for space it does not have (#3225). The eligibility predicates only guard a TILTED anchor wall; a straight `shift` passes them untouched.
10. **The feet never touch, and a stacking lip is not self-contained**: `buildBaseSocket` sizes each foot `CLEARANCE` narrower than its cell and rounds its top, so adjacent feet stop 0.5mm apart — the continuous floor comes from the box's `wallThickness` slab (`shell()` leaves it under the cavity), never from the feet. Any base that skips the box must build that slab itself or it is one island per cell with a through-slot along every internal grid line (#3244). Independently, `buildTopShapeLoft` extends the lip `LIP_TAPER_WIDTH` BELOW its own base plane for the angled support that blends it into the wall, so a lip fused onto a wall shorter than that lands inside the Gridfinity taper and back-fills it to full width — the foot stops seating in a baseplate. Pass `includeLip: false` for the support-free ring when there is no wall under it. Neither defect is visible to a bounding-box, triangle-count, or watertight assertion (a ring of feet joined by a lip is a closed surface): probe inside the volume with `isSolidThrough`/`sectionHalfWidth` from `__kernel-tests__/meshAssertions`.
11. **`bin.update` is the only thing enforcing the size lock**: a bin with `locked: true` (#3229) rejects any change to `width`/`depth`/`height` there, and nothing else in the app is authoritative. Every flow that resizes on the user's behalf must skip locked bins BEFORE dispatching — the group resize, `rotateAll`, `updateMultiHeight`, the linked-design cascade and `resolveExpandToFit` each do, because a batch that stops at the first rejection strands the bins already written. Hiding the affordance is not enough, and neither is trusting the command: the guard compares against the bin's current values, so re-sending an unchanged dimension is deliberately allowed.

12. **Standing a 2D elevation upright: `rotate(+90, X)`, never `-90`**: `rotate(-90, {axis:[1,0,0]})` maps `(x, y, z) → (x, z, -y)`, so a drawing's vertical axis comes out INVERTED — a profile built upward from a plane lands built downward from it. `+90` maps `(x, y, z) → (x, -z, y)`: the drawing's vertical becomes `+Z` and the extrusion becomes `-Y`. The bug hides on any vertically symmetric profile (the lid's scallop tolerates `-90` for exactly this reason) and only surfaces on an asymmetric one — where it silently cuts the wrong part (#3272, the bin lip dip built 3.8mm low, into the wall instead of the lip). Related and separate: `sketchOnPlane('XZ', pos)` negates its Y origin, which put split-connector prisms 40mm off their wall and has its own regression test. Prefer the `sketchOnPlane('YZ', -len/2)` + `extrude(len)` idiom (`buildClickRailBar`) when a section is constant along the run.

13. **Moderation binds to content; a format check is not a cardinality check; a new text field is unmoderated until listed**: three habits behind most of the API's security defects. (a) Moderation state written onto a design's card hash is state the owner can shed — DELETE and PUT block a reset, but re-publishing the payload or deleting the account purges the card, the reports and the reasons, and the dedupe checks only match LIVE designs so the hidden original is invisible to them. Every takedown path therefore writes a `communityModeratedContentKey()` tombstone keyed by CONTENT (no user identifier, so account deletion stays a real erasure); only an admin restore lifts it. The same applies to prints. Relatedly, a response that varies for a hidden vs. missing design is a takedown oracle even when both are 200s — `unlike` leaked the like count this way, because the Lua toggle reads the count off the card hash whatever the status. (b) A strict-looking key regex still describes an infinite key space (`VALID_BIN_SIZE_REGEX` admits `1x1x1.1`, `1x1x1.11`, …), and every distinct key becomes a Redis hash field, so any map written to Redis needs a `MAX_*_ENTRIES` bound alongside its pattern — and a server cap that rejects needs a matching client cap that truncates, or honest oversized payloads are silently dropped. (c) `collectDesignText` moderates a string only if its key is in `TEXT_BEARING_KEYS`, and the designer validators accept text fields whether or not they are listed — so adding a `BinParams` text field without adding its key ships an unmoderated public surface. Strings inside arrays carry their ARRAY's key, not an index.

14. **`totalHeight` already spans the socket, so `baseOffsetZ + totalHeight` is never the rim**: `totalHeight` is `height * heightUnitMm` and `wallHeight` has the socket subtracted, so `baseOffsetZ + wallHeight` IS `totalHeight` on a socketed or flat base. Adding `baseOffsetZ` on top double-counts the 5mm socket, and the expression separately omits the `extraWallHeightMm` collar and the lip. It is right only for a tray bottom (#3036), whose skirt is the one underside `wallHeight` does not already subtract — which is how it got generalised the wrong way in the first place. Read `dimensions.wallTopZ` (body top, where the lip fuses) or `dimensions.lipTopZ` (the plane a seated lid's `anchorZ` maps to) instead of restating the chain. The errors are sub-millimetre and invisible to every mesh check: 0.7mm put a magnetic lid's bin-side posts 0.5mm INSIDE its own bosses so the lid could not close (#3431), and the same class of slip in `lidGripDipStage` opens a slot through a 1.2mm wall while leaving the solid watertight. Verify by mating the two solids and probing — `__kernel-tests__/lidSeating.ts` — never by asserting the arithmetic against a second copy of itself.

15. **A magnetic lid's magnets meeting is not the lid closing, and an aimed probe cannot tell the difference**: fixing #3431 put the two magnet faces exactly `LID_MAGNET_SEAT_GAP` apart and still shipped a lid that physically could not shut (#3450) — because the plane it corrected them ONTO drove the bin's gusset pads 2.8mm into the lid's own mating skirt. The bin pad is not a free-standing post: it welds into the interior walls, so its footprint spans the whole band the skirt drops through, and `LID_MAGNET_LIP_CLEARANCE` does not help (that keeps the lid's BOSS clear of the bin's LIP — a different pair of parts, further out). So the mating plane is bounded by `wallBottomZ`, not by the rim, and the boss is a pillar reaching past its own skirt: `lidRetentionInterfaceZ` takes whichever of the pocket-fit and skirt-clearance bounds is deeper, and `trayBottomSkirtDepth` must count that overhang or a magnetic tray's bosses sink below the print bed. The general lesson is about the tests: `magnetSeatGap` probes a ring on the magnet axis and `worstRailInterference` probes the rail spines — both aimed at a place someone already suspected, both reporting clean through 2.8mm of solid-on-solid overlap. `worstSeatInterference` sweeps the whole footprint instead, and that is the shape a seating check has to have.

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
