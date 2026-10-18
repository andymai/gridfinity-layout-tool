---
name: slant
description: Slanted bins end to end. The shear stage, the upright socket, what keeps a bin upright, the end support, placed slants in the layout (reserved cells, no stacking, turned placements, registry facts), the row detector and Match row, 2D and 3D previews, and the slanted row paint tool. Load when touching any `slant` code, `placedSlant`, the end support, or a bug where the layout, the preview and the export disagree about a lean.
---

# Slant

## Mental model

1. **A slant is a shear, not a rotation.** `x' = x + k(z - z0)` with `k = tan(angle)`, pivoting at the socket's top. `slantStage` runs on the body after `lidHingeStage` and before tessellation; the socket is built apart in `deferredSolid`, so it stays upright. Horizontal wall thickness holds at every height. The kernel's general (non-orthogonal) transform needs occt-wasm 5.6.1 or later.
2. **One answer to "does it lean".** Design params: `resolveSlant` (null when `slantBlocker` names a feature). A placed bin: `placedSlant` in `src/shared/utils/placedSlant.ts`, which takes the placed `Bin.slant` over the design's, and returns null when the design is blocked, the bin's own overhang resolves, or the design is not a parametric bin. The layout export, the print list, placement, fill, the detector and every preview call it, so they agree.
3. **No lip on a slanted bin.** `normalizeSlant` turns `stackingLip` off. It runs in `migrateParams`, at the `generateBin` entry, in the layout export, in the designer store after every write, and when the row tool saves a design. Never read `base.stackingLip` raw on params that may lean.
4. **The end support** is a second part past the leaning side. `planSlantSupport` / `planSupportFor` size it in whole cells, or k + 0.5 when the leading edge lands on a half cell. It exports as the `slant-support` companion and is drawn merged into a linked bin's geometry. A slanted bin is never split.
5. **The layout reserves what the export prints.** `canPlaceBin` refuses a bin on another bin's support cells, a support past the drawer, and anything on another layer over or under a slanted bin and its support (`slantConflicts`). Fill and expand-to-fit mark the same cells in `createFootprintCellSet`. `canPlaceFootprint` (loading, import) does not, so a loaded layout is never stashed over a support. A conflict the bin already had never blocks its own edit.
6. **Linked designs reach the layout through the registry.** `registrySlantFields` writes `DesignSlantFacts` (own slant, blocked, extra wall) wherever `registryHeightFields` is written; a sync pull refreshes it with `refreshRegistrySlant`, a share restore through the design store port. The shell registers the resolver in `LinkedRiseRegistration` with the design's width, depth and height.
7. **Turned placements.** A linked bin whose width and depth swap its design's stands turned a quarter counterclockwise, as `LinkedBinMesh` draws it. `placementTurn.ts` maps sides both ways: `placedSlant` turns the design's side into the drawer's frame; the export and the linked mesh request turn a placed slant back into the design's.

## Rows

- **Rows come from adjacency, never stored ids** (share import mints new bin ids). `slantRowOf` walks edge-to-edge bins with the same cross extent.
- **`slantIssue`**: `mismatch` (the top leans over a bin that does not lean alike), `unsupported`, `pastDrawer`, `blocked`. Drives the 2D badge and the inspector line.
- **Match row** (`matchRowSlants`): the row takes the bin's angle and side, the leading bin the end support, retried without it when there is no room. One `batch`.
- **Slanted row tool**: `paintSlant` in the interaction store, `planSlantedRows` for the area, `paintSlantedRows` to commit. Rows link to one design from `ensureSlantRowDesign`, a shared seam the shell registers in `DesignStoreRegistration`. The design is saved before the batch, so undo removes the bins and keeps the design.

## Previews

- Linked bins: the mesh request key gains `:slant…` for a placed slant; the persisted key is the params hash.
- Stylized bins: `createBinGeometry` takes a `BinShear`; Y shifts are in Y grid units because the scene stretches depth. `SlantSupportWedges` draws a plain bin's support.
- 2D: `BinSlantExtension` hatches the support and stops the lean at the first bin.

## Traps

| Symptom                                                | Cause                                     | Fix                                                        |
| ------------------------------------------------------ | ----------------------------------------- | ---------------------------------------------------------- |
| Layout reserves different cells than the export prints | A new path decides the slant itself       | Call `placedSlant`; never read `bin.slant` alone           |
| Slanted bin exports with a lip or lid                  | Params skipped `normalizeSlant`           | Normalize wherever params are stored or generated          |
| A design's slant change shows nowhere in the layout    | A registry writer omitted the slant facts | Spread `registrySlantFields` beside `registryHeightFields` |
| Turned bin leans the wrong way                         | Side used in the wrong frame              | Go through `sideInPlacement` / `sideInDesign`              |
| Inspector edit refused after a design re-save          | Fine: only new conflicts block an edit    | Check `slantConflicts` before and after the change         |
