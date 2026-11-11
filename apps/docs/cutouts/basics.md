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

Give every tool its own spot. A cutout is a pocket shaped like a tool, which the Gridfinity Layout Tool cuts into the top of a solid bin. Draw one here, then set its size, depth, edges and label.

## Open the cutout editor

1. Open the [bin designer](https://gridfinitylayouttool.com/designer).
2. In the <Ui k="binDesigner.group.interior" /> group, select <Ui k="binDesigner.interior.solid.title" />.
3. Click <Ui k="binDesigner.editCutouts" />.

The <Ui k="binDesigner.cutoutEditor.title" /> opens beside the 3D preview. The panel on the right has two tabs: <Ui k="binDesigner.shapeList.tabProperties" /> and <Ui k="binDesigner.shapeList.tabShapes" />. When you finish, click <Ui k="binDesigner.cutoutEditor.done" /> to close the editor.

::: info
The editor needs a desktop screen. On a phone or a tablet, you can scan a tool into the bin, but you move and change the cutouts on a computer.
:::

<Screenshot id="cutouts-basics-editor" alt="The cutout editor with a board of three cutouts and the Properties tab open." spec="Bin designer on desktop, 3x2 bin, Custom cutouts selected, Cut editor open. Draw one rectangle, one hexagon and one slot. Select the hexagon so the Properties tab shows Transform and Shape. Crop to the editor header, toolbar, board and Properties panel." />

## Draw a cutout

Pick a tool in the toolbar, then drag on the board. Hold <kbd>Shift</kbd> for a square or a true circle, and hold <kbd>Alt</kbd> to draw out from the center. Want a quick shape? Click without a drag, and you get a cutout of a standard size.

| Tool                                        | Key          | Use it for                                                                                                      |
| ------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.addRectangle" /> | <kbd>R</kbd> | Boxes and flat parts.                                                                                           |
| <Ui k="binDesigner.cutouts.addCircle" />    | <kbd>C</kbd> | Round parts and socket drives.                                                                                  |
| <Ui k="binDesigner.cutouts.addPolygon" />   | <kbd>G</kbd> | Hex bits and Allen keys. It has 3 to 12 sides, and starts with 6.                                               |
| <Ui k="binDesigner.cutouts.addSlot" />      | <kbd>S</kbd> | Tools that lie flat. The ends are fully round.                                                                  |
| <Ui k="binDesigner.cutouts.addKnifeSlot" /> | <kbd>K</kbd> | A blade slot for a knife block.                                                                                 |
| <Ui k="binDesigner.cutouts.penTool" />      | <kbd>P</kbd> | Any outline. Click to add a corner, or click and drag to add a curve. Click the first point to close the shape. |
| <Ui k="binDesigner.cutouts.addText" />      | <kbd>T</kbd> | A caption on the top. It cuts no cavity.                                                                        |

Press <kbd>V</kbd> to go back to <Ui k="binDesigner.cutouts.pointerTool" />. While you draw with the pen, <kbd>Ctrl</kbd>+<kbd>Z</kbd> removes the last point and <kbd>Esc</kbd> stops the shape.

## Set the size and position

Select a cutout and open <Ui k="binDesigner.cutouts.section.transform" />. Type the position, the width, the height and the <Ui k="binDesigner.cutouts.rotation" />. A typed size keeps the center of the cutout where it is. Positions start at the front-left corner of the inside of the bin.

Cutting for standard hardware? For a polygon or a circle, the <Ui k="binDesigner.cutouts.section.shape" /> section shows <Ui k="binDesigner.cutouts.sizePreset" />, such as a 1/4" hex bit or a 3/8" drive. A polygon size is <Ui k="binDesigner.cutouts.acrossFlats" />, which is the size on a bit or Allen key specification.

To nudge a cutout, use the arrow keys: each press moves it 0.5 mm, or 5 mm with <kbd>Shift</kbd>. To line cutouts up on a grid, turn on <Ui k="binDesigner.cutouts.snapToGrid" /> in the toolbar.

## Set the depth

A new cutout is 5 mm deep. Rectangles, circles, polygons, slots and pen shapes also have a <Ui k="binDesigner.cutouts.depthMode" />:

| Mode                                             | What it does                                                                                                                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.depthMode.fixed" />   | Cuts the <Ui k="binDesigner.cutouts.cutDepth" /> that you type, down from the top surface.                                                                                |
| <Ui k="binDesigner.cutouts.depthMode.floor" />   | Keeps a set <Ui k="binDesigner.cutouts.floorMm" /> of plastic under the cutout, measured from the bottom of the bin. The cutout gets deeper when you make the bin taller. |
| <Ui k="binDesigner.cutouts.depthMode.through" /> | Opens the cutout out of the bottom of the bin.                                                                                                                            |

A standard base counts toward the floor, so a <Ui k="binDesigner.cutouts.depthMode.floor" /> cutout never cuts into the base. <Ui k="binDesigner.cutouts.depthMode.through" /> isn't available in these cases:

- The cutout is in a group.
- The cutout has a lean.
- The cutout is beside a tapered wall.
- The bin has detachable feet.

## Shape the top edge and the floor

Open <Ui k="binDesigner.cutouts.section.fit" />:

- <Ui k="binDesigner.cutouts.clearance" /> adds room on each side so a part drops in. It goes from 0 to 5 mm.
- <Ui k="binDesigner.cutouts.entryProfile" /> sets the shape of the top edge. <Ui k="binDesigner.cutouts.entryProfile.chamfer" /> is a 45° bevel that guides bits and sockets in. <Ui k="binDesigner.cutouts.entryProfile.round" /> is a smooth curve for tools that you lift out by hand.

New circles, polygons, slots and pen shapes start with 0.2 mm of clearance and a small chamfer. Not sure? Keep that start, and [print a fit test](./print-checks#print-a-fit-test) before the whole bin. A rectangle has no clearance setting: it cuts to the size that you set. To find the clearance that suits your printer, see [Fit and tolerances](../printing/fit-and-tolerances).

To round the floor edges, set <Ui k="binDesigner.cutouts.scoopRadius" /> in <Ui k="binDesigner.cutouts.section.shape" />. On a rectangle, select <Ui k="binDesigner.cutouts.scoopSplit" /> to set each direction, and pick the edges that get the curve.

## Lean a cutout off vertical

<Ui k="binDesigner.cutouts.lean" /> tilts the cutout up to 45° in each direction, so an item slides in at a slope. The <Ui k="binDesigner.cutouts.rotation" /> sets the direction of the tilt. The Layout Tool measures the depth along the tilt. Lean works on rectangles, circles, polygons, slots and pen shapes.

## Open a cutout through a wall

Need a ruler, a square or a tool handle to slide in from the side? Use <Ui k="binDesigner.cutouts.openSides" /> in <Ui k="binDesigner.cutouts.section.shape" />. Pick one or more walls. For each wall, set:

- <Ui k="binDesigner.cutouts.openSideWidth" />: the width of the exit. It starts at the full width of the cutout.
- <Ui k="binDesigner.cutouts.openSideForm" />: <Ui k="binDesigner.cutouts.openSideForm.open" /> cuts up through the rim. <Ui k="binDesigner.cutouts.openSideForm.tunnel" /> keeps the wall and the stacking lip above the cutout.

A wall opening isn't available on a leaned cutout, in a repeated group, or on a tapered bin.

## Cut one cutout to two depths

Some tools sit deeper at one end, such as a screwdriver with a thick handle. Give that end a deeper floor:

1. Select the cutout.
2. In <Ui k="binDesigner.cutouts.section.shape" />, click <Ui k="binDesigner.cutouts.split.add" />.
3. Drag a line across the cutout on the board, from edge to edge.
4. Set <Ui k="binDesigner.cutouts.split.sideBDepth" />.

Side A keeps the depth of the cutout. A split isn't available in a group, with a lean, or with a <Ui k="binDesigner.cutouts.depthMode.through" /> cut.

<Screenshot id="cutouts-basics-split" alt="Clicking Split into two depths, then dragging a line across a slot at one third of its length. The board marks the sides A and B. Side B depth is set to 12 mm, and the 3D preview shows the deeper end." spec="Cut editor, 3 x 1 bin, 5 height units, one 110 x 24 mm slot. In close-up, click Split into two depths, drag a line across the slot at one third of its length, and set Side B depth to 12 mm. End on the 3D preview." />

## Add a label

Open <Ui k="binDesigner.cutouts.section.label" /> and type the text, up to 50 characters. To remove the label, clear the text. Then pick a <Ui k="binDesigner.cutoutLabelMode" />:

- <Ui k="binDesigner.cutoutLabelMode.engrave" /> cuts the text into the top, or raises it. The depth or height applies to all text in the design.
- <Ui k="binDesigner.cutoutLabelMode.socket" /> cuts a socket for a swappable label plate.

<Ui k="binDesigner.cutoutTextAnchor" /> puts the label above, below, beside or on the cutout. To move it more, drag the label on the board, or use <Ui k="binDesigner.cutoutTextOffsetX" /> and <Ui k="binDesigner.cutoutTextOffsetY" />.

## Next steps

- [Arrange cutouts](./arranging): repeat, group, align and pack your cutouts.
- [Import SVG and STL shapes](./import-svg-stl): bring in a shape from another app.
- [Check before you print](./print-checks): find thin walls and test the fit.
- [Swappable label plates](../designer/label-plates#add-sockets-on-cutout-bins): print the plates for a socket label.
- [Special bins](../designer/special-bins#make-a-knife-block): build a knife block with knife slots.
