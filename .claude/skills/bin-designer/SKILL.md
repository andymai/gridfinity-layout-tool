---
name: bin-designer
description: Custom bin editor (src/features/bin-designer/) — compartment grid model and the normalizeIdsWithRemap parallel-array rule, epoch-based worker regeneration via pushHistoryEntry, label tabs/compartmentTexts, wall cutouts/handles, and the client/server validation mirror in api/lib/designerValidation.ts. Load when adding a BinParams field, editing merge/split/setCompartmentGrid, labels land on the wrong compartment, cloud sync returns 400 INVALID_PARAMS, or the 3D preview stops updating.
---

# Bin Designer

## When to use

- Adding or changing a designer parameter (`BinParams`), constraint, or label-tab behavior.
- Writing or modifying a compartment-grid mutation (merge/split/regrid, divider overrides).
- Debugging: labels/tilts on wrong compartments, sync 400s, preview not regenerating.
- For 2D layout-canvas interactions see the grid-editor skill; for BREP/worker internals see geometry-generation; for the layout planner's CQRS store see state-and-cqrs.

## Mental model

Read `src/features/bin-designer/README.md` first — it covers the store/worker/persistence topology, mesh cache, ghost overlays, and cellMask. Facts it does not spell out:

1. **The designer store is not the CQRS store.** It has its own history slice (`store/slices/historySlice.ts`) with mesh-attached entries. Every geometry-affecting mutation in `store/slices/paramSlice.ts` calls `pushHistoryEntry(state)` (`store/helpers.ts`), which bumps `generation.epoch`; `hooks/useGeneration.ts` regenerates only on epoch change. Cosmetic mutations pass `{ affectsGeometry: false }` (undo entry, no worker run). `restoreHistoryEntry` restores a cached mesh WITHOUT bumping the epoch.
2. **Compartment IDs are unstable and everything hangs off them.** `compartments.cells` is a cols×rows array of IDs (row 0 = visual bottom, UI flips with `flex-col-reverse`). IDs are contiguous from 0 and renumbered on every merge/split via `normalizeIdsWithRemap` (`utils/compartments.ts`). Any parallel per-compartment array — `compartmentTexts`, `dividerOverrides` — must be reindexed in the same `set()` via `remapCompartmentTexts` / `remapDividerOverrides`. Display numbering ("Comp. N") comes from `getCompartmentReadingOrder` (visual top-left first, #2338) and is NOT the ID. `compartmentTexts` is normalized on write in `setCompartmentText` — clamped to `TEXT_MAX_LENGTH` (50, `types/text.ts`, mirrored in `api/lib/designerCompartmentValidation.ts`), trailing empties popped, all-empty collapsed to `undefined`; route any new text write path through the same normalization.
3. **Divider walls are derived, never stored** — `deriveWallSegments` computes them from ID boundaries. Cells sharing an ID must form a filled rectangle (`isRectangularSelection` / `validateCompartmentGrid`); the server does NOT enforce this, so a hand-crafted share can violate it.
4. **Every client constraint has a hand-maintained server mirror.** `constants/gridfinity.ts` `DESIGNER_CONSTRAINTS` ↔ `api/lib/designerValidationConstants.ts` `CONSTRAINTS`; type unions in `types/index.ts` ↔ `VALID_BIN_STYLES` / `VALID_LABEL_TAB_SUPPORTS` in `api/lib/designerValidation.ts`; top-level param keys ↔ `ALLOWED_PARAM_KEYS` there. Divergence means 400s on sync or params silently stripped from shares. `sanitizeTags` (server) must stay behaviorally identical to `normalizeTags` (`utils/tags.ts`).
5. **Wall-feature units are mixed by design.** `WallCutout` width/depth are percentages (0–100 of wall span / wall height); `widthMm: null` means "use the % field". Handle width is % of span but handle height is mm. See the JSDoc on each field in `types/index.ts` — mixing these passes typecheck and produces silently wrong geometry.

## Recipes

### Add a field to BinParams

1. Add the field to `src/features/bin-designer/types/index.ts` and its default to `DEFAULT_BIN_PARAMS` in `src/features/bin-designer/constants/defaults.ts`.
2. Backfill legacy saved designs in `migrateParams` (`src/features/bin-designer/constants/defaults.ts`) — saved designs and stored custom defaults both re-complete through it. Wall-specific legacy handling is factored into `migrateWalls` (`constants/paramMigration.ts`).
3. Add a setter in `src/features/bin-designer/store/slices/paramSlice.ts` that calls `pushHistoryEntry(state)` before mutating (`{ affectsGeometry: false }` only if the worker never reads it).
4. Server: add the key to `ALLOWED_PARAM_KEYS` in `api/lib/designerValidation.ts` (otherwise it round-trips as `undefined` through shares/sync); for enums or bounded numbers, extend the matching `VALID_*` array and `api/lib/designerValidationConstants.ts`.
5. Make the worker read it — see the geometry-generation skill; if it cuts a wall, it needs border clipping in `src/features/generation/worker/generators/wallPatternBuilder.ts` (that skill owns the rule).

### Add or change a compartment-grid mutation

1. Write the pure version in `src/features/bin-designer/utils/compartments.ts`: mutate a copy of `cells`, then ALWAYS finish with `normalizeIdsWithRemap` and thread the remap through `remapCompartmentTexts` AND `remapDividerOverrides` — copy the pattern from `mergeCells` / `splitCompartment` there.
2. Mirror it as a store action in `paramSlice.ts`. Note: `paramSlice` inlines the algorithm rather than calling the pure utils — a behavior change must land in BOTH copies or store and model diverge.
3. If the mutation changes grid DIMENSIONS there is no valid remap: use `carryCompartmentTextsByPosition` and drop `dividerOverrides`, returning a dropped count for the UI warning — copy `setCompartmentGrid` (#2337). Beware: it also returns 0 when `validateCompartmentSizes` rejects the grid (nothing mutated), so 0 does not mean "success".
4. Add tests in `utils/compartments.test.ts` and a scenario in `store/designer.scenario.compartments.test.ts` asserting texts/overrides land on the right compartments.

### Change a designer constraint

1. Update `DESIGNER_CONSTRAINTS` in `src/features/bin-designer/constants/gridfinity.ts`.
2. Update the mirrored value in `api/lib/designerValidationConstants.ts` — skipping this makes valid client payloads 400 on sync.
3. Check derived constants noted in comments there (e.g. `MIN_LABEL_TAB_HEIGHT` = `MIN_LABEL_TAB_DEPTH` + 1; `MAX_LABEL_TAB_HEIGHT` = MAX_HEIGHT × heightUnitMm).

### Change label-tab behavior

1. Types: `LabelTabConfig` in `types/index.ts`; new enum values must also go into `VALID_LABEL_TAB_SUPPORTS` / the edges allowlist inside `validateLabel` (`api/lib/designerValidation.ts`).
2. UI: `components/panel/LabelTabsSection/useLabelTabsSection.ts` owns stepper bounds and the warning derivation (priority: inset → depth → height → edges). The grid label editor is `components/CompartmentEditor/useCompartmentLabeling.ts` (gated to `style === 'standard'` with >1 compartment).
3. Worker: `src/features/generation/worker/generators/labelTabBuilder.ts` — indexes `compartmentTexts?.[cellId]` by compartment ID; in `edges: 'both'` mode it silently drops colliding front tabs, and tabs are suppressed when the anchor wall is tilted (`compartmentHasTiltedBackWall` / `compartmentHasTiltedFrontWall` in `utils/compartments.ts`).
4. Update `components/preview/GhostLabelTabs/` so the generating-state preview matches.

## Verification

```bash
pnpm run test:run src/features/bin-designer/store/designer.scenario.compartments src/features/bin-designer/utils/compartments
pnpm run test:run src/features/bin-designer
pnpm run test:run api/lib
pnpm run typecheck
```

Run the `api/lib` suite after ANY touch of the validation mirrors — a green client suite says nothing about sync. Failures show the exact validator message (e.g. `label.height must be greater than label.depth`). Before PR: `pnpm run quality` and `pnpm run test:coverage`; `pnpm run check:i18n` if you added UI strings.

## Traps

| Symptom                                                           | Cause                                                                                              | Fix                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Labels/divider tilts jump to wrong compartments after merge/split | Remap from `normalizeIdsWithRemap` not threaded through a parallel array                           | Remap every array in the same `set()`; copy `paramSlice.ts` `mergeCells`     |
| Sync/share returns 400 for designs that work locally              | Client enum/range added without the server mirror                                                  | Grep `api/lib` for the field; extend `VALID_*` / `CONSTRAINTS`               |
| New param round-trips as `undefined` through share/sync           | `pickAllowedParams` strips keys not in `ALLOWED_PARAM_KEYS`                                        | Add the key in `api/lib/designerValidation.ts`                               |
| Preview never updates (or regenerates on lock/hide clicks)        | Setter skipped `pushHistoryEntry`, or cosmetic prop defaulted to `affectsGeometry: true`           | Fix the setter in `paramSlice.ts`; see `store/helpers.ts`                    |
| Error banner right after a compartment edit                       | `useGeneration` pre-flight `validateCompartmentSizes` rejected (cell < `MIN_COMPARTMENT_SIZE` 5mm) | Expected — surface via helpers in `utils/validation.ts`, never bypass        |
| Engraving lands on the wrong "Comp. N"                            | Indexed `compartmentTexts` by display number instead of ID                                         | Map through `getCompartmentReadingOrder` only at the display layer           |
| Front tab missing in `edges: 'both'` with no error                | Builder drops it when 2·depth + 2·inset > compartment depth                                        | By design — the `useLabelTabsSection` warning is the signal                  |
| One text edit re-runs every engraved-text solid                   | `textSolidCache` keys serialize the WHOLE `compartmentTexts` array                                 | By design — don't assume per-entry caching                                   |
| Duplicate history entries / worker re-runs on identical text      | No-op guards removed from `setCompartmentText` / `setCompartmentDividerHeight`                     | Keep the guards; inputs commit on both idle-flush and blur                   |
| Persisted JSON gains `dividerHeight: 'auto'` noise                | `'auto'` and `undefined` are the same state                                                        | `setCompartmentDividerHeight` omits the field for `'auto'`; keep it that way |

For divider-override structure: pairs are canonical (`compartmentA < compartmentB`), unique, adjacent — enforced in both `utils/compartments.ts` (`validateDividerOverride[s]`) and `api/lib/designerCompartmentValidation.ts`. Structural validity does not guarantee the tilt renders (geometric checks happen at drag-commit and generation). `getEligibleDividers` row order is deliberately stable so panel rows don't shuffle — don't replace its sort with grid-scan order.

Designer shares have their own limits (`MAX_PAYLOAD_BYTES` 100KB in `api/lib/designerValidationConstants.ts`), smaller than the layout-share limits in `api/lib/validation.ts` — see the share-api-collab skill. Cloud-sync envelope rules live in `src/features/bin-designer/sync/designAdapter.ts`. For the placed-bin side panel (bin-inspector), read `src/features/bin-inspector/README.md`; custom-property keys must avoid `RESERVED_PROPERTY_KEYS` in `src/core/constants.ts`.
