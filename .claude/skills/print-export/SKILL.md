---
name: print-export
description: 3MF/STL/STEP file export, slicer compatibility (BambuStudio/OrcaSlicer rejects 3MF, wrong/missing AMS colors, paint_color, project_settings.config), print-bed fitting and printBedSize, print-list bin splitting, baseplate split planner tongue budget, whole-layout ZIP export. Load when touching threemfExporter.ts, stlExporter.ts, splitPlanner.ts, src/features/print-export/, or src/shell/layoutExport/, or when an exported file misbehaves in a slicer.
---

# Print & Export

## When to use

- An exported 3MF/STL/STEP is rejected, mis-colored, off-center, or non-manifold in a slicer.
- Changing print-bed fitting, print-list split counts, or baseplate plate tiling.
- Adding/renaming files in the whole-layout ZIP export.
- For defects in the generated geometry itself (walls, sockets, booleans), see the geometry-generation and geometry-debugging skills.

## Map: five systems that do NOT share code

| System                                                                        | Location                                                                 |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Print LIST planning (piece counts, filament estimates — produces no 3D files) | `src/features/print-export/` (`utils/split.ts`, `hooks/usePrintList.ts`) |
| File writers (3MF/STL) + mesh validation                                      | `src/features/generation/export/`                                        |
| Worker export handlers (STL/STEP only)                                        | `src/features/generation/worker/handlers/exportHandler.ts`               |
| Whole-layout ZIP orchestration                                                | `src/shell/layoutExport/`                                                |
| Baseplate plate tiling                                                        | `src/features/baseplate/utils/splitPlanner.ts`                           |

Bed-capacity math (`calcMaxGridUnits`, `getEffectivePrintBedDepth`) lives in `src/core/constants.ts`. Main-thread packaging (STL→3MF, zone colors) is `src/features/bin-designer/utils/binDownloadHelpers.ts`. Shared helpers (ZIP, download, STL parse, winding repair) are in `src/shared/generation/`. `splitBinSize` only predicts counts — the geometric split is a separate worker system (`splitBinBuilder.ts`).

## Mental model

- The worker emits only STL and STEP (`ExportFormat` in `src/features/generation/bridge/types.ts`). 3MF is always produced on the main thread by parsing the worker's STL and re-encoding via `export3MF` / `export3MFMultiObject`. A new format wires into `useLayoutExport.ts`'s `workerFormat` mapping and the packaging helpers, not the worker.
- Other features must import the writers via the barrel `src/shared/generation/export.ts`, or `pnpm run check:boundaries` fails.
- The 3MF exporter never moves vertices — it centers via the build `<item>` transform (row-major 3x4; translation is the LAST three numbers), placing the bbox centroid at `PLATE_CENTER_MM` (128,128) and bbox min-z at 0. STL keeps raw coordinates. See `centeringTranslation` / `renderBuildItems` in `threemfExporter.ts`.
- 3MF slicer compat is THREE coupled mechanisms that must change together: (1) explicit `paint_color` on every triangle, slot N → `FILAMENT_PAINT_CODES[N+1]`; (2) `Metadata/project_settings.config` + `Metadata/model_settings.config` sidecars; (3) `BAMBU_COMPAT_APPLICATION = 'BambuStudio-02.00.00.00'` — Bambu gates sidecar loading on the `BambuStudio-` prefix, and that exact version is the only one both BambuStudio 2.6.0 and Orca 2.3.1 CLIs accept (failure table in the JSDoc above the constant).
- `printBedSize` is per-layout, stored in mm, never below `CONSTRAINTS.PRINT_BED_MM_MIN` (42) — the migration in `src/core/storage/LayoutService.ts` (search `maxPrintSize`) reinterprets any stored value < 42 as legacy grid units. `printBedDepth` undefined means square bed: resolve via `getEffectivePrintBedDepth()` or `calcMaxGridUnits()`, never read it directly.
- Unit split: `print-export/utils/split.ts` works in grid units (pre-converted via `calcMaxGridUnits`); `splitPlanner.ts` works in mm. Passing mm into `splitBinSize` yields absurd "fits" results with no error. `calcMaxGridUnits` floors to 0.5 increments — integer `Math.floor` regresses half-bin mode.
- ZIP packaging is fflate (JSZip needs `unsafe-eval`, blocked by the production CSP). `packageFilesAsZip` keys a plain object: duplicate paths silently drop the earlier file — route names through `dedupeFileNames` (`src/shell/layoutExport/`).

## Recipes

### Change 3MF output (metadata, colors, sidecars, positioning)

1. Read `src/features/generation/README.md` § "3MF Multi-color Compatibility" first.
2. Read the saga: `git log --oneline -- src/features/generation/export/threemfExporter.ts`. Most "obvious" fixes were tried and reverted — e.g. the identity claim was dropped (`git show aaef540ae`) then reintroduced at the one safe version. Fix one slicer, re-verify the other.
3. Edit `threemfExporter.ts`, keeping the coupled mechanisms above intact.
4. Update `threemfExporter.test.ts` (tests unzip the buffer and assert on model XML and sidecars).
5. Run `pnpm run test:run src/features/generation/export`, then verify against real slicer CLIs (BambuStudio 2.6.0 / OrcaSlicer 2.3.1) — the constraints are undocumented C++ validators; unit tests cannot catch them.
6. Sanity-check the artifact: `unzip -l file.3mf` must show `[Content_Types].xml`, `_rels/.rels`, `3D/3dmodel.model`, and (multi-color) both `Metadata/*.config` sidecars.

### Change bed fitting or split behavior

1. Pick the system: print-list prediction = `split.ts`; bed capacity = `calcMaxGridUnits`; baseplate tiling = `splitPlanner.ts`.
2. Preserve: the 0.5-increment floor and width/depth asymmetry in `calcMaxGridUnits`; `splitHalf`'s dual rounding (integer for whole dims, 0.5-aware for fractional) in `split.ts`; the `TONGUE_PROTRUSION` bed budget in `makeAxisConfig`/`axisChunkMm` in `splitPlanner.ts`.
3. Under `preferIdenticalPieces` the canonical piece is reused 180°-rotated — every positionally-indexed field must rotate with it in `pieceToBaseplateParams` (`splitPlanner.ts`): padding L↔R/F↔B, fractionalEdge start↔end, cornerRadii tl↔br/tr↔bl. A forgotten field silently puts dovetails/corners on the wrong world side of the printed piece; no test or type catches it.
4. Update sibling tests, then `pnpm run test:run src/features/print-export && pnpm run typecheck`.

### Add or rename files in the layout ZIP

1. Planning/naming: `planLayoutBinExport.ts` (pure). Orchestration: `useLayoutExport.ts`. Manifest text: `buildLayoutManifest.ts`.
2. Dedupe every new path family via `dedupeFileNames` before `packageFilesAsZip`; add a collision case to `dedupeFileNames.test.ts`.
3. The deep import of `binDownloadHelpers` bypassing the bin-designer barrel is deliberate (lazy chunk) — see the comment at the import in `useLayoutExport.ts`.
4. Run `pnpm run test:run src/shell/layoutExport && pnpm run check:boundaries`.

### Debug "slicer says the exported file is broken"

1. Winding/non-manifold on baseplates: `pnpm exec vitest run --config vitest.profile.config.ts __kernel-tests__/diagnoseBaseplateWinding` (real WASM kernel; excluded from normal runs).
2. If `validateMeshData` (`src/features/generation/export/validation.ts`) wouldn't have caught it, the defect is upstream in worker tessellation — geometry-debugging skill.
3. 3MF broken but the same mesh's STL is fine: suspect `deduplicateVertices` precision (`toFixed(6)` key in `threemfExporter.ts` — loosen it and distinct vertices weld; tighten it and shared vertices fragment into open edges) or the STL→3MF round-trip (`parseSTLBinary`).

## Verification

| Command                                            | When                                                                    |
| -------------------------------------------------- | ----------------------------------------------------------------------- |
| `pnpm run test:run src/features/generation/export` | Any writer/validation change                                            |
| `pnpm run test:run src/features/print-export`      | Split/estimate changes                                                  |
| `pnpm run test:run src/shell/layoutExport`         | ZIP planning/packaging changes                                          |
| `pnpm run check:boundaries`                        | New imports across print-export/generation/bin-designer/baseplate/shell |
| Real slicer CLI load (Bambu + Orca)                | Any 3MF change — non-negotiable                                         |

## Traps

| Symptom                                                                  | Cause → fix                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Multi-color 3MF shows fewer colors than designed                         | `paint_color` slot mapping broken: the N+1 offset lost, or slot-0 triangles emitted without an explicit code so body collapses onto the default extruder. Every triangle gets `FILAMENT_PAINT_CODES[slot + 1]` in `buildObjectXml`. See `git show cd841c9fc`. |
| Orca CLI rejects 3MF (exit -24) or "file is newer than cli"              | `BAMBU_COMPAT_APPLICATION` version outside the empirically safe window. Never bump casually; if forced, re-run both slicer CLIs.                                                                                                                              |
| Lid/secondary object renders body-colored despite paint_color            | `Metadata/model_settings.config` per-object extruder (`dominantSlot + 1`) removed — it, not paint_color, colors a uniform object. Keep both sidecars.                                                                                                         |
| Exported bin sits off-bed on small printers (A1 mini)                    | Claiming Bambu identity disables auto-arrange, so the file self-positions at (128,128). Adjust the build-item transform in `renderBuildItems` — never the vertices.                                                                                           |
| Split baseplate piece ~1.5mm too wide for the bed                        | Male dovetail tongue extends the bbox past grid math; budget lives in `makeAxisConfig`/`axisChunkMm`. Known unbudgeted exception: the detached-margin seam tongue (NOTE comment in `splitPlanner.ts`). Any new protruding connector must be budgeted there.   |
| File silently missing from layout ZIP                                    | Duplicate path overwrote it in fflate's plain-object keying → route through `dedupeFileNames`.                                                                                                                                                                |
| Saved layout shows a tiny bed (e.g. 4mm) or absurd split counts          | `printBedSize` written in grid units. Always write mm clamped to `PRINT_BED_MM_MIN/MAX` (canonical clamp in `src/core/store/layout/coreActions.ts`); the load-time migration only rescues values < 42.                                                        |
| "Cannot export empty mesh (0 triangles)"                                 | Correct behavior — `validateMeshData` refuses spec-invalid files. Fix the generator (geometry-generation skill).                                                                                                                                              |
| `stack` option silently does nothing                                     | Vertical stacking is honored by single-object `export3MF` only; `export3MFMultiObject` ignores it by design.                                                                                                                                                  |
| Layout ZIP ignores custom name for inner files / baseplate errors vanish | Both deliberate: inner files force descriptive style (one custom name would collide), and baseplate failure degrades to a bins-only archive with a toast (`.catch(() => null)` in `useLayoutExport.ts`). Don't "fix" either.                                  |

Other by-design facts that look like bugs: binary STL headers must not start with `solid` (`writeHeader` in `stlExporter.ts` prepends a space); `repairMeshWinding` is wired into baseplate STL only and is currently a no-op safety net (wire the same pass into bins if they show winding symptoms — don't write a new repair); in the STEP combined export, divider/lid solids are freed in `finally` but `binSolid` belongs to `shapeCache` and must NOT be freed (`exportHandler.ts`); print estimates use the calibrated shell-volume model in `src/shared/printSettings/standardBinVolume.ts` — don't re-derive its constants from first principles.
