---
name: geometry-generation
description: BREP generation pipeline in src/features/generation — adding/changing bin features (cutouts, handles, patterns, text), wall-pattern border clipping, overhang/inner dims, shapeCache keys, dual-kernel draft-vs-export parity, generation.worker.ts / WASM kernel lifecycle, brepjs bumps. Symptoms — jagged wall edges, stale preview after param edit, draft missing a feature, non-manifold export, "Cannot pass deleted object", timeouts after generator changes.
---

# Geometry Generation

Read `src/features/generation/README.md` FIRST — it documents the pipeline stages, worker protocol, draft tiers, 9 gotchas, and 3MF compat, and it is current. This skill adds only what that README and CLAUDE.md do not cover. For validating/debugging a change see the geometry-debugging skill; for 3MF/STL/STEP slicer traps see print-export; for the compartment/cellMask data model see bin-designer; for how meshes reach the screen see three-preview.

## When to use

- Adding or modifying any bin/baseplate geometry feature in `src/features/generation/worker/generators/`
- A preview shows stale, missing, or bleeding geometry after a parameter change
- Touching worker lifecycle, kernel init, or bumping brepjs/occt-wasm
- Changing a Gridfinity spec constant or wall-pattern keep-out

## Mental model

1. **The 3D kernel frame is Z-UP**, XY-centered at the origin (walls at ±outerW/2); after `pipeline/stages/translateStage.ts` lifts socket bins by `SOCKET_HEIGHT`, Z=0 is the absolute bottom. CLAUDE.md's "Y-up, origin bottom-left" applies only to 2D spaces (layout grid, cutout editor). Cameras are built Z-up in `src/shared/components/preview/CameraRig.tsx` — never rotate meshes to compensate. Mixing frames yields geometry rotated 90° or mirrored.
2. **Three geometry paths race per bin**: synchronous direct mesh (`binDirectMesh.ts`, no brepjs) → Manifold draft kernel → exact OCCT. They are SEPARATE implementations; a fix in one does not fix the others (see `git show e45be1e4b` and `b17779575` — one was draft-only, one export-only). Exports use only the OCCT path. Parity is part of definition of done: `binDirectMesh.parity.test.ts`.
3. **`canBinUseDirectMesh` (binDirectMesh.ts) is an allowlist.** Any new camera-visible feature or base style must either be rejected there (degrades to no-instant-draft, never a wrong mesh) or implemented in the procedural emitters — otherwise drafts silently omit it.
4. **Preview never fuses the base socket; export must.** `shellStage.ts` carries the socket in `ctx.deferredSolid`; the export path (`forExport=true`) fuses it for watertightness (`git show 3c1ad13d1`). Any stage that translates `ctx.solid` must translate `ctx.deferredSolid` identically or the socket floats.
5. **Interior placement goes through `deriveDimensions`** in `pipeline/context.ts` (`innerW/innerD/innerOffsetX/innerOffsetY`). Nominal outer size minus wall thickness is wrong whenever overhang is set; asymmetric overhang also shifts the cavity center (`git show d971fce0c`). Expected outer width is `width×42 − 0.5` (`GRIDFINITY.TOLERANCE` clearance) — do not "fix" a 41.5mm bin to 42mm.
6. **Cache keys and shape ownership**: `shapeCache.ts` owns originals; callers get `unwrap(clone(x))` and must `.delete()` shapes they replace. Every param that changes cached geometry must be `quantize()`d into the cache key (`cutoutKeyPart`/`handleKeyPart` pattern in `wallPatternBuilder.ts`); clip params go in the clipped key, NEVER the base compound key. `wallPatterns.ts` is deliberately brepjs-free — shapes crossing module boundaries risk WASM GC invalidation.
7. **Exactly coplanar faces break OCCT booleans**: give mating solids `COPLANAR_OVERLAP` (0.01mm) volumetric overlap and extend cutters by `COPLANAR_MARGIN` (1mm), both in `generatorConstants.ts`. Slicers "repair" the resulting non-manifold topology as solid infill.

## Wall-pattern border rule

Clip geometry lives in `wallPatternClips.ts`, wired in `wallPatternBuilder.ts`. Clip extrusion must satisfy `clipExtrudeDepth ≥ cutDepth + 1` (see line ~100). A wall-penetrating feature needs matching cuts in THREE systems: the wall pattern clip, the interior dividers, and the stacking lip — forgetting any one produces jagged edges or blocked openings (`git show 2aebac7f9`). The bottom keep-out is `wallThickness + BOTTOM_SOLID_SKIRT`, not `max(...)` (wallPatterns.ts); `src/features/bin-designer/utils/printEstimates.ts` re-declares `TOP_KEEP_OUT`/`BOTTOM_SOLID_SKIRT` inline (and carries the `PATTERN_VOID_FRACTION` open-area table) — change them in lockstep.

Clip widths differ by what is being cleared. Cutout and handle clips use `CUTOUT_BORDER_WIDTH` (1.5mm); divider junction clips use `max(CUTOUT_BORDER_WIDTH, shapeRadius)`, so the larger hex prisms on 4u+ bins cannot bleed into the divider walls.

## Test topology (not documented elsewhere)

- Generator tests are the `generators` vitest project (`src/features/generation/worker/generators/**/*.test.ts`) and load REAL OCCT WASM — no mocks, ever. `initBrepjs()` in `beforeAll` is mandatory.
- Scenario data lives in `scenarios/<domain>.ts`; each domain runs in its own `binGenerator.scenario.<domain>.test.ts` (parallelism is why — keep one file per domain).
- Scenario "snapshots" record ONLY `triangleCount` (`__kernel-tests__/scenarioRunner.ts`). A change can pass snapshots with visually wrong geometry, and nearly any real change legitimately shifts counts. For positional claims use `customAssert` with `boundingBox`/`countWallVerticesInZone` from `__kernel-tests__/meshAssertions.ts`.
- `__kernel-tests__/` is excluded from every normal vitest project — `pnpm run test:run __kernel-tests__/foo` fails with "No test files found". Run them only via `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/<name>`.
- `BREPJS_KERNEL=manifold|brepkit|occt-wasm` switches the test kernel (`__kernel-tests__/wasmInit.ts`); one kernel per process.
- `brep-parts/` is a standalone prototyping sandbox (eslint-ignored, never imported by the app). Do not wire app code to it or delete it as dead code.

## Recipes

### Add or modify a feature that cuts through a wall

1. Implement the builder in `src/features/generation/worker/generators/` (`wallCutoutBuilder.ts` and `handleBuilder.ts` are the references); register new builders in `BIN_FEATURE_BUILDERS` (`pipeline/featureComposition.ts`), which `pipeline/stages/featuresStage.ts` runs. Consume `innerW/innerD/innerOffsetX/Y` from `pipeline/context.ts`, never nominal dims.
2. Add border clipping: geometry in `wallPatternClips.ts`, wiring in `wallPatternBuilder.ts`, expanding by `CUTOUT_BORDER_WIDTH` (junctions: `max(CUTOUT_BORDER_WIDTH, shapeRadius)`). Verify dividers and the stacking lip are cut too.
3. Add every new user-visible param, `quantize()`d, to the clipped cache key — not the base key.
4. Update `canBinUseDirectMesh` in `binDirectMesh.ts` to reject bins using the feature (or implement the emitter).
5. Add scenarios to `scenarios/<domain>.ts` via `defineScenario`, combining the feature WITH `wallPattern` enabled and with dividers. Nested overrides shallow-merge: spread defaults first, e.g. `{ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } }`.
6. Test the matrix history says breaks: overhang (symmetric AND asymmetric), half-grid x.5 sizes, magnet/screw base, split/oversized bins.

### Add a new scenario domain

1. Create `scenarios/<domain>.ts` exporting cases built with `defineScenario('<category>', '<name>', {...})`; export from `scenarios/index.ts`.
2. Create `binGenerator.scenario.<domain>.test.ts` containing only the import plus `runScenarios(cases)`.
3. First run writes the snapshot file: `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.<domain>`.

### Change a spec constant or keep-out

1. Spec source of truth is `GRIDFINITY_SPEC` in `src/shared/printSettings/gridfinityGeometry.ts` (re-exported as `GRIDFINITY`); derived worker constants in `generatorConstants.ts`. Dovetail/connector constants live in `@/shared/constants/connectors` (module boundary).
2. If touching `TOP_KEEP_OUT`/`BOTTOM_SOLID_SKIRT`/`CUTOUT_BORDER_WIDTH`, update `printEstimates.ts` in lockstep (see above).
3. Expect broad triangleCount churn; verify bounding boxes on a few domains before mass `-u`. Run baseplate scenarios too.

### Bump brepjs / occt-wasm

1. Bump both together (pinned as a pair; deliberate cooldown — don't accept Dependabot bumps blindly): see `git show --stat 9aeeb925a` for the shape.
2. Confirm `vite.config.ts` still lists `occt-wasm` in `optimizeDeps.exclude` and the kernel-wrapper pin against GC use-after-free is intact (`git show 6b45ec83b`).
3. Re-verify the textBuilder linear-metrics assumption (README gotcha 6) and that `meshEdges` call sites pass `EDGE_ANGULAR_TOLERANCE_RAD` from `src/shared/constants/tessellation.ts` — RADIANS; a degrees-magnitude value silently disables edge refinement.
4. Run the full generators project, `__kernel-tests__` diagnostics (`diagnoseBaseplateWinding`, `occtWasmKernelLifecycle`), `pnpm run bench` vs `__bench__/baseline.json`, and smoke-test Safari/iOS (kernel loads broke there twice).
5. Bump `MESH_CACHE_VERSION` in `src/shared/generation/meshPersistence.ts` — it keys the cross-session IndexedDB cache of preview meshes; a stale value would serve last-build meshes from a returning user's disk. Any tessellation-tolerance change needs the same bump.

## Verification

```bash
pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario
pnpm run test:run src/features/generation/worker/generators/baseplateGenerator.scenario
pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.<domain> -u
pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/honeycombManifoldCheck
pnpm run check:boundaries
pnpm run bench
```

Argument order matters: `test:run -- <filter>` and `test:run -u <filter>` both silently run (and with `-u`, update) the ENTIRE suite — filter first, `-u` last, no `--`.

Failure looks like: `toMatchSnapshot` triangleCount diffs (expected churn — verify intent before `-u`), `assertStructurallyValid` NaN/degenerate-triangle throws, or `Call initBrepjs() in beforeAll first`. Cross-feature imports of generation code must go through `src/shared/generation/*` facades (`bridge.ts`, `directMesh.ts`) or `check:boundaries` fails pre-commit.

## Traps

| Symptom                                                       | Cause                                                                                                                                                                                                           | Fix                                                                                                                                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Param edit doesn't change preview                             | Param missing from a shapeCache key                                                                                                                                                                             | Add it `quantize()`d to the right key; `binResumeCache.test.ts`, `baseplateCacheKeys.test.ts` show the test pattern                                                      |
| Draft missing a feature that appears seconds later            | `canBinUseDirectMesh` allowed a bin the emitters can't render                                                                                                                                                   | Reject it in the gate or implement the emitter; check `binDirectMesh.parity.test.ts`                                                                                     |
| Feature silently absent from output                           | Tiny cells: features are skipped, not errored (README gotcha 3; `wallPatternBuilder` `continue`s whole walls)                                                                                                   | Check size thresholds (`getMinPatternHeight` etc.) before suspecting your code path                                                                                      |
| Slicer reports non-manifold / fills bin solid                 | Coplanar faces at a fuse/cut interface, or unfused deferred socket leaked into export                                                                                                                           | Apply `COPLANAR_OVERLAP`/`COPLANAR_MARGIN`; confirm export runs `forExport=true`                                                                                         |
| STL export throws, preview fine                               | OCCT `StlAPI` rejects some valid topologies                                                                                                                                                                     | Route through `exportSolidToStl` in `utils/stlMeshFallback.ts`; keep OCCT primary so 3MF faceGroups stay aligned                                                         |
| `Cannot pass deleted object as a pointer of type OcctKernel*` | WASM GC freed a borrowed kernel or shape                                                                                                                                                                        | Kernel wrapper stays pinned for worker lifetime; shapes: `unwrap(clone())` + `.delete()` discipline                                                                      |
| Worker breaks only at runtime after import reorder            | `generation.worker.ts` requires `import './symbolDisposePolyfill'` FIRST (brepjs uses `Symbol.dispose` at load)                                                                                                 | Restore import order                                                                                                                                                     |
| Path cutout generates as a plain rectangle                    | Duplicate consecutive vertices make the OCCT wire build throw; the worker's `catch` silently falls back to a bounding box                                                                                       | Dedup via `dropCoincidentPoints` (`src/shared/utils/polyline.ts` — one shared source for editor AND worker); never add a silent geometry fallback (`git show 53ea52ee2`) |
| Complex bin times out                                         | `computeGenerationTimeoutMs` watchdog in `bridge/generationTimeout.ts` scales a 30s base with pattern/cutouts/footprint/height, capped at `MAX_TIMEOUT_MS` (180s); exports get a 6× multiplier capped at 20 min | If the feature legitimately costs more, extend the heuristic + its test; never raise the caps blindly. Wedge diagnosis: geometry-debugging skill                         |
| Kernel test "passes" instantly                                | File in `__kernel-tests__/` is invisible to normal vitest                                                                                                                                                       | Run via `vitest.profile.config.ts`, or move it into the generators project if it should gate CI                                                                          |

Commit bodies here contain root-cause analyses and upstream references — `git log --follow -p <file>` before changing anything in the pipeline.

## Construction invariants

### The perimeter is the material; the grid extent is not its bound

Never consume `drawer.outline` raw for gating, rendering or generation. Go through
`@/shared/utils/outlineFrame` (lattice registration + `drawer.gridShiftX/Y`), or the
layout's placeable cells and the plate's kept sockets diverge. Authoring editors are
the exception (raw anchor); the frame never mutates the stored outline.

The frame keeps the grid fixed and translates the perimeter, so a shift toward an edge
the shape touches, or an imported oversize shape, puts the perimeter outside
`[0, extent]`. Anything bounding material by the extent must widen by `outlineOverhang`:
the generator's slab, split-piece windows, the layout overlay's canvas, the split
planner's print-bed budget. Otherwise that strip is silently cut off, or the piece
overshoots the bed.

Split pieces are the exception. A piece's slab IS its clip window, so only the
outermost pieces take their outer side's share, and a piece still frames its outline on
its NOMINAL padded extent, never on the widened window, or the perimeter lands inside
its own slab and the outer strip is truncated.

### Standing a 2D elevation upright

`rotate(-90, {axis:[1,0,0]})` maps `(x, y, z)` to `(x, z, -y)`, so a drawing's vertical
axis comes out INVERTED: a profile built upward from a plane lands built downward from
it. `+90` maps `(x, y, z)` to `(x, -z, y)`, so the drawing's vertical becomes `+Z` and
the extrusion becomes `-Y`.

The bug hides on any vertically symmetric profile (the lid's scallop tolerates `-90`
for exactly this reason) and surfaces only on an asymmetric one, where it silently cuts
the wrong part. The bin lip dip was built 3.8mm low, into the wall instead of the lip.

Related and separate: `sketchOnPlane('XZ', pos)` negates its Y origin, which put split
connector prisms 40mm off their wall and has its own regression test. Prefer the
`sketchOnPlane('YZ', -len/2)` + `extrude(len)` idiom (`buildClickRailBar`) when a
section is constant along the run.

### A cut sized off the cell is not sized off the foot

A foot's bottom face is `SOCKET_TAPER_WIDTH` (3.2mm) narrower than its cell on each
side, so any underside pocket described as "leave an N mm border" breaches the
baseplate-mating taper for every N below that.

`base.lightweightMode: 'underside'` sidesteps the class by cutting a SCALED COPY of the
socket profile rather than a prism: the profile's insets are absolute, so an inner foot
built at `cell - 2k` is a uniform `k` wall at every depth and cannot reach the taper at
any `k`. Prefer that construction wherever a foot is relieved. A clamp is an invariant
someone has to remember; the scaled copy is one nobody can violate.

Two traps around it:

- The relief's open direction is `zShift 0` with NO floor opening. The `'down'`
  direction leaves a `wallThickness` membrane under a floor that is already solid: a
  slab of dead material across the whole footprint that does not even shorten the
  bridge above it.
- `dimensions.lightweight` conflates two questions. Use `liteFloorOpen` for "is the
  interior floor gone" (false for the relief, false for a solid bin, true for a spacer),
  because every gate reading the flag (scoop ramp, floor pattern, inserts, the lid's
  click-rail check) is asking that second question.

**Do not trust a calibration table you have not reproduced.** `BASE_VOL_PER_CELL_AREA`
had been fitted to a ground-truth set that omitted the base socket, so every socketed
bin's filament estimate read 1.7-3.0x low: a solid 1u foot is ~7300mm³, more than the
entire volume a 1x1x3u bin was recorded at. The refit is 5.3785 against ten re-measured
bins, worst residual 1.1%. Generate the bin and take `meshVolume`, which is also how the
per-cell lite savings were established rather than derived (6398 interior, 5174
underside, 4332 and 2458 on half sockets, constant to the millimetre across sizes).

### A knife slot's open end is a wall breach with a plan

`buildKnifeBreachChannels` (`cutoutBuilder.ts`) cuts the blade exit unclipped through
wall, collar and stacking lip. `knifeSlotWallExits` (`lipGapPlan.ts`) is the ONE
statement of where those exits are: the lid's rail plan reads it as the `knifeSlot`
lip-gap source, and any future consumer must read it too, never re-derive sides from
rotation. (A sentinel in `binGenerator.scenario.knifeBlock` pins that wall patterns do
not reach solid hosts today.)

The physical model lives in `types/knifeBlock.ts`: spine flush with the fill top, edge
floating `KNIFE_SLOT_EDGE_FLOAT` above the slot floor, saddle = fill top − handle
diameter − drop. `planKnifeRest` (`shared/utils/knifeRestPlan.ts`) turns that into the
rest: companion top snapped UP to whole height units, each groove cut deeper to its own
knife's saddle. The worker's solid, the preview placement
(`knifeRestMatedOffset`), the STEP assembly translate, the registry footprint
(`registryKnifeRestFields`) and the layout pairing all read it; none may restate it.

In the layout a block and its rest are TWO bins sharing a `pairId` (`binPairs.ts`;
set-expanding operations pull the partner in), never one bin with two rects. The layout
export planner skips `pairRole: 'rest'` bins because the block's combined export
already emits the `knife-rest` piece.

Slot pitch is a physical constraint the geometry cannot see: handles are ~23mm wide, so
slots closer than ~27mm hold blades whose knives cannot lie side by side, and the
saddle cradles merge into one scallop.

### Type is a plan

`@/shared/utils/typePlan` is the one statement of where a caption's glyphs land: case,
line splitting and wrapping, tracking, size resolution, the cap-height datum, optical
centering, flush-to-margin. The worker's `textBuilder` turns it into solids,
`wallTextPlan` chooses which clear region of a wall hosts it, the panel's specimen draws
it, and the designer's ghost overlay draws it in 3D. Font access arrives through an
injected `TypeMeasurer` (opentype via `brepjs/text`), which is what lets the main thread
run the same solver the kernel does.

Four traps, each invisible to the obvious check:

1. `sketchText` NEGATES `startX` and does not negate `startY`, so every pen position is
   handed over inverted through `sketchRunAtPen`. A single untracked line always
   sketches at zero, so the fast path never shows it; the mirroring appears only once a
   caption is tracked, wrapped or tapered, and it moves the whole run to the wrong side
   of its host. Pinned by a kernel test against `sketchText` directly, so a brepjs bump
   that fixes the negation fails loudly instead of silently restoring the bug.
2. The fit and the placement must reserve the SAME vertical extent. The bottom anchor
   sits the last BASELINE on the font's descender, never the string's own ink, or a
   caption without descenders sits lower than its neighbour with one. `measureBlock`
   budgets that same reserve. Budgeting the ink instead let a caption fit on paper and
   then overflow the top of its host once anchored, into the stacking-lip keep-out.
   Found by RENDERING a specimen sheet; every unit test passed.
3. The cap-height datum makes the vertical box a constant of the face and size, so a
   descender no longer changes the fitted size. Any test using a descender as a
   "shrinks the shared size" lever is testing nothing. Use a longer caption: width is
   what still separates two runs.
4. `margin` is one design-wide number serving a 100mm wall and an 8mm label tab, so the
   plan caps it at a fraction of the host's own smaller dimension. A `plaque` host (a
   tab, a plate, which IS the caption's frame) collapses the anchor's vertical zone to
   centred while keeping its horizontal intent.

New designs start on `TEXT_PRESETS.engineering` while `migrateParams` backfills the
NEUTRAL `DEFAULT_TEXT_STYLE_DEFAULTS`, so a design saved before the type system renders
as it always did. Test fixtures measuring a host's own math must pin the neutral style
too, or every threshold in them re-tunes the next time the shipped look changes.
