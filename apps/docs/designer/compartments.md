---
title: Compartments and dividers
description: 'Divide a bin into compartments with fixed, diagonal, leaning or removable dividers, and raise the floor of a compartment.'
sources:
  - src/features/bin-designer/components/panel/InteriorSection/
  - src/features/bin-designer/components/CompartmentEditor/
  - src/features/bin-designer/components/SlotConfigurator/
  - src/features/bin-designer/components/BentoWorkspace/
  - src/features/bin-designer/types/compartments.ts
  - src/features/bin-designer/types/dividers.ts
  - src/features/bin-designer/utils/dividerAngle.ts
---

# Compartments and dividers

Dividers split a bin of the Gridfinity Layout Tool into compartments, so small parts do not mix. You can print the dividers with the bin, tilt them, or print them as removable pieces.

The controls are on the <Ui k="binDesigner.category.interior" /> page of the bin designer. Pick one of four interior styles there:

| Style                                          | What you get                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| <Ui k="binDesigner.interior.standard.title" /> | A grid of compartments with fixed walls. Merge cells for larger compartments.              |
| <Ui k="binDesigner.interior.bento.title" />    | Compartments of any size that you draw on a canvas.                                        |
| <Ui k="binDesigner.interior.slotted.title" />  | Slots in the walls, and separate divider pieces that you push into them.                   |
| <Ui k="binDesigner.interior.solid.title" />    | A solid bin with pockets cut in the shape of your tools. See [Cutouts](../cutouts/basics). |

The first three styles need a rectangular footprint.

## Set up the compartment grid

1. Pick <Ui k="binDesigner.interior.standard.title" />.
2. Set <Ui k="binDesigner.columns" /> and <Ui k="binDesigner.rows" />, from 1 to 12 each.
3. Read the size of the smallest compartment under the steppers.

To start from a size, open <Ui k="binDesigner.compartmentEditor.setBySize" /> and type the smallest opening you need in millimetres. The designer picks the largest number of columns and rows that keeps every compartment at that size or larger. The compartments at the edges can be wider.

With two or more compartments, two more controls appear:

- <Ui k="binDesigner.dividerThickness" />: the same values as the wall thickness, from 0.4 to 2.6 mm.
- <Ui k="binDesigner.dividerHeight" />: <Ui k="binDesigner.dividerAutoHeight" /> or a height in millimetres. With the stacking lip on, <Ui k="binDesigner.dividerAutoHeight" /> stops just below the feet of a bin stacked on top.

A compartment cannot be smaller than 5 mm. When you change the grid, the designer moves compartment labels by position and tells you if it clears some.

## Merge and split compartments

1. Drag across two or more cells to select them.
2. Release to merge them into one compartment.
3. Click a merged compartment to split it again.

A merged compartment is always a rectangle. <Ui k="common.reset" /> above the grid sets all compartments back to a uniform grid.

<Screenshot id="designer-compartments-grid" alt="The compartment grid editor with 4 columns, 3 rows and two merged cells, beside the 3D preview." spec="Bin designer, Interior page, bin 4 x 3 x 6. Pick Grid dividers, set Columns 4 and Rows 3, then drag across the two top-left cells to merge them. Show the steppers, the grid and the preview. Crop to panel plus preview." />

## Tilt and lean dividers

<Ui k="binDesigner.angledDividers.title" /> makes wedge-shaped compartments, for example for cutlery that gets narrower at one end. The toggle is under the compartment grid.

1. Turn on <Ui k="binDesigner.angledDividers.title" />.
2. Click a divider on the grid, or pick it in the list.
3. Set <Ui k="binDesigner.angledDividers.angleLabel" /> to turn the divider in plan, up to 60°.
4. Set <Ui k="binDesigner.angledDividers.leanLabel" /> to stand the divider over, so contents rest at a slope.

The lean has a limit for each compartment, and the panel shows it with the clear opening. <Ui k="binDesigner.angledDividers.applyLeanToAxis" /> copies the lean to the other dividers that run the same way. <Ui k="binDesigner.angledDividers.fineTune" /> holds a <Ui k="binDesigner.angledDividers.shiftLabel" /> control that moves the divider. <Ui k="binDesigner.angledDividers.resetToStraight" /> undoes the tilt.

::: warning
Look at your scoops and label tabs after you tilt a divider. The designer removes scoops, label tabs and inserts along a tilted divider.
:::

## Draw compartments with Bento

Bento gives you a large canvas where you draw each compartment. It needs a wide screen. On a small screen, the card shows the grid editor of <Ui k="binDesigner.interior.standard.title" /> instead.

1. Pick <Ui k="binDesigner.interior.bento.title" /> and click <Ui k="binDesigner.openBentoWorkspace" />.
2. On an empty canvas, choose the drawing grid. Compartments snap to it.
3. Drag on the canvas to draw a compartment.
4. Drag a compartment to move it, or pull its handles to change its size.

Some more actions:

- Shift-click a second compartment that touches the first to fuse them into one L, S or U shape.
- Alt-drag a compartment to make a copy.
- Drop a compartment on the <Ui k="binDesigner.bento.stashTitle" /> shelf to keep it for later. The shelf holds up to 36 compartments.
- Use <Ui k="binDesigner.bento.wallsTitle" /> in the compartment panel to shift or turn a wall between two compartments.

Each empty cell prints as its own small pocket. Turn on <Ui k="binDesigner.bento.mergeBackground" /> to make one pocket from each open area instead.

<Screenshot id="designer-compartments-bento" alt="The Bento workspace with five drawn compartments of different sizes and the compartment panel open." spec="Bin designer on a desktop window, Interior page, bin 4 x 3 x 6. Pick Bento and open the Bento workspace. Draw five compartments of different sizes, including one L shape. Select one compartment so the compartment panel shows its Floor raise. Capture the full workspace." />

## Raise a compartment floor

<Ui k="binDesigner.bento.floorRaise" /> lifts the floor of one compartment. A short item then sits nearer the rim, and it is easier to pick out. Tall items in other compartments keep the full depth.

1. In the Bento workspace, select a compartment.
2. Drag <Ui k="binDesigner.bento.floorRaise" /> to the height you need, in millimetres.

The raised floor is solid, and the infill of your slicer keeps it light. The designer keeps at least 3 mm of pocket above the raised floor. A finger scoop climbs from the raised floor. For a <Ui k="binDesigner.interior.standard.title" /> bin, pick <Ui k="binDesigner.interior.bento.title" />: the compartments stay the same, and you get the same control.

## Use removable dividers

<Ui k="binDesigner.interior.slotted.title" /> cuts slots into the walls. The divider pieces print separately and slide into the slots, so you can move them later. The export includes the pieces, and an STL export with pieces downloads as a ZIP file.

1. Pick <Ui k="binDesigner.interior.slotted.title" />.
2. Under <Ui k="binDesigner.slotLayout" />, pick <Ui k="binDesigner.slotLayoutEven" />.
3. Pick a <Ui k="binDesigner.slotDirection" />: <Ui k="binDesigner.slotVertical" />, <Ui k="binDesigner.slotHorizontal" /> or <Ui k="binDesigner.slotBoth" />.
4. Set <Ui k="binDesigner.slotSpacing" />, from 10 to 50 mm.
5. Set the height, thickness and fit of the pieces.

The divider pieces have these controls:

| Control                                   | Range or default                                                        |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| <Ui k="binDesigner.dividerHeight" />      | <Ui k="binDesigner.dividerAutoHeight" />, or 5 mm up to the auto height |
| <Ui k="binDesigner.dividerThickness" />   | 0.8 to 2.4 mm, default 1.6 mm                                           |
| <Ui k="binDesigner.dividerClearance" />   | 0 to 0.3 mm, default 0.25 mm. Use more for a looser fit.                |
| <Ui k="binDesigner.dividerFloorGroove" /> | On by default: a 0.8 mm channel in the floor holds the bottom edge.     |

<Ui k="binDesigner.slotLayoutCustom" /> lets you draw your own grid with <Ui k="binDesigner.customMerge" /> and <Ui k="binDesigner.customSplit" />. The designer then makes pieces that match the grid you drew.

The walls must be 0.8 mm or thicker for slots. Removable dividers turn off the compartment grid, label tabs, the finger scoop and the interior fillet. You cannot use them with tilted dividers or a <Ui k="binDesigner.base.bodyType.nesting" /> body.

### Interlock cross dividers

When you pick <Ui k="binDesigner.slotBoth" />, <Ui k="binDesigner.slotCrossStyle" /> sets how the two sets of pieces meet:

- <Ui k="binDesigner.slotCrossLap" />: full-length pieces in both directions with notches that lock them together.
- <Ui k="binDesigner.slotCrossInsert" />: full-length pieces in one direction, with short pieces between them. Pick the long direction in <Ui k="binDesigner.slotLongDirection" />. Use a divider of 1.2 mm or thicker.

With interlocking pieces, <Ui k="binDesigner.slotPartialStyle" /> gives shorter pieces too:

- <Ui k="binDesigner.slotPartialFull" />: one wall-to-wall piece for each slot.
- <Ui k="binDesigner.slotPartialSnappable" />: each piece has score lines, so you can snap it to length. Use a divider of 1 mm or thicker.
- <Ui k="binDesigner.slotPartialLengthSet" />: a set of pieces that span one or more compartments, each with the correct notches.

## Next steps

- [Scoops, fillets and pull tabs](./getting-things-out): make each compartment easy to empty.
- [Labels and text](./labels-and-text): put a label on each compartment.
- [Cutouts](../cutouts/basics): cut pockets in the shape of your tools.
- [Walls](./walls#choose-which-walls-get-the-pattern): put a pattern on the dividers.
