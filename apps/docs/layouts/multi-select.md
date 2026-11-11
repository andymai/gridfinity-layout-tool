---
title: Work with several bins
description: 'Select several bins, align them, edit them together, merge them into one bin, and use the bin menus.'
sources:
  - src/features/grid-editor/components/Grid/SelectionToolbar/SelectionToolbar.tsx
  - src/features/grid-editor/hooks/useGridRowColumnSelection.ts
  - src/features/bin-inspector/components/Inspector/MultiBinInspector/MultiBinInspector.tsx
  - src/shared/hooks/useSelectionActions.ts
  - src/shared/utils/alignBins.ts
  - src/features/design-linking/components/Dialogs/MakeBentoDialog/
  - src/shell/Mobile/BinContextMenu/BinContextMenu.tsx
  - src/shell/Mobile/MultiBinContextMenu/MultiBinContextMenu.tsx
  - src/shared/hooks/interactions/useDragInteraction.ts
  - src/shared/hooks/useAlignBins.ts
  - src/features/design-linking/domain/mergeBins.ts
  - src/features/design-linking/hooks/useBento.ts
---

# Work with several bins

Got a row of bins that all need the same change? Select them together and make the change once. In the Gridfinity Layout Tool, you can line bins up, edit them as a group, and even merge them into one bin with compartments.

## Select several bins

- Hold <kbd>Ctrl</kbd> (<kbd>Cmd</kbd> on a Mac) and click a bin to add it to the selection. Do it again to remove the bin.
- Click a row number or a column number at the edge of the grid. This selects every bin in that row or column on the active layer.
- Hold <kbd>Shift</kbd> and click a second row or column number to add all the rows or columns between the two.
- Hold <kbd>Ctrl</kbd> and click a row or column number to add its bins, or to remove them.

The command palette (<kbd>Ctrl</kbd>+<kbd>K</kbd>, or <kbd>Cmd</kbd>+<kbd>K</kbd> on a Mac) has more ways to select:

| Command                                    | What it selects                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------ |
| <Ui k="commandPalette.selectAll" />        | Every bin on the active layer                                            |
| <Ui k="commandPalette.invertSelection" />  | The bins on the active layer that are not selected now                   |
| <Ui k="commandPalette.selectByCategory" /> | The bins on the active layer with the category of the first selected bin |
| <Ui k="commandPalette.selectNone" />       | Nothing. It clears the selection.                                        |

Press <kbd>Escape</kbd> to clear the selection. When you change to a different layer, the selection also clears.

## Move bins together

Drag any selected bin, and all the selected bins move with it. The arrow keys move all of them too. If one bin can't go to the new position, none of the bins move, so the group keeps its shape.

## Use the selection toolbar

Select two or more bins on a computer, and a toolbar shows above them with the group actions.

<Screenshot id="layouts-multi-select-toolbar" alt="One bin is clicked, then three more with Ctrl held down. The selection toolbar shows above the four selected bins, with the align buttons, category colors and bulk actions." spec="Clip. Layout editor on desktop. Layout with an 8 by 4 drawer, two layers, and four bins of different heights in a loose row at the left of layer 1. Click the first bin, then Ctrl+click the other three with a Ctrl keycap on screen, so the selection toolbar shows. Crop to the grid and the toolbar." />

| Button                                                                                                                                               | What it does                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| <Ui k="commandPalette.alignLeft" />, <Ui k="commandPalette.alignRight" />, <Ui k="commandPalette.alignTop" />, <Ui k="commandPalette.alignBottom" /> | Moves the bins so that one edge of each lines up with the outermost bin |
| Category colors                                                                                                                                      | Gives all the bins that category                                        |
| <Ui k="selectionToolbar.rotateAll" />                                                                                                                | Turns each bin a quarter                                                |
| <Ui k="selectionToolbar.matchHeight" />                                                                                                              | Makes each bin as tall as the tallest one                               |
| <Ui k="selectionToolbar.expandToFit" />                                                                                                              | Grows the bins into the empty space around them                         |
| <Ui k="selectionToolbar.moveToLayer" />                                                                                                              | Moves the bins to a different layer                                     |
| <Ui k="selectionToolbar.moveToStash" />                                                                                                              | Moves the bins to the stash                                             |
| <Ui k="selectionToolbar.deleteAll" />                                                                                                                | Deletes the bins after you agree in a dialog                            |

Align, rotate and match height skip a bin that has no room for the change. Rotate and match height also skip a bin with a locked size. A message tells you how many bins changed.

## Edit all the selected bins

With two or more bins selected, the inspector on the right edits them all at once:

- <Ui k="common.category" /> and <Ui k="inspector.layer" /> apply one value to every bin.
- The <Ui k="common.height" /> buttons make every bin taller or shorter by the same step. A bin with a locked size does not change.
- <Ui k="inspector.clearance" /> shows when a selected bin has clearance. It changes the clearance of each bin.
- To tag every bin with the same property, click <Ui k="inspector.setProperty" /> under <Ui k="inspector.customProperties" />. Type a name and a value, then click <Ui k="inspector.setOnAll" />.
- <Ui k="inspector.lockAllSizes" /> locks the size of every selected bin.
- <Ui k="inspector.toStash" /> and <Ui k="inspector.deleteAll" /> act on the whole selection.

## Merge the selection into one bin

Want one bin in place of a cluster of small ones? <Ui k="mobile.binMenu.mergeIntoOne" /> makes one bin with a compartment where each selected bin was. You find it in the inspector and in the bin menu.

1. Select two or more bins on the active layer.
2. Click <Ui k="mobile.binMenu.mergeIntoOne" />.
3. Type a <Ui k="designLinking.bento.nameLabel" /> for the new bin.
4. Set the <Ui k="designLinking.bento.heightLabel" /> and the <Ui k="designLinking.bento.dividerLabel" />.
5. Click <Ui k="designLinking.bento.confirm" />.

The Layout Tool saves the new bin as a design and opens it in the bin designer. Your layout stays as it is, unless you also select the option to replace the bins with the new one.

The merge uses only the selected bins on the active layer. Before you merge, the dialog tells you about these changes:

- Empty space between the bins becomes extra compartments.
- Shorter bins become as tall as the tallest one.
- A bin that uses a saved design loses its custom shape.
- A merged bin that is too large for your print bed prints in pieces.

If a bin that you did not select sits inside the area of the merged bin, the merge stops. Click <Ui k="designLinking.bento.trappedInclude" /> or <Ui k="designLinking.bento.trappedStash" /> to continue. For an insert without Gridfinity feet, select <Ui k="designLinking.bento.flatBase" />.

## Use the bin menus

Right-click a bin to open its menu. On a touch screen, touch and hold the bin. The menu changes with what you right-click:

| You right-click      | The menu has                                                                                                                                                                                                                                                                                                                        |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| One bin              | <Ui k="common.duplicate" />, <Ui k="mobile.binMenu.rotate" />, <Ui k="mobile.binMenu.lockSize" />, <Ui k="mobile.binMenu.expandToFit" />, <Ui k="mobile.binMenu.toStash" />, <Ui k="common.delete" />, <Ui k="stlSearch.findSTL" />, and the <Ui k="designLinking.menu.sectionTitle" /> actions that link the bin to a saved design |
| A bin in a selection | <Ui k="common.category" />, <Ui k="mobile.binMenu.expandToFit" />, <Ui k="mobile.binMenu.mergeIntoOne" /> and <Ui k="inspector.multi.delete" />, for the whole selection                                                                                                                                                            |

If the selection includes bins from the stash, the selection menu also has <Ui k="inspector.multi.layer" />, which puts them on a layer.

## When it goes wrong

### The selected bins won't move

Find the bin that has no room, and make room for it. Or <kbd>Ctrl</kbd>+click it (<kbd>Cmd</kbd>+click on a Mac) to take it out of the selection. If one selected bin can't go to the new spot, none of them move.

After a drag, a message names what is in the way. The arrow keys show no message, so the bins just stay where they are.

### Some of the bins didn't change

Make room around the bins that stayed, or change them one at a time. Align, rotate, match height and move to a layer skip a bin that has no room for the change. The message after the action tells you how many bins changed.

Rotate and match height also skip a bin with a locked size. Click <Ui k="inspector.unlockAllSizes" /> in the inspector, then try again.

### The merge dialog shows only a message

Select a smaller group, and merge again. The dialog stops in these cases:

- The selection has fewer than two bins on the active layer.
- The bins need more than 12 compartments across or 12 down.
- The merged bin would be more than 16 grid units on a side.

Every bin edge becomes a compartment line. So bins of mixed sizes, or bins that sit on half units, need a fine grid of compartments. Line the bins up on whole grid units to keep the grid small.

### The new bin opens, but the old bins stay in the layout

The merged design is safe in your library. When you replace the bins, the merged bin must fit where they were. It takes the height of the tallest bin, so it can lift a stack above the drawer top. Then the Layout Tool keeps the old bins, and a message tells you.

Lower or move the bins stacked above that area. Then delete the old bins, draw one bin over their area, and choose <Ui k="designLinking.menu.linkExisting" /> to link it to the merged design.

## Next steps

- [Place and edit bins](./placing-bins): the edits for one bin.
- [Work in layers](./layers): move bins between layers and stack them.
- [Categories and colors](./categories): color the bins that you selected.
- [Save and reuse designs](../designer/save-and-reuse): edit the merged bin in the bin designer.
