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

### Check export integrity / manifoldness

1. Run the matrix: `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.export-integrity` — every scenario through binary STL export, asserting parseable STL, watertight (no boundary edges), 2-manifold (minus the documented `MEASURE_ZERO_SELF_CONTACT_SCENARIOS` set), no NaN.
2. For honeycomb/pattern manifold checks and baseplate winding: `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/honeycombManifoldCheck` (also `__kernel-tests__/diagnoseBaseplateWinding`).
3. Pre-export sanity checks live in `src/features/generation/export/validation.ts` (`validateMeshData`); multi-shell collapse in `worker/generators/utils/outerShell.ts` (`keepOuterShell`); STL fallback for `STL_EXPORT_FAILED` in `worker/generators/utils/stlMeshFallback.ts`.

### Test at half-grid (x.5) dimensions

Any new geometry feature must be exercised at fractional sizes — the recurring crash class is integer assumptions (`Array.from({length: fractional})` truncates while fit-guards use raw values; per-piece param derivation drops `*HalfGrid` fields). Add a `width: 0.5` or `x.5` scenario (pattern: `scenarios/halfSockets.ts`), assert with `assertBoundingBoxMatchesParams` + `assertNoDegenerateTriangles`, and allocate grids via `Math.ceil` while keeping raw fractional values in fit-guards.

## Verification

| Command                                                                                              | Proves                                                                     |
| ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario`                  | All bin scenario domains pass on real OCCT (CLAUDE.md-mandated step)       |
| `pnpm run test:run src/features/generation/worker/generators/binGenerator.scenario.export-integrity` | Exports are parseable, watertight, manifold, NaN-free                      |
| `pnpm run test:run src/features/generation/worker/generators/baseplateGenerator.scenario`            | Baseplate geometry (sockets, margins, connectors, splits)                  |
| `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/<name>`                     | Any `__kernel-tests__` diagnostic (forks pool, 1 worker, long timeout)     |
| `pnpm run bench`                                                                                     | Perf vs `worker/generators/__bench__/baseline.json` after hot-path changes |

Failure output to expect: structural failures name the scenario and axis (`<label>: width`); a hang followed by `ERROR` at 30 s+ is the watchdog, not a crash.

## Traps

| Symptom                                                       | Cause                                                                                                                                      | Fix                                                                                                                                                     |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kernel test "passes" instantly / never runs                   | File is in `__kernel-tests__/`, excluded from all normal vitest projects — plain `pnpm run test:run __kernel-tests__/foo` matches nothing  | Use `pnpm exec vitest run --config vitest.profile.config.ts <pattern>`; if it should gate CI, move it into the generators project                       |
| Export matrix passes suspiciously fast / uniformly            | `exportBin`'s last-solid cache is param-blind — without a per-scenario reset every case re-exports the first solid, all assertions vacuous | `beforeEach(() => setLastSolid(null))` from `shapeCache.ts`, as `binGenerator.scenario.export-integrity.test.ts` does; background: `git show 7d935bc55` |
| Snapshots pass but geometry looks wrong                       | Snapshot is triangleCount only                                                                                                             | Add `customAssert` using `meshAssertions.ts` helpers for positional/structural claims                                                                   |
| Feature missing from output, no error                         | Silent-skip below printable thresholds (tiny cells, pattern height, handle height)                                                         | Check size thresholds before suspecting your code; see geometry-generation                                                                              |
| Parameter edit doesn't change geometry                        | Param missing from a shape-cache key; stale solid served                                                                                   | Cache-key discipline lives in the geometry-generation skill                                                                                             |
| Path cutout renders as a plain rectangle in 3D, 2D looks fine | Duplicate consecutive vertices → OCCT rejects the wire → silent bounding-box fallback                                                      | Dedup via `dropCoincidentPoints` (`src/shared/utils/polyline.ts`) in both editor and worker                                                             |
| Bounding-box test "off by 0.5 mm"                             | Outer size is `units×42 − 0.5` clearance                                                                                                   | Assert with `assertBoundingBoxMatchesParams`, don't hand-roll expectations                                                                              |
| Curved edges coarse despite tolerance plumbing                | brepkit angular tolerances are radians; a degrees-magnitude value silently disables refinement                                             | Pass `EDGE_ANGULAR_TOLERANCE_RAD` (`src/shared/constants/tessellation.ts`) at every `meshEdges` call site                                               |
| Crash `a[e] is undefined` only at x.5 sizes                   | Integer assumption on fractional dims                                                                                                      | Half-grid recipe above                                                                                                                                  |

When stuck, `git log --follow -p <file>` on the touched generator file — fix commits in this repo carry full root-cause analyses and are the best source of truth.
