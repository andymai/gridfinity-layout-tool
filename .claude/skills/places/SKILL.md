---
name: places
description: "Places and Find, behind the `places` labs flag: bin items (`Bin.items`), Find across every layout (src/features/places), folder kinds (place, area, unit), My place as the library root, the header place path, and revealing a found bin. Use when changing bin items or the allowlists they pass, Find matching or indexing, the command palette's extra results, folder kinds, or anything under src/features/places."
---

# Places and Find

The invariants the code depends on, and the traps that cost time.

## Mental model

1. **Items live on the bin.** `Bin.items` holds `{ id, name, qty?, note? }`, so undo, snapshots, collab, share and export carry them for free. Caps are `ITEMS_PER_BIN_MAX`, `ITEM_NAME_MAX_LENGTH` and `ITEM_QTY_MAX` in `CONSTRAINTS`. Every bin allowlist must name them, or the field is dropped silently: `sanitizeBinItems` (`src/shared/utils/binItems.ts`) on load, salvage and in the add and update handlers; the raw-value CQRS schema (`src/core/cqrs/validation/binItems.ts`); the server rebuild (`api/lib/binItemsValidation.ts`); and `BIN_KEYS` with the JSON schema. A pulled copy below `LAYOUT_SCHEMA_VERSION` restores items from this device's copy in `restoreStrippedFields`.
2. **Folder kinds.** `LayoutFolder.kind` is `place`, `area` or `unit`; absent reads as an area (`folderKind`). A place sits at the top: `setFolderKind` and `moveFolder` refuse a nested one, and making a folder whose parent has not synced a place clears its `parentId`. Kinds sync with folder schema `FOLDER_SCHEMA_VERSION`. The kind choices live once in `offeredKinds`, the icons in `FOLDER_KIND_ICON`.
3. **My place is the library root, not a folder.** Nothing is migrated. Moving a layout into a folder bumps its entry's `modifiedAt`, and its sync payload carries `folderId`, so moving every root layout into a real folder would re-push every layout at once. `placePath` names the root for a layout outside every place, and the desktop header shows it through `PlacePath`.
4. **Matching** (`matchBins`): every query word must match a whole word or a word start in one field. Whole words beat prefixes; item names and labels get a bonus over notes, divided by the query's word count. One-word queries also match a field naming the same label-vocabulary term through `conceptsNamedIn`, which takes only whole aliases on word boundaries and folds accents; `processLabel` stays the analytics matcher.
5. **The index** (`reconcileFindIndex`) is per session and in memory. A stored layout is re-read when its entry's `modifiedAt` changes, reconciles run one at a time, and the active layout is read live from the store, with its stored copy left out.
6. **Palette contract.** The command palette cannot import the slice; `usePlacesFindResults` hands it `PlacesFindGroup` through `extraResults`, on the layout planner only. Results carry `PRE_RANKED_VALUE_PREFIX`, which `commandPaletteFilter` scores above any cmdk score, so cmdk's stable sort keeps Find's order above the commands. Phones use `PlacesFindList` in `MobileLayoutsFind` instead.
7. **Reveal.** `useFocusBin` opens the layout, sets the bin's layer (activating a layer clears the selection, so the layer comes first), selects the bin, then calls `revealBin`. The grid (`useRevealGridBin`) scrolls and focuses it, and the stash opens and focuses a stashed one. The signal is explicit, so choosing the same bin again reveals it again.

## Recipes

**Add a field to `BinItem`:** the type in `src/core/types`, `sanitizeBinItems`, the CQRS item schema, the server validator, the layout JSON schema and docs, and a cap in `CONSTRAINTS` and the share constraints. Then a sync round-trip test and a salvage test.

**Add a surface that shows a folder:** read the kind through `folderKind`, take icons from `FOLDER_KIND_ICON`, and add the kind to the folder's accessible name while the flag is on.

## Traps

| Symptom                                                                  | Cause                                                                          | Fix                                                                                    |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Palette shows "No results" beside bin results                            | A force-mounted cmdk item never registers, so cmdk counts nothing              | Never force-mount; a pending state is a disabled item, which counts                    |
| Bin results vanish as the query grows, or fall below commands            | cmdk scores and re-sorts every item and group itself                           | Give values the pre-ranked prefix; the palette filter keeps them first                 |
| `scrollIntoView is not a function` fails a shard with every test passing | jsdom lacks it; cmdk and the reveal listeners call it                          | Stub `Element.prototype.scrollIntoView` in that test file                              |
| A menu inside a dialog stays open, or keyboard focus never enters it     | A design-system `Menu` below the dialog, or items still hidden by a transition | The `Menu` stacks above dialogs and its items transition colors only; keep it that way |
| A found bin is selected but not scrolled to                              | The layout has an edit share and the lazy collab provider was still loading    | Known gap: the reveal is one-shot                                                      |
