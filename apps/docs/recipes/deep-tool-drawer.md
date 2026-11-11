---
title: A deep tool drawer in two layers
description: 'Stack lift-out trays on tall bins, and keep the whole stack under the drawer top.'
sources:
  - src/shared/utils/heightUnits.ts
  - src/shared/components/HeightUnitSolver/HeightUnitSolver.tsx
  - src/shared/utils/drawerCeiling.ts
  - src/shared/utils/restingStack.ts
  - src/features/layers/hooks/useLayerListController.ts
  - src/core/cqrs/v2/domain/bin/duplicateBin.ts
  - src/features/bin-designer/components/panel/HandleSection/
  - src/features/baseplate/utils/splitPlanner.ts
---

# A deep tool drawer in two layers

One layer of bins at the bottom of a deep drawer leaves a lot of air above it. Use two layers instead. Bulky tools go in tall bins at the bottom, and the tools you grab every day ride in trays on top. Lift a tray off to reach the bin under it.

<Screenshot id="recipes-deep-tool-drawer-hero" alt="A deep drawer layout in 3D with four tall bins on the bottom layer and four divided trays with hand holes lifted above them." spec="Layout editor, desktop 1440 px, 3D preview expanded with Space, All layers, Explode on, isometric view from the front right. Layout with a 10 x 8 grid, measured size 440 x 345 x 150 mm, two layers. Layer 1 at 14u: four linked 5 x 4 bins. Layer 2 at 6u: four linked 5 x 4 trays, each with 3 columns and 2 rows of compartments and handles on the left and right walls. Both layers and the gap between them must be visible. Crop to the preview." />

## What you need

- The inside size of your drawer. This recipe uses an example drawer of 440 × 345 mm, 150 mm high. Measure the height from the drawer floor to the lowest point above it.
- A print bed of 256 × 256 mm. The largest part here is a 5 × 4 bin, 210 × 168 mm, so it prints whole.
- About 926 m of PLA, or 2.8 spools of 1 kg. That's the bin list estimate with the default settings. Tall bins take a lot of plastic, so this is the costly recipe.

## The plan

| Layer      | Bins | Size  | Height | Inside height | Holds                          |
| ---------- | ---- | ----- | ------ | ------------- | ------------------------------ |
| 1 (bottom) | 4    | 5 × 4 | 14u    | 91 mm         | Drills, batteries, bulky tools |
| 2 (top)    | 4    | 5 × 4 | 6u     | 35 mm         | Hand tools, in 6 compartments  |

Each tray has the same footprint as the bin under it. Its feet drop into the stacking lip of that bin, so it sits firm and lifts straight off.

## Step 1: Fit the grid to the drawer

1. In the [layout editor](https://gridfinitylayouttool.com/), click <Ui k="drawerDims.addMeasured" /> in the <Ui k="sidebar.gridSize" /> group.
2. Type 440, 345 and 150, and press <kbd>Enter</kbd>.
3. If a card shows, click <Ui k="drawerDims.suggestionUse" />.

The grid that fits is 10 × 8 grid units, or 420 × 336 mm. That leaves 20 mm across and 9 mm front to back. A new layout is 10 × 8 already, so you may see no card. That only means the grid fits.

## Step 2: Find two heights that fit

Open <Ui k="stackSolver.title" /> under <Ui k="common.physicalUnits" />. For a 150 mm drawer, it lists the tallest bins for each stack:

| Stack     | Tallest bins | Stack height | Spare   |
| --------- | ------------ | ------------ | ------- |
| One bin   | 20u          | 144.4 mm     | 5.6 mm  |
| 2 stacked | 10u          | 144.05 mm    | 5.95 mm |
| 3 stacked | 6u           | 129.7 mm     | 20.3 mm |

<Screenshot id="recipes-deep-tool-drawer-fit-bins" alt="The Fit bins to your drawer readout for a 150 mm drawer, with rows for one bin, two stacked and three stacked." spec="Layout editor, desktop 1440 px, left panel. Layout with a 10 x 8 grid and a measured size of 440 x 345 x 150 mm. Open the Physical units group and expand Fit bins to your drawer. Crop to the expanded readout." />

The two bins in a stack don't need the same height. Here's why. Each unit adds 7 mm, each bin adds a 4.4 mm lip, and the top bin sinks 4.75 mm into the lip below. So a 14u bin under a 6u tray is 20 × 7 + 4.4 + 4.4 − 4.75 = 144.05 mm, the same as two 10u bins. Any pair that adds up to 20u fits with 5.95 mm spare.

## Step 3: Fill the bottom layer

1. In the <Ui k="common.layers" /> panel, set the height stepper of the layer to 14. New bins on this layer are now 14u.
2. Draw a 5 × 4 bin in the bottom-left corner.
3. Under <Ui k="designLinking.inspector.linkedDesign" />, click <Ui k="designLinking.inspector.createDesign" />, then <Ui k="designLinking.createDialog.create" />. A plain bin is fine, so go back with <Ui k="toolSwitcher.layout" />.
4. Select the bin and press <kbd>Ctrl</kbd>+<kbd>D</kbd> (<kbd>Cmd</kbd>+<kbd>D</kbd> on a Mac) three times. The copies fill the other three spots, and each one keeps the link.

## Step 4: Add the tray layer

1. Click <Ui k="layers.addNewLayer" /> in the <Ui k="common.layers" /> panel. The new layer goes on top and becomes active.
2. Set its height stepper to 6.
3. Draw a 5 × 4 tray over the bottom-left bin. A small tag on the tray says that it rests on a 14u bin.
4. Create a design for the tray, as in step 3.

In the bin designer, give the tray its compartments and hand holes:

1. In the <Ui k="binDesigner.group.interior" /> group, set <Ui k="binDesigner.columns" /> to 3 and <Ui k="binDesigner.rows" /> to 2. Each compartment is about 68 × 82 mm.
2. In the <Ui k="binDesigner.group.lid" /> group, turn on <Ui k="binDesigner.handles" />. They start on the front, left and right walls.
3. Click the front wall in the wall picker to turn it off. Keep the left and right walls.

<Screenshot id="recipes-deep-tool-drawer-handles" alt="The Handles section with the left and right walls picked, next to a divided tray with a hand hole in its side wall." spec="Bin designer, desktop 1440 px, 5 x 4 x 6u design with 3 columns and 2 rows of compartments. Lid group open, Handles on, Rectangle shape, only the left and right walls picked, default width and height. Turn the preview to show the left wall and its hole. Crop to panel plus preview." />

Go back to the layout, select the tray, and press <kbd>Ctrl</kbd>+<kbd>D</kbd> three times. The copies land over the other three bins.

::: tip
Why handles and not a pull tab? A pull tab stands above the rim and adds to the height of the stack. Hand holes cut into the wall and add nothing. The <Ui k="assembledHeight.title" /> readout in the bin designer shows the difference.
:::

## Step 5: Check the stack and the space above it

Look at the line under the measured size. It says that the tallest stack fits, with 5.9 mm to spare. Press <kbd>V</kbd> for the 3D preview, and turn on <Ui k="grid.explodedView.label" /> to see the trays lifted off their bins.

Does a bottom bin hold something that stands taller than the bin, like a drill on its end? Select that bin and type the extra height in <Ui k="inspector.clearanceMmLabel" />. No tray can rest above it, and the drawer check counts the extra height. See [Reserve space above a bin](../layouts/layers#reserve-space-above-a-bin).

## Step 6: Make the plate and export

Open the baseplate generator. The plate is 420 × 336 mm, so on a 256 mm bed it splits into four 5 × 4 pieces in four build-plate loads. Then export the layout with <Ui k="header.export" /> and <Ui k="layoutExport.download" />.

Print one tray before you print all eight parts. It shows you if the trays sit and lift the way you want.

## When it goes wrong

### The drawer doesn't close

The editor lets you place a bin when the height units fit. Try a 7u tray: 14u + 7u = 21u, or 147 mm, which is under 150 mm. But the printed stack has its lips too, so it stands 151.05 mm tall. The line under the measured size warns that it stands 1.1 mm above the drawer. Trust that line, and lower one layer by 1u. See [Check the drawer height](../layouts/drawer-setup#check-the-drawer-height).

### A tray rocks

A tray needs full support under its feet. If it spans two bins of different heights, or hangs over an empty cell, its inspector shows <Ui k="inspector.unevenSupport" />. Put the tray over bins of one height, or lift a short bin with a spacer. See [Make short bins finish flush with spacers](../layouts/layers#make-short-bins-finish-flush-with-spacers).

### A small tray slides around on a big bin

A tray smaller than the bin under it has nothing to hold it in place. In the design of the lower bin, open <Ui k="binDesigner.group.base" /> and turn on <Ui k="binDesigner.base.lipNotches" />. The lip then locks a smaller bin to one grid cell. See [Stacking](../designer/stacking#keep-smaller-bins-in-place-on-bigger-ones).

## Next steps

- [Work in layers](../layouts/layers): reorder layers and look between them in 3D
- [Stacking](../designer/stacking): the stacking lip and the assembled height
- [Walls](../designer/walls#add-handles): every handle shape and size
- [Tool drawer organizer](https://gridfinitylayouttool.com/gridfinity-tool-drawer): ideas for bits, sockets and wrenches
