---
title: A screw and small-parts drawer
description: 'Turn a shallow drawer into labeled screw bins, with one design for many sizes and optional magnets.'
sources:
  - src/shared/hooks/useDrawerFitSuggestion.ts
  - src/shared/utils/heightUnits.ts
  - src/shared/utils/placedCaption.ts
  - src/features/bin-inspector/labelSuggest/sequence.ts
  - src/core/cqrs/v2/domain/bin/duplicateBin.ts
  - src/features/bin-designer/constants/defaults.ts
  - src/shared/generation/magnetPositions.ts
  - src/features/baseplate/utils/splitPlanner.ts
---

# A screw and small-parts drawer

Every workshop has a drawer of loose screws. Here, you turn a shallow drawer into 26 labeled bins. Small bins hold one screw size each, longer bins hold bolts, and two divided bins hold nuts and washers. You design the small bin once, and every copy prints its own label, such as M3x8.

<Screenshot id="recipes-screw-drawer-hero" alt="A shallow drawer layout in 3D with rows of small labeled screw bins, a row of longer bins and two divided bins at the back." spec="Layout editor, desktop 1440 px, 3D preview expanded with Space, isometric view from the front right. Layout with an 8 x 6 grid, measured size 345 x 260 x 40 mm, one layer, all bins 3u. Bottom two grid rows: 16 linked 1 x 1 bins with label tabs and a front finger scoop, Bin labels M3x6, M3x8, M3x10, M3x12, M3x16, M3x20, M3x25, M3x30, M4x8, M4x10, M4x12, M4x16, M4x20, M4x25, M4x30, M4x40. Rows 3 and 4: eight linked 1 x 2 bins labeled M5x20, M5x30, M6x20, M6x30, M8x30, M8x40, Inserts, Springs. Top two rows: two 4 x 2 bins with 4 columns and 2 rows of compartments, captions M2 to M10 nut on one and M2 to M10 washer on the other. Tab text must be legible. Crop to the preview." />

## What you need

- The inside size of your drawer. This recipe uses an example drawer of 345 × 260 mm, 40 mm high. Your own numbers change the results, so measure first.
- A print bed of 256 × 256 mm, the default size in the Gridfinity Layout Tool. A smaller bed works too, with more baseplate pieces.
- About 274 m of PLA, or 83% of a 1 kg spool. That's the estimate in the bin list for these bins, with the default settings.
- Magnets of 6 × 2 mm, only if you want them. Step 6 helps you decide.

## The plan

| Bins | Size in grid units | Height | Holds                         |
| ---- | ------------------ | ------ | ----------------------------- |
| 16   | 1 × 1              | 3u     | One screw size each           |
| 8    | 1 × 2              | 3u     | Longer screws, bolts, inserts |
| 2    | 4 × 2              | 3u     | Nuts or washers, 8 sizes each |

A 3u bin has a 21 mm body (3 × 7 mm) and a 4.4 mm stacking lip, so it stands 25.4 mm tall. Inside, it has 14 mm of room above the floor. That's plenty for screws, and you can see into a short bin from above.

## Step 1: Fit the grid to the drawer

1. In the [layout editor](https://gridfinitylayouttool.com/), click <Ui k="drawerDims.addMeasured" /> in the <Ui k="sidebar.gridSize" /> group.
2. Type 345, 260 and 40, and press <kbd>Enter</kbd>.
3. Click <Ui k="drawerDims.suggestionUse" /> on the card.

The grid becomes 8 × 6 grid units, or 336 × 252 mm. Here's the math: 345 ÷ 42 = 8.2, so 8 whole units fit and 9 mm stays free. Front to back, 260 ÷ 42 = 6.2, so 6 units fit and 8 mm stays free.

Want to know how tall a bin can be? Open <Ui k="stackSolver.title" /> under <Ui k="common.physicalUnits" />. For a 40 mm drawer, one bin can be 5u (39.4 mm tall). Our 3u bins leave 14.6 mm free above them. [Plan your first drawer](../getting-started/first-drawer) shows these controls in more detail.

## Step 2: Draw one bin of each kind

New bins take the height of the active layer, and the first layer starts at 3u. So you can draw right away.

1. Draw a 1 × 1 bin in the bottom-left corner of the grid. The bottom of the grid is the front of the drawer.
2. Leave the row above it empty. Draw a 1 × 2 bin (1 wide, 2 deep) in rows 3 and 4, at the left edge. The row numbers count up from the bottom.
3. Draw a 4 × 2 bin in the top-left corner, and a second one beside it.

## Step 3: Design the screw bin once

1. Select the 1 × 1 bin. In the right panel, under <Ui k="designLinking.inspector.linkedDesign" />, click <Ui k="designLinking.inspector.createDesign" />.
2. Name it "Screw bin", and click <Ui k="designLinking.createDialog.create" />. The bin designer opens with a 1 × 1 × 3u design.
3. In the <Ui k="binDesigner.group.interior" /> group, turn on <Ui k="binDesigner.labelTabs" />. Leave the text box empty. It reads <Ui k="binDesigner.labelTextLayoutLabelPlaceholder" />.
4. Turn on <Ui k="binDesigner.fingerScoop" />. It starts on the front wall, so screws slide up and out.

<Screenshot id="recipes-screw-drawer-blank-caption" alt="The label tab section of a 1 by 1 screw bin with the label text box left empty, next to the bin with its tab and front scoop." spec="Bin designer, desktop 1440 px, opened from a linked 1 x 1 x 3u bin. Interior group open, Label tabs on with Printed text, the Label text box empty so its placeholder shows, Finger scoop on with the front wall. Show the label section and the preview side by side. Crop to panel plus preview." />

The empty box is the trick. A design with one blank caption prints the <Ui k="inspector.binLabel" /> of each linked bin instead. So 16 bins share one design but get 16 labels.

Click <Ui k="toolSwitcher.layout" /> to go back, and repeat steps 1 to 4 for the 1 × 2 bin. Name that design "Bolt bin".

## Step 4: Copy the bins and label them

Copies of a linked bin keep the link, so copy the bins instead of drawing them.

1. Select the 1 × 1 bin and press <kbd>Ctrl</kbd>+<kbd>D</kbd> (<kbd>Cmd</kbd>+<kbd>D</kbd> on a Mac) seven times. Each copy lands to the right of the last one, until the row is full.
2. Click the number of that row at the edge of the grid to select all 8 bins. Press <kbd>Ctrl</kbd>+<kbd>D</kbd> once, and the row copies into the row above.
3. Do the same with the 1 × 2 bin to fill rows 3 and 4.

Now name each bin. Select it, and type its size in <Ui k="inspector.binLabel" />, such as M3x6. Label the next bin M3x8. From then on, the suggestion list offers M3x10, marked <Ui k="inspector.labelSuggest.reason.nextInSet" />. Press <kbd>Tab</kbd> to accept a gray suggestion.

Press <kbd>V</kbd> to open the 3D preview. Each tab shows its own label.

## Step 5: Divide the nut and washer bins

1. Select a 4 × 2 bin and click <Ui k="designLinking.inspector.createDesign" />.
2. In <Ui k="binDesigner.group.interior" />, keep <Ui k="binDesigner.interior.standard.title" />, and set <Ui k="binDesigner.columns" /> to 4 and <Ui k="binDesigner.rows" /> to 2. You get 8 compartments of about 40 × 40 mm.
3. Turn on <Ui k="binDesigner.labelTabs" />, and type a caption for each compartment: M2 nut, M2.5 nut, and so on.

This design has 8 captions, so it prints them and ignores the layout label. For the washer bin, open <Ui k="binDesigner.savedDesigns" />, use <Ui k="common.duplicate" /> on the nut bin, and change the captions. Then select the second 4 × 2 bin in the layout and click <Ui k="designLinking.inspector.linkExisting" /> to pick the copy.

## Step 6: Decide on magnets

Magnets hold bins to the plate. Skip them for a drawer that stays put, because the feet hold bins well. Add them for a box that you carry, like a [Milwaukee Packout drawer](https://gridfinitylayouttool.com/gridfinity-milwaukee-packout).

If you add them, count first. Each grid cell takes 4 magnets, in the bins and in the plate. This plate has 48 cells, so it takes 192 magnets. The bins take 4 for each cell too, unless you turn on <Ui k="binDesigner.base.cornerHolesOnly" />.

1. In each bin design, open <Ui k="binDesigner.group.base" /> and turn on <Ui k="binDesigner.base.magnetHoles" />. The default hole suits a 6 × 2 mm magnet.
2. In the baseplate generator, turn on <Ui k="baseplate.magnetHoles" /> in the <Ui k="baseplate.sectionBase" /> group.

## Step 7: Make the plate and export

Open the baseplate generator. It takes the 8 × 6 size from the layout. The plate is 336 × 252 mm, too large for a 256 mm bed, so it splits into two 4 × 6 pieces. They print in two build-plate loads.

Then go back to the layout editor and click <Ui k="header.export" />, then <Ui k="layoutExport.download" />. The ZIP holds one file for each label, the nut and washer bins, and the plate pieces. Print each file as many times as `manifest.txt` says.

::: tip
Print one 1 × 1 bin first, with its magnets if you use them. It tells you if the label is readable and the fit is right.
:::

## When it goes wrong

### A label tab prints blank

The bin has no <Ui k="inspector.binLabel" />, or you exported it from the bin designer. Only the layout knows the labels, so give every bin a label and export the layout ZIP. The bin list marks a row with <Ui k="print.row.blankLabelTabs" /> before you print. See [Troubleshooting prints](../printing/troubleshooting#the-labels-are-blank-or-missing).

### The drawer no longer closes after you add magnets

A plate with magnet holes keeps 0.5 mm of floor under each 2 mm magnet, so every bin sits 2.5 mm higher. In a 40 mm drawer, the tallest bin drops from 5u to 4u. The 3u bins still fit, with 12.1 mm free. Read the free space under the measured size in the <Ui k="sidebar.gridSize" /> group.

### The divided bin is hard to lift out

32 magnets hold a 4 × 2 bin very firmly. Turn on <Ui k="binDesigner.base.cornerHolesOnly" /> in that design, and it uses 4. See [The base](../designer/base#put-holes-at-the-corners-only).

## Next steps

- [Labels and text](../designer/labels-and-text): pick the font, size and finish of the captions
- [Magnets and screws](../baseplates/magnets-and-screws): magnet sizes and crush ribs for the plate
- [An electronics and craft organizer](./electronics-craft-organizer): labels that you can swap when the contents change
- [A deep tool drawer in two layers](./deep-tool-drawer): stack bins in a deeper drawer
