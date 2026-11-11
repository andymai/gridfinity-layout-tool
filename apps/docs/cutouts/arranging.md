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
  - src/features/bin-designer/components/panel/CutoutsSection/cutoutSectionVisibility.ts
  - src/features/bin-designer/components/panel/CutoutsSection/PathfinderControls.tsx
  - src/shared/utils/cutoutArray.ts
---

# Arrange cutouts

A bin for forty hex bits shouldn't take forty cutouts by hand. The Gridfinity Layout Tool can repeat one cutout, group shapes, line them up, pack them tight, and measure the gaps between them. New to cutouts? Start with [Cutout basics](./basics).

## Select several cutouts

- Click a cutout to select it. <kbd>Shift</kbd>+click adds or removes a cutout.
- Drag a box across empty board to select all the cutouts in it.
- <kbd>Ctrl</kbd>+<kbd>A</kbd> selects all cutouts.

The <Ui k="binDesigner.shapeList.tabShapes" /> tab lists every cutout. Use it to rename, lock or hide a cutout. A hidden cutout cuts nothing, which is handy when you want to try a layout without it.

## Repeat a cutout

A **repeat** makes many copies from one cutout. Each copy follows the first one: its shape, size, depth and fit. Change the first, and every copy changes with it.

1. Select one cutout and open <Ui k="binDesigner.cutouts.section.repeat" />.
2. Click a chip under <Ui k="binDesigner.cutouts.repeat.presetLabel" />, or click <Ui k="binDesigner.cutouts.repeat.create" />.
3. Pick a mode and set the counts and the spacing.

| Mode                                                 | Settings                                                                                                                                                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.repeat.mode.grid" />      | <Ui k="binDesigner.cutouts.repeat.cols" />, <Ui k="binDesigner.cutouts.repeat.rows" />, <Ui k="binDesigner.cutouts.repeat.pitchX" /> and <Ui k="binDesigner.cutouts.repeat.pitchY" />.                |
| <Ui k="binDesigner.cutouts.repeat.mode.staggered" /> | The same as a grid, with every other row moved over.                                                                                                                                                  |
| <Ui k="binDesigner.cutouts.repeat.mode.radial" />    | <Ui k="binDesigner.cutouts.repeat.count" />, <Ui k="binDesigner.cutouts.repeat.radius" />, <Ui k="binDesigner.cutouts.repeat.startAngle" /> and <Ui k="binDesigner.cutouts.repeat.rotateToCenter" />. |

The **pitch** is the distance from the center of one copy to the center of the next. A repeat has up to 50 columns or rows, and up to 400 copies. Pen shapes can't repeat.

Changed your mind? <Ui k="binDesigner.cutouts.repeat.flatten" /> turns the copies into separate cutouts that you can move one by one. <Ui k="binDesigner.cutouts.repeat.remove" /> goes back to one cutout.

Already drew 3 or more matching cutouts in a row, a grid or a ring? Select them, and the panel offers <Ui k="binDesigner.cutouts.repeat.merge" />, which makes them one repeat. The key is <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>.

## Fill a bin with a repeating cutout

1. Move the cutout to the front-left corner of the bin.
2. Open <Ui k="binDesigner.cutouts.section.repeat" /> and set the pitch.
3. Click <Ui k="binDesigner.cutouts.repeat.fillBin" />.

The Layout Tool sets the rows and columns that fit at that pitch. It adds copies toward the far edges of the bin, so a cutout near a far edge has no room for more. When copies overlap, their cuts merge into one opening.

<Screenshot id="cutouts-arranging-repeat" alt="In the Repeat section, clicking Add repeat, typing 12 mm for both pitches and clicking Fill bin. The repeat grows to 6 by 6, and the board fills with 36 hexagons." spec="Cut editor, 2x2 bin, one hexagon at 6.35 mm across flats near the front-left corner. In close-up on Repeat, click Add repeat, set Pitch X and Pitch Y to 12 mm, click Fill bin. End on the board full of hexagons." />

## Give each copy its own label

In a set of drill bits, each bit has its own size. Give each copy its own label to match.

1. Select the repeat and open <Ui k="binDesigner.cutouts.section.label" />.
2. Click <Ui k="binDesigner.cutouts.repeat.labels.enable" />.
3. Type one label on each line, or paste a list.

The labels fill the copies top row first, then left to right. A ring fills in order from the first copy. Got a list with commas? <Ui k="binDesigner.cutouts.repeat.labels.splitCommas" /> changes it into lines.

An empty line leaves that copy with no label. When the list is short, the remaining copies use the single label. A socket label has one plate for all copies, so all copies share its text.

## Group cutouts

Select two or more cutouts and click <Ui k="binDesigner.cutouts.group" />, or press <kbd>Ctrl</kbd>+<kbd>G</kbd>. A group of loose cutouts cuts as one shape. Under <Ui k="binDesigner.cutouts.pathfinder.title" />, pick how the shapes combine:

| Operation                                           | Result                                                          |
| --------------------------------------------------- | --------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.pathfinder.union" />     | All shapes join into one cutout.                                |
| <Ui k="binDesigner.cutouts.pathfinder.subtract" />  | The front shape cuts out of the others, so plastic stays there. |
| <Ui k="binDesigner.cutouts.pathfinder.intersect" /> | The Layout Tool cuts only the area that all shapes share.       |
| <Ui k="binDesigner.cutouts.pathfinder.exclude" />   | The shapes join, but the area where they overlap stays solid.   |

To choose the front shape, right-click and use <Ui k="binDesigner.cutouts.arrange.bringToFront" /> or <Ui k="binDesigner.cutouts.arrange.sendToBack" />.

### Groups inside groups

Select a group and more cutouts, then group them again. The outer group holds its contents in place when you move, align or repeat it. It doesn't change the cut. Groups go up to 10 levels deep.

Double-click a cutout to work inside its group, and press <kbd>Esc</kbd> to go back out one level. A double-click on a path cutout, such as a scan, a trace or a pen shape, edits its points instead. The editor header shows the group that you're in. <Ui k="binDesigner.cutouts.ungroup" /> (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>) removes one level.

To repeat a group, select the whole group and use <Ui k="binDesigner.cutouts.section.repeat" />. Every copy keeps the same arrangement and the same angle.

## Align and distribute

Select two or more cutouts, and a toolbar opens under the editor header. A group moves as one item.

| Buttons                                                                                                                          | What they do                                                     |
| -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.alignLeft" />, <Ui k="binDesigner.cutouts.alignCenterH" />, <Ui k="binDesigner.cutouts.alignRight" /> | Line up the selection on its left edges, centers or right edges. |
| <Ui k="binDesigner.cutouts.alignTop" />, <Ui k="binDesigner.cutouts.alignCenterV" />, <Ui k="binDesigner.cutouts.alignBottom" /> | Line up the selection on its top edges, centers or bottom edges. |
| <Ui k="binDesigner.cutouts.distributeH" />, <Ui k="binDesigner.cutouts.distributeV" />                                           | Make the spaces equal. They need three or more cutouts.          |
| <Ui k="binDesigner.cutouts.centerInBin" />, <Ui k="binDesigner.cutouts.centerH" />, <Ui k="binDesigner.cutouts.centerV" />       | Center the selection in the bin.                                 |

## Edit several cutouts at once

With two or more cutouts selected, <Ui k="binDesigner.shapeList.tabProperties" /> shows the settings that they share: position, size, rotation, depth, scoop, entry edge and color. When the values differ, the field shows a short dash. Type a value to give it to all selected cutouts.

## Pack cutouts with auto-arrange

Traced a pile of tools at odd angles? Auto-arrange packs them neatly.

1. Select the cutouts. To pack all of them, press <kbd>Ctrl</kbd>+<kbd>A</kbd>.
2. In the toolbar, click <Ui k="binDesigner.cutouts.autoArrange" />.
3. Set the <Ui k="binDesigner.cutouts.gap" /> (it starts at 2 mm), and turn <Ui k="binDesigner.cutouts.staggered" /> and <Ui k="binDesigner.cutouts.turnToFit" /> on or off.
4. Click <Ui k="binDesigner.cutouts.autoArrange" /> in the box.

<Ui k="binDesigner.cutouts.turnToFit" /> is on at the start. It turns each shape to take the least room, so a tool traced at an angle lies square. Groups move as one and keep their angle.

## Bring back a cutout that is off the board

When a cutout goes past the edge of the bin, a warning shows how many cutouts the bin will clip. It offers up to three ways out:

- A button that makes the bin larger to fit the cutouts. It names the new size.
- <Ui k="binDesigner.cutouts.centerInBin" /> moves the cutouts to the middle. It shows only when they fit in the bin.
- <Ui k="binDesigner.cutoutEditor.bringBackIn" /> moves each cutout back inside the edge.

## Measure on the board

Click <Ui k="binDesigner.cutouts.rulerTool" /> (<kbd>M</kbd>) and drag between two points. For a quick measurement with the select tool, hold <kbd>Shift</kbd> and drag. The ruler snaps to corners, edge midpoints, centers and edges, and to the grid when snap is on. The rulers on the top and left edges of the board show millimeters. To measure the 3D model, use <Ui k="binDesigner.measure.short" /> in the preview.

<Screenshot id="cutouts-arranging-ruler" alt="Pressing M for the ruler tool, then dragging from the edge of one cutout to the edge of the next. The ruler snaps to both edges and reads 8.0 mm." spec="Cut editor with two rectangles 8 mm apart, zoomed in on the gap. Press M and drag from the right edge of one rectangle to the left edge of the other so the snap ticks and the distance label show. Crop to the board with the top and left rulers." />

## When it goes wrong

### A repeat won't take another row or column

Move the cutout away from the edge that it is near, or lower the pitch. Then click <Ui k="binDesigner.cutouts.repeat.fillBin" /> again, or type the count.

The copies go toward the far edges of the bin. A cutout near a far edge leaves no room for the next copy, so the count stops, and a note under the settings says so.

### You can't repeat a cutout

<Ui k="binDesigner.cutouts.section.repeat" /> then shows a message in place of its settings. The message gives the reason. Here's what each one asks of you:

| What the cutout is                            | What to do                                                        |
| --------------------------------------------- | ----------------------------------------------------------------- |
| One part of a group                           | Click the group on the board to select all of it, then repeat it. |
| A group with a repeat inside it               | Remove that inner repeat first.                                   |
| A pen shape, a scan or a trace                | Leave it as one cutout. These outlines can't repeat.              |
| A group that holds a pen shape, scan or trace | The group can't repeat either.                                    |

### A group cuts nothing

Pick <Ui k="binDesigner.cutouts.pathfinder.union" /> under <Ui k="binDesigner.cutouts.pathfinder.title" />, or move the shapes until they overlap.

The other three ways to combine shapes can leave no area to cut. <Ui k="binDesigner.cutouts.pathfinder.intersect" /> cuts only where all shapes overlap, so shapes apart from each other leave nothing. A message tells you when the result is empty.

## Next steps

- [Import SVG and STL shapes](./import-svg-stl): bring in outlines and models to arrange.
- [Check before you print](./print-checks): find cutouts that sit too close together.
- [Trace a photo](./photo-trace): add real tools from a photo.
