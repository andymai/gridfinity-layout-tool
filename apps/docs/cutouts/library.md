---
title: Save cutouts to a library
description: 'Save shapes to your cutout library, place them in other bins and lids, keep them in folders, and share them as files.'
questions:
  - "I updated my saved caliper outline. Why didn't my old bins change?"
  - 'Can I scan tools at home and use them on my shop laptop?'
  - 'Should my traced wire cutters go in the cutout library or a design?'
sources:
  - src/features/bin-designer/components/CutoutLibrary/LibraryPanel.tsx
  - src/features/bin-designer/components/CutoutLibrary/SaveToLibraryDialog.tsx
  - src/features/bin-designer/components/CutoutLibrary/ManageLibraryDialog.tsx
  - src/features/bin-designer/components/CutoutLibrary/useCutoutLibraryWorkspace.tsx
  - src/features/bin-designer/components/CutoutLibrary/useLibraryRowDrag.ts
  - src/features/bin-designer/components/CutoutLibrary/LibraryGhost3D.tsx
  - src/features/bin-designer/components/CutoutLibrary/libraryContent.ts
  - src/features/bin-designer/components/CutoutLibrary/libraryPlacement.ts
  - src/features/bin-designer/library/CutoutLibraryService.ts
  - src/features/bin-designer/library/libraryFile.ts
  - src/features/bin-designer/library/libraryTreeImport.ts
---

# Save cutouts to a library

When the same tool goes in many bins, trace it one time and save it. The cutout library keeps shapes apart from any bin, so you can put them in a new bin or lid with two clicks. New to cutouts? Start with [Cutout basics](./basics).

## Save shapes

1. Select the shapes in the cutout editor. A group that you select whole keeps its name.
2. Right-click the selection and click <Ui k="binDesigner.cutouts.library.save" />. You can also open the <Ui k="binDesigner.cutouts.library.tab" /> tab and click the same button there.
3. Type a name, pick a folder, and click <Ui k="common.save" />.

The item keeps the size, depth, fit, label and STL imprint of each shape. Saving does not change your bin.

## Place a saved item

1. Open the <Ui k="binDesigner.cutouts.library.tab" /> tab in the cutout editor.
2. Drag an item onto the board. Its outline shows where the item goes.
3. Release the item where you want it. To stop, release it off the board, or press <kbd>Esc</kbd>.

You can also click an item instead. Its outline then follows the pointer until you click the board. On a touch screen, tap the item, then tap the board.

The item lands as new shapes, and they are selected. If you edit them, the item does not change. If you edit the item later, bins that hold it do not change. While snap is on, the corner of the item snaps to the grid.

The app fits the item to its new bin:

- A pocket with a fixed depth that is deeper than the new bin can cut gets the deepest depth that the bin allows.
- A pocket set to the floor, or through the bin, follows its new bin.
- If the item is larger than the board, the off-board warning offers to move it or to make the bin larger.

An item can go on a lid when the lid has room for all its shapes. An item with an STL imprint cannot go on a lid, because imprints go in bins only.

## Update an item

Shapes that you placed from an item, or saved to it, keep a link to it. Select them and save again. Click <Ui k="binDesigner.cutouts.library.saveAsNew" /> to keep the old item and make a new one, or keep the update choice to replace the old item.

The <Ui k="binDesigner.cutouts.library.usedInBin" /> list at the top of the tab shows the items that the current bin holds.

## Find and sort items

- Type in the search box to find items by name.
- Click <Ui k="binDesigner.cutouts.library.manage" /> to rename, move or delete items, and to make folders.
- When you delete a folder, the items and folders in it move up one level.

The library holds 1000 items.

## Share items and folders as files

1. Click <Ui k="binDesigner.cutouts.library.manage" />.
2. Click <Ui k="common.export" /> next to an item or a folder. The app saves a `.cutouts.json` file that holds it and its meshes. A folder file also holds the folders and items inside the folder.
3. To add a file to your library, click <Ui k="binDesigner.cutouts.library.importFile" /> and pick the file.

An imported folder goes at the top level of your library, with all the folders and items that it held. If the file does not fit the library's limits, the app adds nothing from it.

## Sync

When you sign in, your library syncs to your other devices, as your designs do. Each device makes its own pictures of the items.
