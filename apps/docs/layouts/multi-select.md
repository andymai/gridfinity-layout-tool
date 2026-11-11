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
---

# Work with several bins

A drawer often has rows of bins that need the same change. In the Gridfinity Layout Tool, you can select many bins and change them in one step. This page shows how to select bins, line them up, edit them together, and merge them into one bin.

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

Drag any selected bin, and all the selected bins move with it. The arrow keys also move all of them. If one bin cannot go to the new position, none of the bins move.

## Use the selection toolbar

When you select two or more bins on a computer, a toolbar shows above them.

<Screenshot id="layouts-multi-select-toolbar" alt="Four selected bins with the selection toolbar above them, showing the align buttons, category colors and bulk actions." spec="Layout editor on desktop. Layout with a 6 by 4 drawer, two layers, and four bins of different heights in a loose row on layer 1. Select the four bins with Ctrl+click so the selection toolbar shows. Crop to the toolbar and the selected bins." />

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

With two or more bins selected, the inspector on the right edits them all:

- <Ui k="common.category" /> and <Ui k="inspector.layer" /> apply one value to every bin.
- The <Ui k="common.height" /> buttons make every bin taller or shorter by the same step. A bin with a locked size does not change.
- <Ui k="inspector.clearance" /> shows when a selected bin has clearance. It changes the clearance of each bin.
- Under <Ui k="inspector.customProperties" />, click <Ui k="inspector.setProperty" />. Type a name and a value, then click <Ui k="inspector.setOnAll" />.
- <Ui k="inspector.lockAllSizes" /> locks the size of every selected bin.
- <Ui k="inspector.toStash" /> and <Ui k="inspector.deleteAll" /> act on the whole selection.

## Merge the selection into one bin

<Ui k="mobile.binMenu.mergeIntoOne" /> makes one bin with a compartment where each selected bin was. It is in the inspector and in the bin menu.

1. Select two or more bins on the active layer.
2. Click <Ui k="mobile.binMenu.mergeIntoOne" />.
3. Set the <Ui k="designLinking.bento.nameLabel" />, the <Ui k="designLinking.bento.heightLabel" /> and the <Ui k="designLinking.bento.dividerLabel" />.
4. Click <Ui k="designLinking.bento.confirm" />.

The Layout Tool saves the new bin as a design and opens it in the bin designer. Your layout does not change, unless you also select the option to replace the bins with the new one.

The merge uses only the selected bins on the active layer. Before you merge, the dialog tells you about these changes:

- Empty space between the bins becomes extra compartments.
- Shorter bins become as tall as the tallest one.
- A bin that uses a saved design loses its custom shape.
- A merged bin that is too large for your print bed prints in pieces.

If a bin that you did not select sits inside the area of the merged bin, the merge stops. Click <Ui k="designLinking.bento.trappedInclude" /> or <Ui k="designLinking.bento.trappedStash" /> to continue. Select <Ui k="designLinking.bento.flatBase" /> for an insert without Gridfinity feet.

## Use the bin menus

Right-click a bin to open its menu. On a touch screen, touch and hold the bin.

The menu of one bin has <Ui k="common.duplicate" />, <Ui k="mobile.binMenu.rotate" />, <Ui k="mobile.binMenu.lockSize" />, <Ui k="mobile.binMenu.expandToFit" />, <Ui k="mobile.binMenu.toStash" /> and <Ui k="common.delete" />. It also has <Ui k="stlSearch.findSTL" />, and the <Ui k="designLinking.menu.sectionTitle" /> actions that link the bin to a saved design.

When you right-click a bin that is part of a selection, the menu acts on the whole selection. It has <Ui k="common.category" />, <Ui k="mobile.binMenu.expandToFit" />, <Ui k="mobile.binMenu.mergeIntoOne" /> and <Ui k="inspector.multi.delete" />. If the selection includes bins from the stash, <Ui k="inspector.multi.layer" /> puts them on a layer.

## Next steps

- [Place and edit bins](./placing-bins): the edits for one bin.
- [Work in layers](./layers): move bins between layers and stack them.
- [Categories and colors](./categories): color the bins that you selected.
- [Save and reuse designs](../designer/save-and-reuse): edit the merged bin in the bin designer.
