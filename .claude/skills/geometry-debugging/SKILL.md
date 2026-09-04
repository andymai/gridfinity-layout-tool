---
name: geometry-debugging
description: Validate and debug bin/baseplate geometry changes — failing binGenerator.scenario tests, triangleCount snapshot churn, NaN/0-triangle/degenerate meshes, non-manifold or non-watertight exports, preview differs from exported STL/3MF, worker generation timeout or wedged worker, half-grid (x.5) crashes, __kernel-tests__ that never run, BREPJS_KERNEL kernel selection.
---

# Geometry Debugging

## When to use

- A `binGenerator.scenario.*` or `baseplateGenerator.scenario.*` test fails, or a geometry change churns triangleCount snapshots and you must decide whether to `-u`.
- Output mesh has NaN vertices, 0 triangles, or a slicer reports non-manifold/non-watertight geometry.
- The 3D preview and the exported file disagree, or generation times out / the app wedges.
- For pipeline architecture and writing new geometry, see the geometry-generation skill. For vitest workspace generalities, see the testing skill. For slicer-specific 3MF/STL failures, see the print-export skill.

## Mental model

- **Three meshes race for every bin**: synchronous direct mesh (`src/features/generation/worker/generators/binDirectMesh.ts`, gated by `canBinUseDirectMesh`) → Manifold draft kernel → exact OCCT BREP. They are separate implementations; a fix in one does not fix the others, and exports only ever use the OCCT path. Most "preview wrong / export fine" bugs (and the reverse) are parity gaps, not pipeline bugs.
- **Scenario snapshots assert ONLY `triangleCount`** (`__kernel-tests__/scenarioRunner.ts`). A test can pass while geometry is visually wrong, and almost any real change legitimately shifts counts. Positional claims need `customAssert` with helpers from `__kernel-tests__/meshAssertions.ts`: `assertStructurallyValid`, `assertNoDegenerateTriangles`, `boundingBox`, `assertBoundingBoxMatchesParams`, `countWallVerticesInZone`, `assertValidSplit`.
- **Geometry fails silently by design**: features that don't fit a cell are skipped, not errored, and the worker catches OCCT wire-build failures by falling back to a bounding box. Absence of a feature or a plain rectangle where a path cutout should be is a size-threshold or degenerate-input problem, not necessarily a bug in your code path.
- **3D BREP space is Z-up**, XY-centered at the origin, Z=0 at the absolute bottom; `meshAssertions` measures height along Z. CLAUDE.md's "Y-up, origin bottom-left" applies only to the 2D layout grid and cutout editor. Mixing frames produces 90°-rotated or mirrored geometry.
- **Expected outer size subtracts clearance**: `width×42 − 0.5` mm (`GRIDFINITY.GRID_SIZE`, `GRIDFINITY.TOLERANCE`). Do not "fix" a 41.5 mm bin to 42 mm.
- `__kernel-tests__/` (perf, manifold, winding, kernel-lifecycle diagnostics) is excluded from every normal vitest project and runs ONLY via `vitest.profile.config.ts`.

## Recipes

### Validate a geometry change

1. Run the affected domain: `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.<domain>` (all domains: drop `.<domain>`; baseplates: `baseplateGenerator.scenario`). These run real OCCT WASM — `initBrepjs()` takes seconds per worker; never mock it.
2. On failure, read the assertion: structural failures (`NaN`, degenerate triangles) mean broken geometry; snapshot mismatches mean the shape changed — decide if intended.
3. Add coverage in `src/features/generation/worker/generators/scenarios/<domain>.ts` via `defineScenario` (export from `scenarios/index.ts`). Spread nested defaults: `{ base: { ...DEFAULT_BIN_PARAMS.base, stackingLip: true } }` — `buildParams` merges shallowly. `binGenerator.scenarioCoverage.test.ts` fails if a scenarios module lacks a matching test file.
4. Only after confirming the change is intended, update snapshots for the touched domain only: `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.<domain> -u` (filter first, `-u` last — see the geometry-generation skill's argument-order warning). Inspect the `.snap` diff in `__snapshots__/` for orphaned keys if you renamed a category.

### Triage preview-vs-export divergence

1. Identify which of the three meshes is wrong. Export wrong / preview fine → OCCT pipeline or export path; instant draft wrong → `binDirectMesh.ts` (check `canBinUseDirectMesh` — an allowlist gap makes drafts silently omit features); draft-that-appears-after-a-moment wrong → Manifold kernel path.
2. Reproduce the draft-kernel behavior in tests: `BREPJS_KERNEL=manifold pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.dimensions` (valid values: `occt-wasm` default, `brepkit` — alias `wasm`, `manifold`; one kernel per process — no in-process comparisons). Direct-mesh parity is guarded by `binDirectMesh.parity.test.ts`.
3. A preview mesh is NOT watertight by design (base socket rides unfused in `ctx.deferredSolid`; export fuses it). If an export is non-watertight, first confirm the export path ran with `forExport=true` — see the geometry-generation skill for the shell/deferred-solid design.
4. Fix parity in the failing tier; treat parity as part of done. Example of a draft-only fix: `git show e45be1e4b`.

### Diagnose worker timeout / wedged app

1. One timeout on a heavy bin is usually budget, not geometry: `computeGenerationTimeoutMs` in `src/features/generation/bridge/generationTimeout.ts` starts at `BASE_TIMEOUT_MS` (30 s) and scales with feature complexity up to per-operation caps documented there. If a legitimately heavier feature exceeds it, extend the heuristic (and its test) — never raise the flat cap blindly.
2. Everything timing out after one slow generation = wedged worker. A worker stuck in a synchronous WASM boolean cannot read CANCEL messages; recovery must `worker.terminate()` + respawn (`src/features/generation/bridge/GenerationBridge.ts`). Root cause and the arming-before-init rule: `git show 9c12e6b68`.
3. `'Cannot pass deleted object as a pointer of type OcctKernel*'` on regeneration is WASM kernel lifecycle (GC freed the kernel under a live adapter), not your geometry — run `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/occtWasmKernelLifecycle`.
4. A `RuntimeError` trap (`table index is out of bounds`, `memory access out of bounds`, `unreachable`) is not a geometry error: the instance is unusable afterwards, so the worker latches `KERNEL_CRASHED` (`isWasmTrap` in `src/shared/generation/wasmTrap.ts`) and the bridge replaces it instead of retrying in-process. A trap with the heap at the 4 GB wasm32 ceiling is reported as `OUT_OF_MEMORY`: a 4x4x36 goma bin needs more than that to tessellate (#4084). `__kernel-tests__/gomaTallExportProbe` reproduces it against any kernel build and reports heap growth per stage plus the C-stack low-water mark.

### Check export integrity / manifoldness

1. Run the matrix: `pnpm run test:run src/features/generation/worker/generators/binGenerator.export` — every scenario through binary STL export, asserting parseable STL, watertight (no boundary edges), 2-manifold (minus the `MEASURE_ZERO_SELF_CONTACT_SCENARIOS` set in `__kernel-tests__/exportIntegrityRunner.ts`), no NaN.
2. For honeycomb/pattern manifold checks and baseplate winding: `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/honeycombManifoldCheck` (also `__kernel-tests__/diagnoseBaseplateWinding`).
3. Pre-export sanity checks live in `src/features/generation/export/validation.ts` (`validateMeshData`); multi-shell collapse in `worker/generators/utils/outerShell.ts` (`keepOuterShell`); STL fallback for `STL_EXPORT_FAILED` in `worker/generators/utils/stlMeshFallback.ts`.

### Assert manufacturability, not just validity (fit / insertion / wall skin)

The scenario+export matrix proves geometry is _valid_ — watertight, manifold, NaN-free, correctly sized — and passes on parts that are physically unusable. A connector with sub-nozzle undercut prints near-rectangular and pulls straight out (#2637/#2642); a snap clip 4.8 mm wide at the barbs can't enter a 4.1 mm throat (#2638/#2643); a groove cut flush to a wall face deletes the wall there (#1869); 0.6/0.8 mm-nozzle pads too thin for 3 perimeters split under load (#2543/#2560). Any new connector/joint/retention/pad feature needs its physical contract pinned as its own tests — mostly pure-math on constants + one mesh, kept out of `beforeAll` WASM init where possible:

- **Seat + hold**: piece seats with positive clearance AND captures >0 bearing volume (male∩female overlap along the withdrawal axis) on pull-apart. Template: `connectorKeyFit.test.ts`.
- **Insertion path, not just end states**: seated-fit and pull-apart both pass while insertion is geometrically impossible — model the quasi-static insertion stroke. Template: `snapClipInsertion.test.ts` (#2643).
- **Undercut above the FDM swallow budget**: nozzle-radius rounding + first-layer squish + press-fit clearance erase sub-~1 mm undercuts; pin the constant above that budget. Template: `src/shared/constants/connectors.test.ts`.
- **Outer skin survives the cut**: a groove/cut near an exterior face is inset ≥ wallThickness so `outerSkin = wallThickness − clearance > 0` (#1869; [[feedback-validate-print-geometry-assembly]]).
- **Coarsest nozzle**: pad/wall thickness ≥ N × `nozzleSizeMm`; re-run fit at 0.6/0.8 mm and key the mesh cache on nozzle (`baseplateMagnets.test.ts`, #2561) or the 0.4 mm result is silently reused.

### Assert a parameter actually changes the output (dead-control class)

A control wired to the UI but not through to geometry passes every scenario — the shape is valid, just frozen. When the shape/export-cache key also omits the param, two values yield byte-identical output and a snapshot even "confirms" it: #2554 (`connectorFitOffset` dropped in `pieceToBaseplateParams` → −0.3 and +0.3 produced identical STLs), #2384 (half-grid == grid), #2554/#2555 generally. For every param that must move geometry, add a differential test: generate at two meaningfully different values, assert the outputs differ on the axis the param moves (triangleCount / bounding box / bearing volume), and assert the two cache keys differ. Prime suspects: field-by-field param reconstruction (`pieceToBaseplateParams`, `withSocketNozzle`) and cache-key builders.

### Test at half-grid (x.5) dimensions

Any new geometry feature must be exercised at fractional sizes — the recurring crash class is integer assumptions (`Array.from({length: fractional})` truncates while fit-guards use raw values; per-piece param derivation drops `*HalfGrid` fields). Add a `width: 0.5` or `x.5` scenario (pattern: `scenarios/halfSockets.ts`), assert with `assertBoundingBoxMatchesParams` + `assertNoDegenerateTriangles`, and allocate grids via `Math.ceil` while keeping raw fractional values in fit-guards.

## Verification

| Command                                                                                   | Proves                                                                     |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario`       | All bin scenario domains pass on real OCCT (CLAUDE.md-mandated step)       |
| `pnpm run test:run src/features/generation/worker/generators/binGenerator.export`         | Exports are parseable, watertight, manifold, NaN-free                      |
| `pnpm run test:run src/features/generation/worker/generators/baseplateGenerator.scenario` | Baseplate geometry (sockets, margins, connectors, splits)                  |
| `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/<name>`          | Any `__kernel-tests__` diagnostic (forks pool, 1 worker, long timeout)     |
| `pnpm run bench`                                                                          | Perf vs `worker/generators/__bench__/baseline.json` after hot-path changes |

Failure output to expect: structural failures name the scenario and axis (`<label>: width`); a hang followed by `ERROR` at 30 s+ is the watchdog, not a crash.

## Traps

| Symptom                                                       | Cause                                                                                                                                                                                                                                                        | Fix                                                                                                                                                          |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Kernel test "passes" instantly / never runs                   | File is in `__kernel-tests__/`, excluded from all normal vitest projects — plain `pnpm run test:run __kernel-tests__/foo` matches nothing                                                                                                                    | Use `pnpm exec vitest run --config vitest.profile.config.ts <pattern>`; if it should gate CI, move it into the generators project                            |
| Export matrix passes suspiciously fast / uniformly            | `exportBin`'s last-solid cache is param-blind — without a per-scenario reset every case re-exports the first solid, all assertions vacuous                                                                                                                   | `beforeEach(() => setLastSolid(null))` from `shapeCache.ts`, as `__kernel-tests__/exportIntegrityRunner.ts` does; background: `git show 7d935bc55`           |
| Snapshots pass but geometry looks wrong                       | Snapshot is triangleCount only                                                                                                                                                                                                                               | Add `customAssert` using `meshAssertions.ts` helpers for positional/structural claims                                                                        |
| Feature missing from output, no error                         | Silent-skip below printable thresholds (tiny cells, pattern height, handle height)                                                                                                                                                                           | Check size thresholds before suspecting your code; see geometry-generation                                                                                   |
| Parameter edit doesn't change geometry                        | Param missing from a shape-cache key; stale solid served                                                                                                                                                                                                     | Cache-key discipline lives in the geometry-generation skill                                                                                                  |
| Path cutout renders as a plain rectangle in 3D, 2D looks fine | Duplicate consecutive vertices → OCCT rejects the wire → silent bounding-box fallback                                                                                                                                                                        | Dedup via `dropCoincidentPoints` (`src/shared/utils/polyline.ts`) in both editor and worker                                                                  |
| Bounding-box test "off by 0.5 mm"                             | Outer size is `units×42 − 0.5` clearance                                                                                                                                                                                                                     | Assert with `assertBoundingBoxMatchesParams`, don't hand-roll expectations                                                                                   |
| Curved edges coarse despite tolerance plumbing                | brepkit angular tolerances are radians; a degrees-magnitude value silently disables refinement                                                                                                                                                               | Pass `EDGE_ANGULAR_TOLERANCE_RAD` (`src/shared/constants/tessellation.ts`) at every `meshEdges` call site                                                    |
| A split piece differs from the same region of the whole bin   | The split body is built with `omitLipSolid`, NOT as a lipless bin. Clearing `base.stackingLip` also moves `interiorHeight`, the scoop's lip offset and a cutout shoulder's rim plane                                                                         | Keep the flag out of every dimension but `shellKey`; `pipeline/context.test.ts` pins that, and `binGenerator.scenario.split-matches-whole` sweeps the result |
| A feature is open on a whole bin and plugged on a split piece | The split lip is built and fused AFTER the body's cuts, so anything cutting the wall must be handed to it in `splitSolidIntoPieces` too. Its angled support reaches `LIP_TAPER_WIDTH` BELOW the rim, so a wall pattern qualifies, not only cutouts and slots | Cut the lip with the same tool, gated on `getBounds(shape).zMax` against that reach so the common case skips the boolean                                     |
| Crash `a[e] is undefined` only at x.5 sizes                   | Integer assumption on fractional dims                                                                                                                                                                                                                        | Half-grid recipe above                                                                                                                                       |

When stuck, `git log --follow -p <file>` on the touched generator file — fix commits in this repo carry full root-cause analyses and are the best source of truth.

## Seating and interference invariants

These are the defects that pass every automatic check. A ring of feet joined by a lip
is a closed surface; two solids that cannot be assembled are each individually fine.
Bounding-box, triangle-count and watertight assertions all report clean. Probe inside
the volume (`isSolidThrough`, `sectionHalfWidth` in `__kernel-tests__/meshAssertions`),
or mate the pair and sweep (`__kernel-tests__/lidSeating.ts`, `binSeating.ts`).

**State a whole-footprint result as a delta**, against the same bin with the feature
off (for the lip half, against the same bin with `stackingLip: false`, where the lip is
the only variable and no threshold has to be chosen). Thresholds hide sub-millimetre errors: `worstSeatInterference` has a 0.5mm floor
on any bin (1.1mm under asymmetric overhang) that is the lip-in-cavity fit, not a
defect, and the first `lipSupportSeating.kernel` passed against a 0.45mm real loss
because it sat inside a chosen threshold's slack.

### The feet never touch

`buildBaseSocket` sizes each foot `CLEARANCE` narrower than its cell and rounds its
top, so adjacent feet stop 0.5mm apart. The continuous floor comes from the box's
`wallThickness` slab (`shell()` leaves it under the cavity), never from the feet. A
base that skips the box must build that slab itself or it is one island per cell with
a through-slot along every internal grid line.

### A stacking lip is not self-contained

`buildTopShapeLoft` extends the lip `LIP_TAPER_WIDTH` BELOW its own base plane for the
angled support blending it into the wall. Fused onto a shorter wall, that lands inside
the Gridfinity taper and back-fills it to full width, and the foot stops seating in a
baseplate. `dim.lipHasSupport` (`pipeline/context.ts`) asks whether the material under
the lip clears `LIP_TAPER_WIDTH + LIP_OVERLAP`; all three consumers read it. It fires
below a 2.7mm wall: a 1u spacer at the default height unit, any 2u bin at a 3mm unit.

### `totalHeight` already spans the socket

`totalHeight` is `height * heightUnitMm` and `wallHeight` has the socket subtracted, so
`baseOffsetZ + wallHeight` IS `totalHeight` on a socketed or flat base. Adding
`baseOffsetZ` double-counts the 5mm socket and omits the `extraWallHeightMm` collar and
the lip. It is right only for a tray bottom, whose skirt is the one underside
`wallHeight` does not subtract. Read `dimensions.wallTopZ` (body top, where the lip
fuses) or `dimensions.lipTopZ` (the plane a seated lid's `anchorZ` maps to). A 0.7mm
slip put a magnetic lid's bin-side posts 0.5mm inside its own bosses; the same class in
`lidGripDipStage` opens a slot through a 1.2mm wall while leaving the solid watertight.
Verify by mating and probing, never by asserting the arithmetic against a copy of itself.

### A magnetic lid's magnets meeting is not the lid closing

Putting the two magnet faces exactly `LID_MAGNET_SEAT_GAP` apart still shipped a lid
that could not shut: the plane that corrected them drove the bin's gusset pads 2.8mm
into the lid's own mating skirt. The bin pad welds into the interior walls, so its
footprint spans the whole band the skirt drops through, and `LID_MAGNET_LIP_CLEARANCE`
does not help (that keeps the lid's BOSS clear of the bin's LIP, a different pair of
parts). The mating plane is bounded by `wallBottomZ`, not the rim:
`lidRetentionInterfaceZ` takes whichever of the pocket-fit and skirt bounds is deeper.
Landing the boss ON that line keeps the part's lowest point the skirt, so
`trayBottomSkirtDepth` still describes a magnetic tray without learning about bosses.
`magnetSeatGap` probes a ring on the magnet axis and `worstRailInterference` probes the
rail spines: both reported clean through 2.8mm of solid-on-solid overlap.
`worstSeatInterference` sweeps the whole footprint, which is the shape the check needs.

### A foot must land inside ONE pocket, per axis

Baseplate pockets are cut from a solid slab, so the material between two is a ridge:
a knife edge at the top face, widening going down. A full 1u foot centred on a cell
boundary bottoms out 0.25mm into a 5mm pocket and leaves the bin resting 4.75mm proud.
Half-bin mode places bins at 0.5u offsets independently per axis (`useGridCoords.ts`),
so a layout applied to both at once perches on whichever one it got wrong.

- `base.footLatticeX/Y`: `grid` is full cells; `half` is `0.5 + (N-1)·1 + 0.5`, exactly
  `N`, and the only layout seating a half-offset bin without halving every cell
  (16 feet against 36 on a 3x3).
- `base.halfSockets` is placement-agnostic and overrides both lattices: uniform 0.5u
  feet nest inside a pocket at either offset.
- The lattice is exactly complementary to `fractionalEdgeX/Y`. A fractional axis
  already carries a half cell, and putting it on the leading edge IS the seating-correct
  layout, so each axis is answered by one mechanism or the other, never both.

An analytic model of the profile is not verification; it is the arithmetic under test,
restated. `__kernel-tests__/binSeating.ts` mates the bin to a generated plate and lets
it fall: ~4.5-4.75mm seated against ~0-0.33mm perched.

### The top ~3.15mm of a bin's cavity belongs to the lid

A seated click rail hangs `LID_CLICK_RAIL_BAND_BELOW_WALL_TOP` under the bin's wall top
and reaches ~2.8mm inboard of the inner wall face, so any interior feature reaching
that band must be subtracted from the rail run. Compartment dividers are built to the
interior ceiling, 0.7mm below the wall top, so every divider-to-perimeter junction was
3.10mm of solid-on-solid overlap and no bin with a compartment grid could take the
stock lid.

- **The subtraction lives in ONE pure plan.** Three layers consume it: the worker that
  places rails, `computeRailSummary` for the panel, and `checkLidCompatibility` for the
  explanation. The latter two cannot import brepjs, which is why `dividerRailPlan`
  mirrors `labelTabPlan`. They compose: `railSegmentsClearOfBlocks` takes segments, not
  a bare span. Notching is never a whole-wall disable, so those ids go in
  `SIDES_ARE_ADVISORY` or the gaps are discarded before anything measures them.
- **`onOuterWall`-style reasoning is the trap.** An interior-row label tab cannot reach
  the rail on the wall it faces, but it spans its compartment wall to wall and drives
  1.25mm into the LEFT and RIGHT rails. Which walls an obstruction takes is a cross-axis
  question about its footprint, never a property of its anchor.
- Do not correct any of it for overhang: `innerOffsetX/Y` translates the cavity and the
  lid's perimeter together.

**The structural fix is `lid.relieveInterior`**, a ring carved out of the cavity's
perimeter as the LAST pipeline stage, so tree order enforces the rule and a feature
added later is trimmed without its author knowing the lid exists. Three things it must
not do, each invisible if it does:

1. It stops at the stacking lip's INNER face, never the wall's. The void under the
   lip's jut IS the undercut the rail hooks; a cutter overshooting upward leaves a bin
   that looks perfect and holds nothing. Assert the jut band is bit-identical to an
   unrelieved bin, not merely within a threshold.
2. It runs BEFORE `lidRetentionStage`: a magnetic lid's corner pads are interface, not
   contents.
3. Its gate must not consult `shouldGenerateLid`. `checkLidCompatibility` reaches the
   gate through the divider planner and the label shelf datum, so that is unbounded
   recursion.

The label shelf is the one feature the ring must not cut: it hangs off the wall AT the
rim, so trimming it removes the weld rather than the obstruction. Its datum sinks by
`LID_KEEPOUT_BELOW_CEILING_MM` instead. Features reference the interface; they are not
cut by it.

### An absence is an obstruction the interference probes cannot see

A wall cutout or high handle hole takes the lip a rail hooks, so a rail over one grips
nothing while colliding with nothing. `worstSeatInterference` and
`worstRailInterference` both report clean on a lid that does not hold. Ask the opposite
question: wherever the LID has rail, does the BIN still have lip (`ungrippedRailMm`)?

- It routes through the same `WallSpanBlock` fold as dividers and tabs. The
  segmentation is identical, only the verification differs, so a cutout costs the rail
  its own span plus a margin, never its wall. Its span is not `cutWidth` once
  `cornerRadiusTop` rounds the shoulder: that flare reaches full radius exactly at the
  rim, so measure through `safeCutoutCornerRadii`. `lipGaps` says how wide;
  `wallCutouts` and `handles` sit in `SIDES_ARE_ADVISORY`.
- `lid.relieveInterior` is no help: it carves back material that intrudes and cannot
  restore material that was removed. The blocks apply with it on.
- A plan saying "no rail here" must mirror the builder gate for gate. `handleBuilder`
  skips handles on a slotted bin, on the BACK wall of a bin with label tabs, and on any
  hole clamped under 1mm; `computeMultiHandleOffsets` reserves 3mm at each end so a
  100%-wide handle is never cut at all. That also sets the bar for "no lip anywhere":
  a literal zero is unreachable for handles and far too generous for cutouts (98%
  leaves 0.8mm), so the blockers ask whether any surviving stretch reaches
  `LID_MIN_RAIL_LENGTH`, the threshold the placement already uses.
- Custom shapes are covered by a plan of their own: a polygon gap is matched to one
  EDGE, never a side name, because a U faces front with two walls and a cutout sits on
  exactly one. Do not trust "the gate disables it for polygons": `FeatureGate` only
  makes the CONTROLS inert, both builders declare `supportsCellMask`, and `setCellMask`
  never clears `walls.enabled`. That false premise is what left the defect live, and a
  test asserted it.
