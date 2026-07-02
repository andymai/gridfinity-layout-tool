---
name: grid-editor
description: 2D layout canvas — pointer interactions (draw/drag/resize/stagingDrag/paint in useInteraction.ts and src/shared/hooks/interactions/), __staging__ stash semantics, layer view modes, half-grid 0.5 snapping, collision/blocked zones, canPlaceBin validation. Load for symptoms like offset drag ghosts, mirrored Y placement, phantom collisions, bins drifting in the stash, laggy drag previews, or half-grid toggle failing.
---

# Grid Editor: 2D Canvas Interactions

## When to use

- Changing any pointer interaction: draw, drag, resize, stagingDrag, paint.
- Touching placement validation, collision, blocked zones, or displacement-to-staging.
- Half-grid (0.5-unit) snapping, sizing, or toggle behavior.
- Bugs: offset/mirrored bin positions, phantom collisions, stash rendering glitches, laggy drags.

For CQRS commands/undo behind mutations see the state-and-cqrs skill; for compartment internals see bin-designer; for the 3D preview render systems see three-preview.

## Mental model

1. **Orchestrator + mode hooks.** `src/features/grid-editor/hooks/useInteraction.ts` owns pointer events, pointer capture, and RAF throttling, then delegates to per-mode hooks in `src/shared/hooks/interactions/` (shared so mobile/tablet shells reuse them). That directory's README is the ground truth for mode behavior — the grid-editor README undersells it.
2. **Y is inverted once, in one place.** Grid (0,0) is bottom-left; screen Y=0 is top. `useGridCoords.ts` (`getGridCoords`/`clampCoords`) does the inversion (`y = drawer.depth - cellY - 1`). Never hand-roll px→grid math.
3. **`drag` stores a delta; `stagingDrag` stores an absolute.** In a `drag` Interaction, `currentCoord` is the constrained _delta_ from `startCoord`; commit is `bin.x + delta`. In `stagingDrag` it is an absolute grid position (null until the pointer reaches the grid). See the `Interaction` union in `src/core/types.ts` (~line 301).
4. **Staging is a sentinel, not a layer.** `STAGING_ID = '__staging__'` (`src/core/constants.ts`) never appears in `layout.layers`. Every collision/validation loop must skip it: `binsCollideResult` returns ok(false), `getBlockedZones` and `canPlaceBin` skip. Any new placement code that forgets this makes stashed bins phantom-block the grid.
5. **Collision is 3D.** Footprint overlap AND vertical overlap, where a bin's zEnd can protrude past its layer into layers above (blocked zones). Layer height is only a default for new bins; `canPlaceBin` (`src/shared/utils/validationPlacement.ts`) checks height against `drawer.height - layerZStart`, never against layer height.
6. **Half-grid changes rendering, not coordinates.** Internal coords stay in real grid units at 0.5 steps (`snapToHalf`). Only `Grid.tsx` doubles: `visualCellSize = (cellSize - gap) / HALF_BIN_SCALE`, `scale = HALF_BIN_SCALE`. Never store scaled coordinates.
7. **CLAUDE.md is stale about layer view modes.** `layerViewMode` ('focus'|'stack'|'all') lives in `src/core/store/view.ts`, NOT `interaction.ts`; its only rendering consumer is the 3D preview (`src/features/grid-editor/components/Grid/IsometricPreview/useBinsToRender.ts`), and the value is also serialized into share links via `src/shared/utils/ephemeralState.ts`. The 2D canvas's lower-layer ghosting is separate: `view.ts` `showOtherLayers` → ghost bins in `GridCanvas/GridCanvas.tsx`.

## Recipes

### Add or change a placement validation reason

1. Extend `ValidationReason` in `src/core/types.ts`; return it from `canPlaceBin` in `src/shared/utils/validationPlacement.ts` (check order: bounds → layer → height → blocked_zone → collision).
2. Map it to a user message in `getPlacementErrorMessage` in `src/shared/utils/validation.ts`; add keys per the i18n-changes skill.
3. Keep the `layerId === STAGING_ID` skip and `excludeBinIds` (group drags) working.
4. Update switches over the union — `src/features/grid-editor/components/Grid/Overlay/Overlay.tsx` — or `pnpm run check:exhaustiveness` blocks the commit.

### Change staging/displacement semantics

1. Store side: `src/core/store/layout/drawerActions.ts` (drawer shrink) and `layerActions.ts` (layer delete) both set `layerId = STAGING_ID` and preserve x/y.
2. Mirror the change in the CQRS replay handlers `src/core/cqrs/v2/domain/drawer/updateDrawer.ts` and `src/core/cqrs/v2/domain/layer/deleteLayer.ts` — divergence silently corrupts undo/collab replay (see state-and-cqrs skill).
3. Stash visuals: `src/features/staging/components/Staging/Staging.tsx` + `src/features/staging/utils/packing.ts`. Packed positions are recomputed per render — never persist them back to bins.

### Modify half-grid behavior

1. Snapping helpers: `snapToHalf`/`snapToGrid`/`isFractional` in `src/core/constants.ts`. Pointer conversion + clamping: `useGridCoords.ts`. Min draw size (`0.5 : 1`): `src/shared/hooks/interactions/useDrawInteraction.ts`. Smart-snap step: `useDragInteraction.ts` / `useStagingDragInteraction.ts` (`step = halfGridMode ? 0.5 : 1`).
2. Rendering is separate: `Grid.tsx` visual math and `src/features/grid-editor/utils/fractionalPixels.ts`.
3. If validity of existing layouts changes, update `validateHalfGridModeToggle` in `src/shared/utils/halfGridConstraints.ts` (the toggle-off guard in `src/core/store/halfGridMode.ts`).

### Add a new interaction mode or drop target

1. Study an existing mode hook in `src/shared/hooks/interactions/` and its README; wire it into `useInteraction.ts` following the ref-of-handlers pattern (`drawModeRef` etc. synced in `useLayoutEffect`).
2. Extend the `Interaction` union in `src/core/types.ts`; run `pnpm run check:exhaustiveness`.
3. Drop targets are geometric, not DOM drop events: `Staging.tsx` listens to document `pointermove`, compares client coords to its bounding rect, sets `interactionStore.dropTarget = 'staging'`; `useDragInteraction.handleUp` reads `dropTarget` before grid placement. A new target needs both sides.

## Verification

```bash
pnpm run test:run src/features/grid-editor
pnpm run test:run src/shared/hooks/interactions
pnpm run test:run src/core/store/layout.scenario.displacement
pnpm run test:run src/core/store/layout.scenario.half-grid
pnpm run check:exhaustiveness
pnpm run test:e2e
```

Interaction behavior specs live in `src/features/grid-editor/hooks/useInteraction.{core,drag,draw,resize,staging}.test.ts`; displacement semantics in `src/core/store/layout.scenario.displacement.test.ts`. Always test with a half-grid layout (x.5 coords) in addition to integer grids.

## Traps

| Symptom                                                  | Cause                                                                                                  | Fix                                                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Bins mirrored vertically / drag ghost offset from cursor | Y inversion missed or applied twice                                                                    | Route all conversion through `useGridCoords` `getGridCoords`/`clampCoords`                                                                      |
| Group drop lands near (0,0)                              | Treated drag `currentCoord` as absolute                                                                | It is the delta; commit as `bin.x + currentCoord.x` (see `useDragInteraction.handleUp`)                                                         |
| "Collision"/"blocked zone" on an empty-looking layer     | Lower-layer bin protrudes upward, or new code forgot the `STAGING_ID` skip                             | Inspect `getBlockedZones` output; skip `bin.layerId === STAGING_ID` in every bin loop                                                           |
| Drag preview lags / validation storms                    | Heavy work in the unthrottled draw/paint path                                                          | Keep expensive validation in the RAF-throttled branch of `useInteraction` (`processHeavyMove`); draw/paint stays cheap                          |
| Handlers act on stale state                              | Mode handlers captured directly in document listeners                                                  | Use the existing ref-sync pattern; read live state via `useInteractionStore.getState()` inside handlers                                         |
| Commit logic never ran after a drag                      | `pointercancel` (OS gesture steal) discards without calling `handleUp`                                 | Never assume `handleUp` runs; keep all commit logic in `handleUp`, nothing partial before it                                                    |
| Interaction stuck or cleared twice                       | Mode `handleUp` called `setInteraction(null)` on normal completion                                     | Parent `useInteraction` clears it; only early-return branches (swap, staging drop) clear themselves                                             |
| Staged bins drift above stash Y=0                        | CSS `repeat(N, …)` drops non-integer N                                                                 | Keep `Staging.tsx` `gridHeight = Math.ceil(...)` and `StagingBin.tsx` `alignSelf: 'end'` for fractional depth — `git show 5517327ae`            |
| Half-grid toggle-off silently fails                      | `toggleHalfGridMode` returns Err while fractional bins exist                                           | Check the Result; resize/delete fractional bins first. localStorage key `gridfinity-half-bin-mode` is legacy — never rename without a migration |
| Selection empties on layer switch                        | `setActiveLayer` clears `selectedBinIds` by design (`src/core/store/selection.ts`)                     | Not a bug; cross-layer selection is a product decision                                                                                          |
| Blocked zones stale mid-drag                             | `getBlockedZones` caches by reference equality of bins/layers arrays (`src/shared/utils/collision.ts`) | Never mutate layout arrays in place; Zustand+Immer must produce new references                                                                  |
| Half-grid ON changes bin-designer defaults               | Intentional: seeds `base.halfSockets = true` on new designs                                            | See `halfGridMode.ts` docstring; bin-designer skill covers the designer side                                                                    |

Other verified behaviors to respect: multi-select drag is all-or-nothing unless `snapGroupDelta` rescues it (Ctrl disables snap; `ctrlKeyRef` resets on window blur and visibilitychange because keyup never fires); `getGridCoords` uses `cellX/cellY = -1` as the fractional-edge sentinel; `mlTracking.trackMove`/`trackPlacement` must fire before mutations (they need pre-mutation positions); moved bins keep their height across layers/staging by design; exploded 3D view forces `layerViewMode='all'` (`view.ts` coupling).
