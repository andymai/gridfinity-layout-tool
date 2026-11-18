---
title: Place and edit bins
description: 'Draw, move, resize and rotate bins, fill the gaps, slant bins, use half units and the stash, and undo a change.'
sources:
  - src/shared/hooks/interactions/
  - src/features/grid-editor/components/Grid/Bin/useBinPointerInteraction.ts
  - src/features/layers/components/ActiveLayerPanel/ActiveLayerPanel.tsx
  - src/features/layers/hooks/useLayerFillActions.ts
  - src/shared/utils/fill.ts
  - src/core/cqrs/v2/domain/bin/fillGaps.ts
  - src/features/bin-inspector/components/Inspector/BinSlantSection/
  - src/features/layers/components/SlantedRowControls/SlantedRowControls.tsx
  - src/features/grid-editor/components/Grid/Bin/BinSlantBadge.tsx
  - src/shared/utils/placedSlant.ts
  - src/shared/utils/slantRow.ts
  - src/shared/utils/slantRowFill.ts
  - src/shared/utils/validationPlacement.ts
  - src/shell/keyboard/handlers.ts
  - src/shared/utils/rotation.ts
  - src/shared/utils/expandToFit.ts
  - src/features/staging/
  - src/shell/Mobile/BinContextMenu/BinContextMenu.tsx
  - src/features/bin-designer/hooks/usePlaceBinInLayout.ts
  - src/shared/utils/validation.ts
  - src/core/cqrs/v2/domain/bin/duplicateBin.ts
  - src/shared/hooks/useExpandToFit.ts
---

# Place and edit bins

This is where a drawer plan takes shape. In the layout editor of the Gridfinity Layout Tool, you draw bins, move them around and tune their sizes until the drawer feels right. You can undo your last 100 changes, so try ideas freely. This page also covers the **stash**, a holding area for bins that are not in the drawer.

## Draw a bin

Drag across the empty cells you want the bin to cover. The bin appears and stays selected, so you can edit it right away. It gets the height of the active layer and the active category.

If the area touches another bin, the Layout Tool makes the new bin smaller so that it fits. To stop this snap, hold <kbd>Ctrl</kbd> while you drag.

<Screenshot id="layouts-placing-bins-draw" alt="A drag across four empty cells draws a 2 by 2 bin, and the new bin stays selected. A second drag takes in a corner of that bin, so the next bin snaps to the free cells." spec="Clip. Layout editor on desktop. Layout with a 6 by 4 drawer, four bins on the left and an empty area on the right. Drag across an empty 2 by 2 area. Then drag across an area that overlaps a corner of the new bin. Crop to the grid." />

Need a lot of bins of one size? Use the size brush:

1. In the left panel, click <Ui k="layers.sizeSelector" />.
2. Pick a size under <Ui k="layers.squares" /> or <Ui k="layers.rectangles" />.
3. Click the grid to place one bin, or drag to fill an area.
4. Press <kbd>Escape</kbd> to stop.

<Screenshot id="layouts-placing-bins-size-brush" alt="Size brush opens its sizes, and 1×1 is picked. Back on the grid, a click places one bin, and a drag fills a block of cells with 1 by 1 bins. Escape stops the brush." spec="Clip. Layout editor on desktop. Layout with a 6 by 4 drawer and an empty area at the back. Close-up: click Size brush, then the 1×1 square. Cut to the grid: click one cell, drag across a block of cells, and press Escape with a keycap. Crop to the grid." />

## Fill the gaps with bins

Want a bin in every empty spot of a layer? The Layout Tool can fill them for you.

1. In the <Ui k="common.layers" /> panel, click the layer that you want to fill.
2. Under <Ui k="layers.sizeSelector" /> in the left panel, click the fill button. Its label shows the number of cells that it can fill.

The Layout Tool starts at the front-left corner. In each empty spot, it puts the largest bin that fits, up to the largest size for your print bed. With half-grid mode on, the bins can also have half-unit sizes. The new bins get the height of the layer and the active category.

A message tells you how many bins it added. One undo removes all of them. You can also run <Ui k="commandPalette.fillGaps" /> from the command palette.

<Screenshot id="layouts-placing-bins-fill-gaps" alt="The fill button under Size brush shows the number of cells that it can fill. A click fills each gap with the largest bin that fits, and a message says how many bins it added." spec="Clip. Layout editor on desktop, left panel open. Layout with a 6 by 4 drawer, four bins on the left half and empty cells of different sizes on the right half. Click the fill button under Size brush. Hold on the filled grid and the message. Crop to the left panel and the grid." />

With a size picked in the size brush, the same button fills the layer with upright bins of that size. While <Ui k="layers.slantedRow.title" /> is on, that button is off: drag on the grid to paint the rows. When the layer has no empty cells, the button shows <Ui k="layers.noGaps" />.

## Move and copy bins

- Drag a bin to move it. If the drop spot is not free, the bin goes back.
- Hold <kbd>Alt</kbd> (<kbd>Option</kbd> on a Mac) while you drag to move a copy instead.
- Hold <kbd>Shift</kbd> and drag a bin onto a bin of the same size to swap them.
- Press an arrow key to move the selected bins one grid unit.
- Press <kbd>Ctrl</kbd>+<kbd>D</kbd> (<kbd>Cmd</kbd>+<kbd>D</kbd> on a Mac) to duplicate the selected bins.

<Screenshot id="layouts-placing-bins-move-copy" alt="The M4 bin is dragged to an empty cell and moves there. Then the M3 bin is dragged with Alt held, and a copy lands at the drop spot while the original stays." spec="Clip. Layout editor on desktop. Layout with a 6 by 4 drawer and an empty area at the back right. Drag M4 to an empty cell. Then hold Alt, with a keycap, and drag M3 to a different empty cell. Crop to the grid." />

A duplicate goes to the first free spot to the right, below, to the left or above the original. If there is no free spot, it goes to the stash.

## Resize a bin

Select one bin, and handles show on its edges and corners. Drag a handle to change the width, the depth or both. Prefer exact numbers? Type a <Ui k="common.width" /> and a <Ui k="common.depth" /> in the inspector on the right.

<Screenshot id="layouts-placing-bins-resize" alt="A click on the Screwdrivers bin shows its handles. The right edge handle makes it one unit wider. Then the top-right corner handle makes it wider and deeper." spec="Clip. Layout editor on desktop. Layout with a 6 by 3 drawer and a 2 by 1 Screwdrivers bin at the front left, with free cells to its right and behind it. Click the bin, drag the right edge handle out by one cell, then drag the top-right corner handle out by one cell each way. Crop to the grid." />

## Rotate a bin

Select one bin and press <kbd>R</kbd>, or right-click it and choose <Ui k="mobile.binMenu.rotate" />. The width and the depth swap.

<Screenshot id="layouts-placing-bins-rotate" alt="The Pliers bin, 1 by 3, is selected. A press of R turns it into a 3 by 1 bin." spec="Clip. Layout editor on desktop. Layout with a 6 by 4 drawer and a 1 by 3 Pliers bin with free cells to its right. Click Pliers, then press R with a keycap. Crop to the grid." />

If the turned bin has no room where it is, the Layout Tool moves it to the nearest free spot. A message tells you how far it went.

A bin that uses a saved design has a front and a back, so the Layout Tool also tracks which way it faces. Each press of <kbd>R</kbd> turns it a quarter, through all four directions. A square bin, or a bin with no room for a quarter turn, turns 180 degrees where it stands. Look at the 3D preview to see which way it faces.

## Use half units

Need a bin between two sizes? Turn on <Ui k="sidebar.halfBinMode" /> in the left panel, or press <kbd>H</kbd>. Bins can then have sizes and positions in half grid units. The arrow keys move a bin with a half-unit size or position by half a unit.

Half-grid mode doesn't change the feet under a bin. For a denser grid of feet, see [Use half-size feet](../designer/base#use-half-size-feet).

To turn the mode off, every bin needs a whole-unit size and position. If a bin doesn't have them, the switch and <kbd>H</kbd> open the same dialog. Click <Ui k="halfBinBlocked.confirm" /> to put those bins in the stash, or <Ui k="common.cancel" /> to keep the mode on.

## Lock a bin size

Got a bin exactly right? Lock it. A locked bin can still move, but its size stays fixed.

- In the inspector, click <Ui k="inspector.lockSize" />.
- Or right-click the bin and choose <Ui k="mobile.binMenu.lockSize" />.

A locked bin has no resize handles, and <kbd>R</kbd> doesn't rotate it. A duplicate of a locked bin doesn't keep the lock.

## Expand a bin to fill the space

Small gaps left between bins? Right-click a bin and choose <Ui k="mobile.binMenu.expandToFit" />. The walls of the bin grow out into the empty space around it, up to 21 mm on each side. The feet stay on the grid.

<Screenshot id="layouts-placing-bins-expand-to-fit" alt="A right-click on the Pliers bin opens its menu, and Expand to fit is chosen. The walls of Pliers grow into the empty column beside it, and a dashed line shows where its feet stay." spec="Clip. Layout editor on desktop. Layout with a 7 by 3 drawer: three 2 by 3 bins with one empty column between the first and the second. Right-click the first bin and choose Expand to fit. Crop to the grid and the menu." />

To expand a row, a column or a full grid of bins on one layer in one step, select them all first. To undo an expansion later, select the bin. Then click <Ui k="common.reset" /> under <Ui k="inspector.expandedFootprint" /> in the inspector.

## Slant a bin

A **slanted bin** leans toward one side, and its base stays flat on the grid. Tall items such as pens then fit in a shallow drawer. <Ui k="binDesigner.slant.title" /> has the <Ui k="settings.experimental" /> label: it is on for everyone, but it can still change.

1. Select one bin.
2. In the inspector, turn on <Ui k="binDesigner.slant.title" />. The bin leans 45° toward the back.
3. Set the <Ui k="binDesigner.slant.angle" />, from 1° to 60°. Each click on the stepper changes it by 5°.
4. Pick the side that the bin leans toward: <Ui k="binDesigner.overhang.side.back" />, <Ui k="binDesigner.overhang.side.front" />, <Ui k="binDesigner.overhang.side.left" /> or <Ui k="binDesigner.overhang.side.right" />.

Above 45°, the inspector shows a warning: <Ui k="binDesigner.slant.steep" /> On the grid, a small badge on the bin points the way that it leans. The grid also marks the strip that its top leans over, and the 3D preview shows the lean.

A slanted bin has no stacking lip. No bin on a different layer can go over or under a slanted bin or its end support.

### Rows and the end support

Slanted bins in a row lean on each other. A row is a line of bins on one layer. The bins touch edge to edge in the direction of the lean, and their sides line up.

The last bin at the end that the row leans toward has nothing to lean on. Select it and turn on <Ui k="binDesigner.slant.endSupport" />. The support is a wedge on the cells past the bin, and no other bin can go on those cells. The support exports as a second part.

### Slant a bin that uses a saved design

A bin that uses a saved design gets the slant of that design. The inspector shows the angle and the side of the design. When you change the angle, the side or the end support, this bin gets its own slant, and the design stays the same. Click <Ui k="inspector.slant.useDesign" /> to use the slant of the design again.

### Paint slanted rows

To fill an area with slanted rows in one step, use the size brush:

1. In the left panel, click <Ui k="layers.sizeSelector" />.
2. Turn on <Ui k="layers.slantedRow.title" />, then set the angle and the side.
3. Pick a size.
4. Drag across the area on the grid. A click places one bin.
5. Press <kbd>Escape</kbd> to stop.

<Screenshot id="layouts-placing-bins-slanted-row" alt="Size brush opens, Slanted row is turned on at 45 degrees toward the back, and a 1 by 2 size is picked. A drag across the back of the grid fills it with rows of bins that lean toward the back, and the last bin of each row stands on an end support." spec="Clip. Layout editor on desktop, left panel open. Layout with a 6 by 5 drawer, drawer height 4u, bins at the front and an empty area at the back. Click Size brush, turn on Slanted row and leave it at 45° and Back, then click the 1×2 size. Drag across the empty area. Hold on the new rows with their slant badges and supports. Crop to the left panel and the grid." />

Each row ends on an end support. Each bin is as tall as the drawer height allows. All the bins link to one saved design, which the Layout Tool saves for you, or it uses a saved design that matches. One undo removes the bins, and the design stays in your saved designs.

<Ui k="layers.slantedRow.title" /> stays on until you turn it off. The fill button under the size brush places only upright bins, so it is off while slanted rows are on. A row that other bins cut in two loses its end support. To make a slanted design in the bin designer, see [Make a slanted bin](../designer/special-bins#make-a-slanted-bin).

## Merge bins into one

Select two or more bins on one layer and choose <Ui k="mobile.binMenu.mergeIntoOne" />. The Layout Tool makes one saved design with a compartment for each bin, and opens it in the bin designer. For the details, see [Work with several bins](./multi-select#merge-the-selection-into-one-bin).

## Put bins in the stash

The stash, below the grid, holds bins that are not in the drawer. It's a safe place to park a bin while you try ideas. Bins in the stash are not on the print list.

To put a bin in the stash, drag it onto the stash, or click <Ui k="inspector.toStash" /> in the inspector. In the size brush, hold <kbd>Shift</kbd> and click a size to add a new bin of that size to the stash.

To move every bin on the active layer to the stash, click the clear button under the size brush in the left panel. Its label shows how many bins it moves. Then click <Ui k="layers.clearLayer.confirm" />.

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

## When it goes wrong

### The bin won't drop where you want it

Read the red tag over the bin while you drag. It names what is in the way. If you let go there anyway, the bin goes back, and a message repeats the reason.

| The tag says                        | What to do                                                                 |
| ----------------------------------- | -------------------------------------------------------------------------- |
| <Ui k="grid.collision" />           | Move the other bin first, or pick a free spot.                             |
| <Ui k="grid.outOfBounds" />         | Keep the whole bin on the grid, or make the drawer larger.                 |
| <Ui k="grid.outsideDrawerShape" />  | Keep the bin on cells that the drawer shape keeps.                         |
| <Ui k="grid.exceedsDrawerHeight" /> | Use a shorter bin, or a spot with lower bins under it.                     |
| A bin on a lower layer blocks it    | Pick a spot outside the striped cells, or lower the clearance of that bin. |

Next to a taken spot, the bin can also snap to the closest free spot. Hold <kbd>Ctrl</kbd> while you drag to stop the snap.

<Screenshot id="layouts-placing-bins-blocked" alt="The M4 bin is dragged onto Hex keys. With Ctrl held, the snap stops, and a red tag names the collision. On release, M4 goes back to where it was." spec="Clip. Layout editor on desktop. Layout with a 6 by 4 drawer. Drag M4 onto the Hex keys bin and hold. Then hold Ctrl, with a keycap, so the snap stops and the red tag shows. Let go, and hold on M4 back in its spot. Crop to the grid." />

### A copy doesn't show up next to the original

Look in the stash below the grid, and drag the copy to an open spot. A copy needs a free spot right beside the original. When it finds none, the copy goes to the stash.

### R doesn't turn the bin

Read the message that shows. If it says <Ui k="toast.binSizeLocked" />, click <Ui k="inspector.unlockSize" /> in the inspector, and press <kbd>R</kbd> again.

If the message says that the bin can't rotate, the turned bin has no room. It doesn't fit where it stands, or anywhere within 3 cells of it. Drag the bin to an open area first, then turn it.

### Expand to fit leaves the gaps

The message tells you what stopped it:

| The message is about       | What to do                                                                   |
| -------------------------- | ---------------------------------------------------------------------------- |
| The shape of the selection | Select bins that make one row, one column or one full grid, on one layer.    |
| Too much empty space       | Each side can grow 21 mm at most. Use larger bins, or select more of them.   |
| Bins with a locked size    | Unlock their sizes in the inspector, then try again.                         |
| A bin stacked on top       | The wider walls would lift a stack above the drawer. Lower that stack first. |

### Fill gaps leaves empty cells

Look at what is in or under those cells. The fill button doesn't put a bin on these cells:

- Cells that the drawer shape removes.
- Cells of an end support on the same layer.
- Cells over or under a slanted bin or its end support on a different layer.
- Cells where a bin of the layer height would stand above the drawer top, or rest on the clearance of a lower bin.

It also doesn't add a bin that would lift a bin on a higher layer above the drawer top. The number on the button leaves out the cells in this list.

### Slant is gray in the inspector

Read the line under the toggle:

| The line says                              | What to do                                                                                                                             |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="inspector.slant.heldBy.design" />   | The saved design has a feature that can't slant. [Make a slanted bin](../designer/special-bins#make-a-slanted-bin) names some of them. |
| <Ui k="inspector.slant.heldBy.overhang" /> | Click <Ui k="common.reset" /> under <Ui k="inspector.expandedFootprint" />, or turn off <Ui k="inspector.extendToMargin" />.           |

### A slanted bin shows a warning

The badge of a slanted bin changes to a warning (<Ui k="grid.bin.slantIssue" />) when the slant has a problem. Select the bin, and read the line under <Ui k="binDesigner.slant.title" /> in the inspector:

| The inspector says                           | What to do                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| <Ui k="inspector.slant.issue.mismatch" />    | Click <Ui k="inspector.slant.matchRow" />. The row gets this angle and side, and the last bin gets the end support. |
| <Ui k="inspector.slant.issue.unsupported" /> | Turn on <Ui k="binDesigner.slant.endSupport" /> for this bin.                                                       |
| <Ui k="inspector.slant.issue.pastDrawer" />  | Lower the angle, or move the row away from that edge. Then turn on the end support.                                 |
| <Ui k="inspector.slant.issue.blocked" />     | Move the bin that stands on the end support, or the bin over or under this bin on a different layer.                |

If <Ui k="inspector.slant.matchRow" /> doesn't show, a bin in the row can't slant, or the top leans over a bin outside the row.

### A slant change doesn't apply

If the inspector says <Ui k="inspector.slant.noRoom" />, the change needs cells that are not free. An end support needs free cells past the bin, inside the drawer. The cells of the bin and its support must also be free on the other layers. Move the bins in the way, or pick a different side.

## Next steps

- [Work with several bins](./multi-select): align, edit and merge many bins at once.
- [Work in layers](./layers): stack bins on top of other bins.
- [Saved designs and linked bins](../concepts/saved-designs): what changes when a bin uses a design.
- [Special bins](../designer/special-bins#make-a-slanted-bin): make a slanted design in the bin designer.
- [Keyboard shortcuts](../reference/shortcuts): all the keys of the layout editor.
