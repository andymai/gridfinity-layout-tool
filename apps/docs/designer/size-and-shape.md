---
title: Size and shape
description: 'Set the size, outline and body type of a custom bin, and fit it to your drawer.'
sources:
  - src/features/bin-designer/components/panel/DimensionsSection/
  - src/features/bin-designer/components/panel/ShapeSection/
  - src/features/bin-designer/components/panel/OverhangSection/
  - src/features/bin-designer/components/panel/BaseSection/bodyType.ts
  - src/features/bin-designer/components/panel/BaseSection/BodyTypeTiles.tsx
  - src/features/bin-designer/constants/gridfinity.ts
  - src/shared/utils/cellMask.ts
  - src/features/bin-designer/components/DesignerPage/useFractionalEdgeMismatch.ts
  - src/features/bin-designer/components/ExportDialog/ExportDialog.tsx
---

# Size and shape

Every custom bin starts here. Set how big it is, give it an odd outline if your drawer needs one, and stretch it into the gaps at the drawer edges. All the other features of the Gridfinity Layout Tool fit inside this size, so it pays to get it right first.

1. Open the bin designer with the <Ui k="toolSwitcher.binDesigner" /> tab.
2. Find the <Ui k="binDesigner.group.shape" /> group at the top of the panel.

Every group of the panel starts open. Click a group title to fold the group away. A small dot next to a title marks a group with changes. Hover over the dot to read <Ui k="binDesigner.group.modified" />.

## Set the width, depth and height

The <Ui k="binDesigner.dimensions" /> section holds three steppers. A new design is 2 units wide, 2 units deep and 3 units tall.

| Control                  | Unit                     | Range     |
| ------------------------ | ------------------------ | --------- |
| <Ui k="common.width" />  | grid units (42 mm each)  | 0.5 to 16 |
| <Ui k="common.depth" />  | grid units (42 mm each)  | 0.5 to 16 |
| <Ui k="common.height" /> | height units (7 mm each) | 2 to 50   |

A spacer can go down to 1 height unit. Built it the wrong way round? The arrow button between the width and depth fields swaps the two values.

Three readouts show what you get:

- The line under the width and depth gives the printed body in millimeters, without the stacking lip.
- <Ui k="binDesigner.interiorDimensions" /> gives the space from the floor to the top of the wall, before dividers, scoops and label tabs.
- <Ui k="assembledHeight.title" /> gives the height of the bin on its baseplate. See [Stacking](./stacking#read-the-assembled-height).

Some contents stand taller than the bin, like brushes or pens. <Ui k="binDesigner.extraWallHeight" /> raises the outer walls and the stacking lip up to 100 mm above the bin height. The interior doesn't change, so tall contents stay inside the rim.

<Screenshot id="designer-size-and-shape-dimensions" alt="The Dimensions section with width, depth, height and the size readouts." spec="Bin designer, Shape group open, default 2 x 2 x 3 bin. Show the Dimensions section from its heading to the Half-grid mode toggle. Crop to the panel." />

::: tip
Print one bin before you print twenty. A small test shows you how the size feels in your drawer and on your baseplate.
:::

## Make half-unit sizes

Turn on <Ui k="binDesigner.halfBinMode" /> to change the width and depth in steps of 0.5. When you step down from 1 to 0.5, the bin designer turns on half-grid mode for you. The smallest bin is 0.5 by 0.5 units.

A side that ends in .5 gets a row of half-size feet at one end. Use <Ui k="sidebar.halfUnitEdgePosition" /> to choose that end:

- For the width, pick <Ui k="sidebar.left" /> or <Ui k="sidebar.right" />.
- For the depth, pick <Ui k="sidebar.bottom" /> or <Ui k="sidebar.top" />.

<Screenshot id="designer-size-and-shape-half-grid" alt="Half-grid mode turns on. The width steps down from 2 to 1.5, and the Half-unit edge position choice appears under the size readouts. Left moves the half-size feet to the left end. A view from below shows the row of smaller feet." spec="Bin designer, bin 2 x 2 x 3. In close-up, turn on Half-grid mode. Then step the width down to 1.5 and pick Left under Half-unit edge position. Then show the bin from below." />

For a base made only of half-size feet, see [Half sockets](./base#use-half-size-feet).

## Make a bin that is not a rectangle

Need a bin that wraps around a drawer post, or fills an L-shaped corner? <Ui k="binDesigner.shape.customShape" />, under <Ui k="binDesigner.shape.section.footprint" />, opens a grid of the footprint. Each cell is one grid unit, or half a unit in half-grid mode.

1. Turn on <Ui k="binDesigner.shape.customShape" />.
2. To start from a common shape, click a preset.
3. Click a cell to remove it. Click it again to add it back.

The <Ui k="binDesigner.shape.preset.l" /> preset needs at least 2 by 2 units. The <Ui k="binDesigner.shape.preset.t" /> and <Ui k="binDesigner.shape.preset.u" /> presets need at least 3 units of width. The shape must stay one piece, so the grid ignores a click that cuts it in two. <Ui k="common.reset" /> makes the footprint a full rectangle again.

Wall patterns, wall cutouts and handles follow your outline. Compartments, label tabs, the finger scoop, overhang, pull tabs and label slots need a rectangle, and their controls tell you so.

<Screenshot id="designer-size-and-shape-custom-shape" alt="Turning on Custom shape shows the presets and the cell grid. The L preset clears two cells in one corner, and the preview shows the L-shaped bin." spec="Bin designer, Shape group open, bin 4 x 2 x 3. Turn on Custom shape and click the L preset in close-up, then show the bin in the preview." />

## Pick a body type

The <Ui k="binDesigner.base.bodyType" /> tiles at the top of the <Ui k="binDesigner.group.base" /> group decide if the bin has feet, a floor and walls. You can pick one type at a time. Not sure? Keep <Ui k="binDesigner.base.bodyType.standard" />.

| Body type                                     | What you get                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| <Ui k="binDesigner.base.bodyType.standard" /> | Feet, floor and walls: the usual Gridfinity bin.                          |
| <Ui k="binDesigner.base.bodyType.nesting" />  | One tapered base that sits in the stacking lip of a bin of the same size. |
| <Ui k="binDesigner.flatFloor" />              | A flat bottom that does not lock into a baseplate.                        |
| <Ui k="binDesigner.spacer" />                 | An open riser with no floor, to lift a short bin level with taller bins.  |
| <Ui k="binDesigner.tile" />                   | Feet and floor with no walls. It still locks into a baseplate.            |
| <Ui k="binDesigner.lidBottom" />              | The underside is a lid, so the bin sits on top of another bin.            |

<Screenshot id="designer-size-and-shape-body-type" alt="The six Body type tiles: Standard, Nesting, Flat base, Spacer, Base only and Lid base. Standard is selected, and the line under the tiles describes it." spec="Bin designer, default bin. Crop the Base group from the Body type heading to the description line under the tiles." />

[The base](./base) explains the options of each type, and [Lids](./lids) explains the lid base. <Ui k="binDesigner.interior.slotted.title" /> and <Ui k="binDesigner.interior.solid.title" /> are interior styles, not body types: see [Compartments and dividers](./compartments).

## Fit a drawer with overhang and taper

A drawer is rarely an exact number of grid units, so a gap stays at its edges. <Ui k="binDesigner.overhang.title" /> grows the walls outward to fill that gap.

1. Under <Ui k="binDesigner.shape.section.footprint" />, turn on <Ui k="binDesigner.overhang.title" />.
2. Set the millimeters for each side, from 0 to 42.
3. If the overhang is wide, turn on <Ui k="binDesigner.overhang.feet" />.

The feet stay on the grid, so the bottom of the overhang needs supports when you print it. <Ui k="binDesigner.overhang.feet" /> adds feet under the overhang where it is wide enough. On a flat base, the overhang rests on the print bed.

<Screenshot id="designer-size-and-shape-overhang" alt="Overhang turns on and shows a slider for each side. Typing 21 for the right side grows the wall outward on the right. Then Feet under overhang turns on, and a view from below shows feet under the overhang." spec="Bin designer, bin 2 x 2 x 3. In close-up, turn on Overhang and type 21 mm for the right side, then show the bin. Turn on Feet under overhang, then show the bin from below." />

For a drawer with curved sides, <Ui k="binDesigner.overhang.taper.title" /> angles the wall outward above the base:

- Pick the profile: <Ui k="binDesigner.overhang.taper.profileChamfer" /> or <Ui k="binDesigner.overhang.taper.profileFillet" />.
- Set <Ui k="binDesigner.overhang.taper.bandHeight" />: how far up the wall the taper goes.
- Set <Ui k="binDesigner.overhang.taper.sidesHeading" />: the width the taper adds at the rim, up to 42 mm.

::: warning
Turn off overhang before you add pull tabs, label slots or lip notches. These features do not work with an overhang.
:::

A bin that the layout extends into the drawer margin shows <Ui k="binDesigner.overhang.placement.title" />. It prints with the overhang of the layout, so change it in the layout editor.

## Slant (Experimental)

<Ui k="binDesigner.slant.title" /> is also in the <Ui k="binDesigner.group.shape" /> group. It has the <Ui k="settings.experimental" /> label. It leans the bin to one side so tall items fit a shallow drawer, and the base stays flat on the grid. [Special bins](../designer/special-bins) explains it.

## When it goes wrong

### A banner says the half-unit foot is on the wrong edge

Click <Ui k="binDesigner.fractionalEdgeMatchDrawer" /> in the banner. The bin designer moves the half-size feet to the edge where the bin sits in your drawer.

The banner shows when a bin in the active layout uses this design, and that bin has its half-size feet on the other edge. See [Make half-unit sizes](#make-half-unit-sizes).

### A feature turns off after you change the outline

Read the note at the greyed-out control. It tells you what blocks it. To get the feature back, click <Ui k="common.reset" /> under <Ui k="binDesigner.shape.customShape" />, or turn off the overhang.

Compartments, label tabs, the finger scoop, overhang, pull tabs, label slots and lip notches need a rectangular footprint. Pull tabs, label slots and lip notches also need a bin with no overhang.

### The bin is too large for your print bed

Keep <Ui k="binDesigner.splitExport.enableSplit" /> on in the export dialog. You get a ZIP file with one file for each piece. To print the bin in one piece, make it smaller.

The export dialog checks the bin against the print bed size of your layout. Is that size wrong? Change it under <Ui k="common.physicalUnits" /> in the <Ui k="binDesigner.group.finishing" /> group. If the bin fits only at an angle, the dialog tells you to turn it in your slicer. [Fitting the print bed](../concepts/print-bed-fit#when-a-bin-is-too-large) explains the check.

## Next steps

- [The base](./base): add magnets or screws, and choose the feet and the floor.
- [Walls](./walls): set the wall thickness, patterns, cutouts and handles.
- [Units and sizes](../concepts/units): see how units become millimeters.
- [Compartments and dividers](./compartments): divide the inside of the bin.
