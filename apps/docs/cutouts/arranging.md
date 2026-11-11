---
title: Arrange cutouts
description: 'Repeat, group, align, pack and measure cutouts in the cutout editor, and give each copy of a repeat its own label.'
sources:
  - src/features/bin-designer/components/CutoutWorkspace/WorkspaceHeader.tsx
  - src/features/bin-designer/components/CutoutWorkspace/InspectorContent.tsx
  - src/features/bin-designer/components/CutoutWorkspace/CutoutRepeatLabels.tsx
  - src/features/bin-designer/components/CutoutWorkspace/BinSizeSection.tsx
  - src/features/bin-designer/components/panel/CutoutsSection/CutoutArrayControls.tsx
  - src/features/bin-designer/components/panel/CutoutsSection/autoArrange.ts
  - src/features/bin-designer/utils/cutoutHierarchy.ts
  - src/features/bin-designer/components/panel/CutoutsSection/handlers/rulerHandler.ts
---

# Arrange cutouts

The Gridfinity Layout Tool has tools to fill a bin with many cutouts and keep them in order. This page shows how to repeat a cutout, group cutouts, line them up, pack them, and measure the space between them. Read [Cutout basics](./basics) first if you have not drawn a cutout yet.

## Select several cutouts

- Click a cutout to select it. <kbd>Shift</kbd>+click adds or removes a cutout.
- Drag a box across empty board to select all the cutouts in it.
- <kbd>Ctrl</kbd>+<kbd>A</kbd> selects all cutouts.

The <Ui k="binDesigner.shapeList.tabShapes" /> tab lists every cutout. Use it to rename, lock or hide a cutout. A hidden cutout cuts nothing.

## Repeat a cutout

A repeat makes many copies from one cutout. Each copy follows the first one: its shape, size, depth and fit.

1. Select one cutout.
2. Open <Ui k="binDesigner.cutouts.section.repeat" />.
3. Click a chip under <Ui k="binDesigner.cutouts.repeat.presetLabel" />, or click <Ui k="binDesigner.cutouts.repeat.create" />.
4. Pick a mode and set the counts and the spacing.

| Mode                                                 | Settings                                                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.repeat.mode.grid" />      | <Ui k="binDesigner.cutouts.repeat.cols" />, <Ui k="binDesigner.cutouts.repeat.rows" />, <Ui k="binDesigner.cutouts.repeat.pitchX" /> and <Ui k="binDesigner.cutouts.repeat.pitchY" />.                |
| <Ui k="binDesigner.cutouts.repeat.mode.staggered" /> | The same as a grid, with every other row moved over.                                                                                                                                                  |
| <Ui k="binDesigner.cutouts.repeat.mode.radial" />    | <Ui k="binDesigner.cutouts.repeat.count" />, <Ui k="binDesigner.cutouts.repeat.radius" />, <Ui k="binDesigner.cutouts.repeat.startAngle" /> and <Ui k="binDesigner.cutouts.repeat.rotateToCenter" />. |

A repeat has up to 50 columns or rows, and up to 400 copies. <Ui k="binDesigner.cutouts.repeat.flatten" /> changes the copies into separate cutouts. <Ui k="binDesigner.cutouts.repeat.remove" /> goes back to one cutout. Pen shapes cannot repeat.

If you already have 3 or more matching cutouts in a row, a grid or a ring, select them. The panel offers <Ui k="binDesigner.cutouts.repeat.merge" />, which changes them into one repeat. The key is <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>.

## Fill a bin with a repeating cutout

1. Move the cutout to the front-left corner of the bin.
2. Open <Ui k="binDesigner.cutouts.section.repeat" /> and set the pitch.
3. Click <Ui k="binDesigner.cutouts.repeat.fillBin" />.

The Layout Tool sets the rows and columns that fit at that pitch. It adds copies toward the far edges of the bin, so a cutout near a far edge has no room for more. When copies overlap, their cuts merge into one opening.

<Screenshot id="cutouts-arranging-repeat" alt="A hexagon cutout repeated in a grid that fills a bin, with the Repeat section open." spec="Cut editor, 2x2 bin, one hexagon at 6.35 mm across flats near the front-left corner. Open Repeat, pick Grid, set pitch 12 mm, click Fill bin. Show the board full of hexagons and the Repeat section. Crop to the board and the panel." />

## Give each copy its own label

1. Select the repeat.
2. Open <Ui k="binDesigner.cutouts.section.label" />.
3. Click <Ui k="binDesigner.cutouts.repeat.labels.enable" />.
4. Type one label on each line, or paste a list.

The labels fill the copies top row first, then left to right. A ring fills in order from the first copy. <Ui k="binDesigner.cutouts.repeat.labels.splitCommas" /> changes a list with commas into lines. An empty line leaves that copy with no label. When the list is short, the remaining copies use the single label. A socket label has one plate for all copies, so all copies share its text.

## Group cutouts

Select two or more cutouts and click <Ui k="binDesigner.cutouts.group" />, or press <kbd>Ctrl</kbd>+<kbd>G</kbd>. A group of loose cutouts cuts as one shape. Pick how the shapes combine under <Ui k="binDesigner.cutouts.pathfinder.title" />:

| Operation                                           | Result                                                          |
| --------------------------------------------------- | --------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.pathfinder.union" />     | All shapes join into one cutout.                                |
| <Ui k="binDesigner.cutouts.pathfinder.subtract" />  | The front shape cuts out of the others, so plastic stays there. |
| <Ui k="binDesigner.cutouts.pathfinder.intersect" /> | The Layout Tool cuts only the area that all shapes share.       |
| <Ui k="binDesigner.cutouts.pathfinder.exclude" />   | The shapes join, but the area where they overlap stays solid.   |

Use <Ui k="binDesigner.cutouts.arrange.bringToFront" /> and <Ui k="binDesigner.cutouts.arrange.sendToBack" /> in the right-click menu to choose the front shape.

### Groups inside groups

Select a group and more cutouts, then group them again. The outer group holds its contents in place when you move, align or repeat it. It does not change the cut. Groups go up to 10 levels deep.

Double-click a cutout to work inside its group. Press <kbd>Esc</kbd> to go back out one level. The editor header shows the group that you are in. <Ui k="binDesigner.cutouts.ungroup" /> (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>) removes one level.

To repeat a group, select the whole group and use <Ui k="binDesigner.cutouts.section.repeat" />. Every copy keeps the same arrangement and the same angle.

## Align and distribute

Select two or more cutouts. A toolbar opens under the editor header:

- <Ui k="binDesigner.cutouts.alignLeft" />, <Ui k="binDesigner.cutouts.alignCenterH" />, <Ui k="binDesigner.cutouts.alignRight" />, <Ui k="binDesigner.cutouts.alignTop" />, <Ui k="binDesigner.cutouts.alignCenterV" /> and <Ui k="binDesigner.cutouts.alignBottom" /> line up the selection.
- <Ui k="binDesigner.cutouts.distributeH" /> and <Ui k="binDesigner.cutouts.distributeV" /> make the spaces equal. They need three or more cutouts.
- <Ui k="binDesigner.cutouts.centerInBin" />, <Ui k="binDesigner.cutouts.centerH" /> and <Ui k="binDesigner.cutouts.centerV" /> center the selection in the bin.

A group moves as one item.

## Edit several cutouts at once

With two or more cutouts selected, <Ui k="binDesigner.shapeList.tabProperties" /> shows the settings that they share: position, size, rotation, depth, scoop, entry edge and color. When the values differ, the field shows a short dash. Type a value to give it to all selected cutouts.

## Pack cutouts with auto-arrange

1. Select the cutouts. To pack all of them, press <kbd>Ctrl</kbd>+<kbd>A</kbd>.
2. In the toolbar, click <Ui k="binDesigner.cutouts.autoArrange" />.
3. Set the <Ui k="binDesigner.cutouts.gap" />. It starts at 2 mm.
4. Set <Ui k="binDesigner.cutouts.staggered" /> and <Ui k="binDesigner.cutouts.turnToFit" />.
5. Click <Ui k="binDesigner.cutouts.autoArrange" /> in the box.

<Ui k="binDesigner.cutouts.turnToFit" /> is on at the start. It turns each shape to take the least room, so a tool traced at an angle lies square. Groups move as one and keep their angle.

## Bring back a cutout that is off the board

When a cutout goes past the edge of the bin, a warning shows how many cutouts the bin will clip. It offers up to three actions:

- A button that makes the bin larger to fit the cutouts. It names the new size.
- <Ui k="binDesigner.cutouts.centerInBin" /> moves the cutouts to the middle. It shows only when they fit in the bin.
- <Ui k="binDesigner.cutoutEditor.bringBackIn" /> moves each cutout back inside the edge.

## Measure on the board

Click <Ui k="binDesigner.cutouts.rulerTool" /> (<kbd>M</kbd>) and drag between two points. With the select tool, hold <kbd>Shift</kbd> and drag for a quick measurement. The ruler snaps to corners, edge midpoints, centers and edges, and to the grid when snap is on. The rulers on the top and left edges of the board show millimeters. To measure the 3D model, use <Ui k="binDesigner.measure.short" /> in the preview.

<Screenshot id="cutouts-arranging-ruler" alt="The ruler tool measures the gap between two cutouts on the board." spec="Cut editor with two rectangles 8 mm apart. Pick the Ruler tool and drag from the right edge of one rectangle to the left edge of the other so the snap marks and the distance label show. Crop to the board with the top and left rulers." />

## Next steps

- [Import SVG and STL shapes](./import-svg-stl): bring in outlines and models to arrange.
- [Check before you print](./print-checks): find cutouts that sit too close together.
- [Trace a photo](./photo-trace): add real tools from a photo.
