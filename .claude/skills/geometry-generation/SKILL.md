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

## Wall-pattern border rule (depth beyond CLAUDE.md gotcha 5)

Clip geometry lives in `wallPatternClips.ts`, wired in `wallPatternBuilder.ts`. Clip extrusion must satisfy `clipExtrudeDepth ≥ cutDepth + 1` (see line ~100). A wall-penetrating feature needs matching cuts in THREE systems: the wall pattern clip, the interior dividers, and the stacking lip — forgetting any one produces jagged edges or blocked openings (`git show 2aebac7f9`). The bottom keep-out is `wallThickness + BOTTOM_SOLID_SKIRT`, not `max(...)` (wallPatterns.ts); `computeHoneycombWallReduction` in `src/features/bin-designer/utils/printEstimates.ts` re-declares `TOP_KEEP_OUT`/`BOTTOM_SOLID_SKIRT` inline — change them in lockstep.

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
