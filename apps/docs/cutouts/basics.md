---
title: Cutout basics
description: 'Open the cutout editor, draw a cutout, and set its size, depth, edges, lean, wall opening and label.'
sources:
  - src/features/bin-designer/components/CutoutWorkspace/
  - src/features/bin-designer/components/panel/CutoutsSection/
  - src/features/bin-designer/components/panel/InteriorSection/
  - src/features/bin-designer/types/cutout.ts
  - src/shared/utils/cutoutDepth.ts
  - src/shared/utils/cutoutSplit.ts
---

# Cutout basics

A cutout is a shape that the Gridfinity Layout Tool cuts into the top of a solid bin. Each tool then has its own place. This page shows how to draw a cutout and set its size, depth, edges and label.

## Open the cutout editor

1. Open the [bin designer](https://gridfinitylayouttool.com/designer).
2. Go to the <Ui k="binDesigner.category.interior" /> page.
3. Select <Ui k="binDesigner.interior.solid.title" />.
4. Click <Ui k="binDesigner.editCutouts" />.

The <Ui k="binDesigner.cutoutEditor.title" /> opens beside the 3D preview. The panel on the right has two tabs: <Ui k="binDesigner.shapeList.tabProperties" /> and <Ui k="binDesigner.shapeList.tabShapes" />. Click <Ui k="binDesigner.cutoutEditor.done" /> to close the editor.

::: info
The editor needs a desktop screen. On a phone or a tablet, you can scan a tool into the bin, but you move and change the cutouts on a computer.
:::

<Screenshot id="cutouts-basics-editor" alt="The cutout editor with a board of three cutouts and the Properties tab open." spec="Bin designer on desktop, 3x2 bin, Custom cutouts selected, Cut editor open. Draw one rectangle, one hexagon and one slot. Select the hexagon so the Properties tab shows Transform, Shape and Fit and insertion. Crop to the editor header, toolbar, board and Properties panel." />

## Draw a cutout

Pick a tool in the toolbar, then drag on the board. Hold <kbd>Shift</kbd> to draw a square or a true circle. Hold <kbd>Alt</kbd> to draw out from the center. A click with no drag places a cutout of a standard size.

| Tool                                        | Key          | Use it for                                                                                                      |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.addRectangle" /> | <kbd>R</kbd> | Boxes and flat parts.                                                                                           |
| <Ui k="binDesigner.cutouts.addCircle" />    | <kbd>C</kbd> | Round parts and socket drives.                                                                                  |
| <Ui k="binDesigner.cutouts.addPolygon" />   | <kbd>G</kbd> | Hex bits and Allen keys. It has 3 to 12 sides, and starts with 6.                                               |
| <Ui k="binDesigner.cutouts.addSlot" />      | <kbd>S</kbd> | Tools that lie flat. The ends are fully round.                                                                  |
| <Ui k="binDesigner.cutouts.addKnifeSlot" /> | <kbd>K</kbd> | A blade slot for a knife block.                                                                                 |
| <Ui k="binDesigner.cutouts.penTool" />      | <kbd>P</kbd> | Any outline. Click to add a corner, or click and drag to add a curve. Click the first point to close the shape. |
| <Ui k="binDesigner.cutouts.addText" />      | <kbd>T</kbd> | A caption on the top. It cuts no cavity.                                                                        |

Press <kbd>V</kbd> for <Ui k="binDesigner.cutouts.pointerTool" />. While you draw with the pen, <kbd>Ctrl</kbd>+<kbd>Z</kbd> removes the last point and <kbd>Esc</kbd> stops the shape.

## Set the size and position

Select a cutout and open <Ui k="binDesigner.cutouts.section.transform" />. Type the position, the width, the height and the <Ui k="binDesigner.cutouts.rotation" />. A typed size keeps the center of the cutout where it is. Positions start at the front-left corner of the inside of the bin.

For a polygon or a circle, the <Ui k="binDesigner.cutouts.section.shape" /> section shows <Ui k="binDesigner.cutouts.sizePreset" />, such as a 1/4" hex bit or a 3/8" drive. A polygon size is <Ui k="binDesigner.cutouts.acrossFlats" />, which is the size on a bit or Allen key specification.

The arrow keys move the selection 0.5 mm. <kbd>Shift</kbd> and an arrow key move it 5 mm. To align cutouts to a grid, turn on <Ui k="binDesigner.cutouts.snapToGrid" /> in the toolbar.

## Set the depth

A new cutout is 5 mm deep. Rectangles, circles, polygons, slots and pen shapes also have a <Ui k="binDesigner.cutouts.depthMode" />:

| Mode                                             | What it does                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.depthMode.fixed" />   | Cuts the <Ui k="binDesigner.cutouts.cutDepth" /> that you type, down from the top surface.                                                                                |
| <Ui k="binDesigner.cutouts.depthMode.floor" />   | Keeps a set <Ui k="binDesigner.cutouts.floorMm" /> of plastic under the cutout, measured from the bottom of the bin. The cutout gets deeper when you make the bin taller. |
| <Ui k="binDesigner.cutouts.depthMode.through" /> | Opens the cutout out of the bottom of the bin.                                                                                                                            |

A standard base counts toward the floor, so a <Ui k="binDesigner.cutouts.depthMode.floor" /> cutout never cuts into the base. <Ui k="binDesigner.cutouts.depthMode.through" /> is not available in these conditions:

- The cutout is in a group.
- The cutout has a lean.
- The cutout is beside a tapered wall.
- The bin has detachable feet.

## Shape the top edge and the floor

Open <Ui k="binDesigner.cutouts.section.fit" />:

- <Ui k="binDesigner.cutouts.clearance" /> adds room on each side so a part drops in. It goes from 0 to 5 mm.
- <Ui k="binDesigner.cutouts.entryProfile" /> sets the shape of the top edge. <Ui k="binDesigner.cutouts.entryProfile.chamfer" /> is a 45° bevel that guides bits and sockets in. <Ui k="binDesigner.cutouts.entryProfile.round" /> is a smooth curve for tools that you lift out by hand.

New circles, polygons, slots and pen shapes start with 0.2 mm of clearance and a small chamfer. A rectangle has no clearance setting: it cuts to the size that you set. To find the clearance that suits your printer, see [Fit and tolerances](../printing/fit-and-tolerances).

To round the floor edges, set <Ui k="binDesigner.cutouts.scoopRadius" /> in <Ui k="binDesigner.cutouts.section.shape" />. On a rectangle, select <Ui k="binDesigner.cutouts.scoopSplit" /> to set each direction, and pick the edges that get the curve.

## Lean a cutout off vertical

<Ui k="binDesigner.cutouts.lean" /> tilts the cutout up to 45° in each direction, so an item slides in at a slope. The <Ui k="binDesigner.cutouts.rotation" /> sets the direction of the tilt. The Layout Tool measures the depth along the tilt. Lean is available for rectangles, circles, polygons, slots and pen shapes.

## Open a cutout through a wall

Use <Ui k="binDesigner.cutouts.openSides" /> in <Ui k="binDesigner.cutouts.section.shape" /> when a ruler, a square or a tool handle must slide in from the side. Pick one or more walls. For each wall, set:

- <Ui k="binDesigner.cutouts.openSideWidth" />: the width of the exit. It starts at the full width of the cutout.
- <Ui k="binDesigner.cutouts.openSideForm" />: <Ui k="binDesigner.cutouts.openSideForm.open" /> cuts up through the rim. <Ui k="binDesigner.cutouts.openSideForm.tunnel" /> keeps the wall and the stacking lip above the cutout.

A cutout with a lean, a repeated group and a tapered bin cannot open through a wall.

## Cut one cutout to two depths

Use this for a tool that sits deeper at one end, such as a screwdriver with a thick handle.

1. Select the cutout.
2. In <Ui k="binDesigner.cutouts.section.shape" />, click <Ui k="binDesigner.cutouts.split.add" />.
3. Drag a line across the cutout on the board, from edge to edge.
4. Set <Ui k="binDesigner.cutouts.split.sideBDepth" />.

Side A keeps the depth of the cutout. A split is not available in a group, with a lean, or with a <Ui k="binDesigner.cutouts.depthMode.through" /> cut.

<Screenshot id="cutouts-basics-split" alt="A slot cutout with a split line and the sides marked A and B." spec="Cut editor with one 120 x 25 mm slot. Use Split into two depths and draw a line across the slot at one third of its length. Side B depth 12 mm. Show the board with the A and B marks and the Shape section of Properties. Crop to the board and the Shape section." />

## Add a label

Open <Ui k="binDesigner.cutouts.section.label" /> and type the text, up to 50 characters. To remove the label, clear the text. Pick a <Ui k="binDesigner.cutoutLabelMode" />:

- <Ui k="binDesigner.cutoutLabelMode.engrave" /> cuts the text into the top, or raises it. The depth or height applies to all text in the design.
- <Ui k="binDesigner.cutoutLabelMode.socket" /> cuts a socket for a swappable label plate.

<Ui k="binDesigner.cutoutTextAnchor" /> puts the label above, below, beside or on the cutout. Use <Ui k="binDesigner.cutoutTextOffsetX" /> and <Ui k="binDesigner.cutoutTextOffsetY" />, or drag the label on the board, to move it more.

## Next steps

- [Arrange cutouts](./arranging): repeat, group, align and pack your cutouts.
- [Import SVG and STL shapes](./import-svg-stl): bring in a shape from another app.
- [Check before you print](./print-checks): find thin walls and test the fit.
- [Swappable label plates](../designer/label-plates#add-sockets-on-cutout-bins): print the plates for a socket label.
- [Special bins](../designer/special-bins#make-a-knife-block): build a knife block with knife slots.
