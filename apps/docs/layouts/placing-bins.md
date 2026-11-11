---
title: Place and edit bins
description: 'Draw, move, resize and rotate bins, use half units and the stash, and undo a change.'
sources:
  - src/shared/hooks/interactions/
  - src/features/grid-editor/components/Grid/Bin/useBinPointerInteraction.ts
  - src/shell/keyboard/handlers.ts
  - src/shared/utils/rotation.ts
  - src/shared/utils/expandToFit.ts
  - src/features/staging/
  - src/shell/Mobile/BinContextMenu/BinContextMenu.tsx
  - src/features/bin-designer/hooks/usePlaceBinInLayout.ts
---

# Place and edit bins

This is where a drawer plan takes shape. In the layout editor of the Gridfinity Layout Tool, you draw bins, move them around and tune their sizes until the drawer feels right. You can undo your last 100 changes, so try ideas freely. This page also covers the stash, a holding area for bins that are not in the drawer.

## Draw a bin

Drag across the empty cells you want the bin to cover. The bin appears and stays selected, so you can edit it right away. It gets the height of the active layer and the active category.

If the area touches another bin, the Layout Tool makes the new bin smaller so that it fits. To stop this snap, hold <kbd>Ctrl</kbd> while you drag.

Need a lot of bins of one size? Use the size brush:

1. In the left panel, click <Ui k="layers.sizeSelector" />.
2. Pick a size under <Ui k="layers.squares" /> or <Ui k="layers.rectangles" />.
3. Click the grid to place one bin, or drag to fill an area.
4. Press <kbd>Escape</kbd> to stop.

## Move and copy bins

- Drag a bin to move it. If the drop spot is not free, the bin goes back.
- Hold <kbd>Alt</kbd> (<kbd>Option</kbd> on a Mac) while you drag to move a copy instead.
- Hold <kbd>Shift</kbd> and drag a bin onto a bin of the same size to swap them.
- Press an arrow key to move the selected bins one grid unit.
- Press <kbd>Ctrl</kbd>+<kbd>D</kbd> (<kbd>Cmd</kbd>+<kbd>D</kbd> on a Mac) to duplicate the selected bins.

A duplicate goes to the first free spot to the right, below, to the left or above the original. If there is no free spot, it goes to the stash.

## Resize a bin

Select one bin, and handles show on its edges and corners. Drag a handle to change the width, the depth or both. Prefer exact numbers? Type a <Ui k="common.width" /> and a <Ui k="common.depth" /> in the inspector on the right.

## Rotate a bin

Select one bin and press <kbd>R</kbd>, or right-click it and choose <Ui k="mobile.binMenu.rotate" />. The width and the depth swap.

If the turned bin has no room where it is, the Layout Tool moves it to the nearest free spot. A message tells you how far it went.

A bin that uses a saved design has a front and a back, so the Layout Tool also tracks which way it faces. Each press of <kbd>R</kbd> turns it a quarter, through all four directions. A square bin, or a bin with no room for a quarter turn, turns 180 degrees where it stands. Look at the 3D preview to see which way it faces.

## Use half units

Need a bin between two sizes? Turn on <Ui k="sidebar.halfBinMode" /> in the left panel, or press <kbd>H</kbd>. Bins can then have sizes and positions in half grid units. The arrow keys move a bin with a half-unit size or position by half a unit.

Half-grid mode doesn't change the feet under a bin. For a denser grid of feet, see [Use half-size feet](../designer/base#use-half-size-feet).

To turn the mode off, every bin needs a whole-unit size and position. If one doesn't have them, a dialog opens. Click <Ui k="halfBinBlocked.close" /> to move those bins to the stash and turn the mode off, or <Ui k="common.cancel" /> to keep it on.

## Lock a bin size

Got a bin exactly right? Lock it. A locked bin can still move, but its size stays fixed.

- In the inspector, click <Ui k="inspector.lockSize" />.
- Or right-click the bin and choose <Ui k="mobile.binMenu.lockSize" />.

A locked bin has no resize handles, and <kbd>R</kbd> doesn't rotate it. A duplicate of a locked bin doesn't keep the lock.

## Expand a bin to fill the space

Small gaps left between bins? Right-click a bin and choose <Ui k="mobile.binMenu.expandToFit" />. The walls of the bin grow out into the empty space around it, up to 21 mm on each side. The feet stay on the grid.

To expand a row, a column or a full grid of bins on one layer in one step, select them all first. To undo an expansion later, select the bin. Then click <Ui k="common.reset" /> under <Ui k="inspector.expandedFootprint" /> in the inspector.

## Merge bins into one

Select two or more bins on one layer and choose <Ui k="mobile.binMenu.mergeIntoOne" />. The Layout Tool makes one saved design with a compartment for each bin, and opens it in the bin designer. For the details, see [Work with several bins](./multi-select#merge-the-selection-into-one-bin).

## Put bins in the stash

The stash, below the grid, holds bins that are not in the drawer. It's a safe place to park a bin while you try ideas. Bins in the stash are not on the print list.

To put a bin in the stash, drag it onto the stash, or click <Ui k="inspector.toStash" /> in the inspector. In the size brush, hold <kbd>Shift</kbd> and click a size to add a new bin of that size to the stash.

The Layout Tool also moves bins to the stash for you in these cases:

- The drawer gets smaller.
- You delete a layer.
- A drawer shape removes their cells.

To put a bin back, drag it from the stash to the grid. You can also right-click it and choose <Ui k="mobile.binMenu.moveToGrid" />. This puts it in the front-left corner when that spot is free. <Ui k="staging.clearAll" /> deletes every bin in the stash.

<Screenshot id="layouts-placing-bins-stash" alt="The stash below the grid holds three bins. One bin is dragged out of the stash and dropped into an empty spot on the grid." spec="Clip. Layout editor on desktop. Layout with a 5 by 4 drawer, four bins on the grid and three bins of different sizes in the stash. Drag the 2 by 2 stash bin onto the empty 2 by 2 area at the back right of the grid and hold on the result. Crop to the grid and the stash." />

## Drop a saved design into the drawer

In the bin designer, <Ui k="binDesigner.placeInLayout.action" /> puts a saved design in the first free spot of the active layer. [Save and reuse designs](../designer/save-and-reuse#place-a-design-in-a-layout) gives the steps.

To give a bin that is already on the grid a design, right-click it and choose <Ui k="designLinking.menu.linkExisting" />. [Saved designs and linked bins](../concepts/saved-designs) explains what the link keeps in step.

## Delete and undo

Select bins and press <kbd>Delete</kbd> or <kbd>Backspace</kbd>. You can also right-click a bin and choose <Ui k="common.delete" />.

Changed your mind? Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> (<kbd>Cmd</kbd>+<kbd>Z</kbd> on a Mac) to undo, and <kbd>Ctrl</kbd>+<kbd>Y</kbd> to redo. A message names each change that you undo. The Layout Tool keeps the last 100 changes.

To empty the full active layer, click the clear button under the size brush in the left panel. Its label shows how many bins it clears. Clear deletes the bins. It does not put them in the stash, so undo is the only way to get them back. To keep the bins, select them and click <Ui k="selectionToolbar.moveToStash" /> instead. <Ui k="commandPalette.selectAll" /> in the command palette selects every bin on the active layer.

## Next steps

- [Work with several bins](./multi-select): align, edit and merge many bins at once.
- [Work in layers](./layers): stack bins on top of other bins.
- [Saved designs and linked bins](../concepts/saved-designs): what changes when a bin uses a design.
- [Keyboard shortcuts](../reference/shortcuts): all the keys of the layout editor.
