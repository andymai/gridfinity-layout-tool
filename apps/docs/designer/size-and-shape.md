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
---

# Size and shape

In the Gridfinity Layout Tool, the <Ui k="binDesigner.category.shape" /> page of the bin designer sets the size, outline and body type of a bin. Start here, because all other features fit inside this size.

1. Open the bin designer with the <Ui k="toolSwitcher.binDesigner" /> tab.
2. Select <Ui k="binDesigner.category.shape" /> in the column of icons beside the panel.

## Set the width, depth and height

The <Ui k="binDesigner.dimensions" /> section holds three steppers. A new design is 2 units wide, 2 units deep and 3 units tall.

| Control                  | Unit                     | Range     |
| ------------------------ | ------------------------ | --------- |
| <Ui k="common.width" />  | grid units (42 mm each)  | 0.5 to 16 |
| <Ui k="common.depth" />  | grid units (42 mm each)  | 0.5 to 16 |
| <Ui k="common.height" /> | height units (7 mm each) | 2 to 50   |

A spacer can go down to 1 height unit. The arrow button between the width and depth fields swaps the two values.

Three readouts show the result:

- The line under the width and depth gives the printed body in millimetres, without the stacking lip.
- <Ui k="binDesigner.interiorDimensions" /> gives the space from the floor to the top of the wall, before dividers, scoops and label tabs.
- <Ui k="assembledHeight.title" /> gives the height of the bin on its baseplate. See [Stacking](./stacking#read-the-assembled-height).

<Ui k="binDesigner.extraWallHeight" /> raises the outer walls and the stacking lip up to 100 mm above the bin height. The interior does not change, so tall contents stay inside the rim.

<Screenshot id="designer-size-and-shape-dimensions" alt="The Dimensions section with width, depth, height and the size readouts." spec="Bin designer, Shape page, default 2 x 2 x 3 bin. Show the Dimensions section from its heading to the Half-grid mode toggle. Crop to the panel." />

## Make half-unit sizes

Turn on <Ui k="binDesigner.halfBinMode" /> to change the width and depth in steps of 0.5. When you step down from 1 to 0.5, the designer turns on half-grid mode for you. The smallest bin is 0.5 by 0.5 units.

A side that ends in .5 gets a row of half-size feet at one end. Use <Ui k="sidebar.halfUnitEdgePosition" /> to choose that end:

- For the width, pick <Ui k="sidebar.left" /> or <Ui k="sidebar.right" />.
- For the depth, pick <Ui k="sidebar.bottom" /> or <Ui k="sidebar.top" />.

For a base made only of half-size feet, see [Half sockets](./base#use-half-size-feet).

## Make a bin that is not a rectangle

<Ui k="binDesigner.shape.customShape" /> under <Ui k="binDesigner.shape.section.footprint" /> opens a grid of the footprint. Each cell is one grid unit, or half a unit in half-grid mode.

1. Turn on <Ui k="binDesigner.shape.customShape" />.
2. Click a preset: <Ui k="binDesigner.shape.preset.l" />, <Ui k="binDesigner.shape.preset.t" /> or <Ui k="binDesigner.shape.preset.u" />.
3. Click a cell to remove it. Click it again to add it back.

The L preset needs at least 2 by 2 units. The T and U presets need at least 3 units of width. The shape must stay one piece, so the grid ignores a click that cuts it in two. <Ui k="common.reset" /> makes the footprint a full rectangle again.

Wall patterns, wall cutouts and handles follow your outline. Compartments, label tabs, the finger scoop, overhang, pull tabs and label slots need a rectangle, and their controls say so.

<Screenshot id="designer-size-and-shape-custom-shape" alt="The custom shape grid with an L-shaped footprint beside the 3D preview." spec="Bin designer, Shape page, bin 4 x 3 x 3. Turn on Custom shape and click the L preset. Show the toggle, presets and cell grid, and the preview. Crop to panel plus preview." />

## Pick a body type

The <Ui k="binDesigner.base.bodyType" /> tiles at the bottom of the page decide if the bin has feet, a floor and walls. You can pick one type at a time.

| Body type                                     | What you get                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------- |
| <Ui k="binDesigner.base.bodyType.standard" /> | Feet, floor and walls: the usual Gridfinity bin.                          |
| <Ui k="binDesigner.base.bodyType.nesting" />  | One tapered base that sits in the stacking lip of a bin of the same size. |
| <Ui k="binDesigner.flatFloor" />              | A flat bottom that does not lock into a baseplate.                        |
| <Ui k="binDesigner.spacer" />                 | An open riser with no floor, to lift a short bin level with taller bins.  |
| <Ui k="binDesigner.tile" />                   | Feet and floor with no walls. It still locks into a baseplate.            |
| <Ui k="binDesigner.lidBottom" />              | The underside is a lid, so the bin sits on top of another bin.            |

[The base](./base) explains the options of each type, and [Lids](./lids) explains the lid base. <Ui k="binDesigner.interior.slotted.title" /> and <Ui k="binDesigner.interior.solid.title" /> are interior styles, not body types: see [Compartments and dividers](./compartments).

## Fit a drawer with overhang and taper

A drawer is rarely an exact number of grid units, so a gap stays at its edges. <Ui k="binDesigner.overhang.title" /> grows the walls outward to fill that gap.

1. Turn on <Ui k="binDesigner.overhang.title" /> under <Ui k="binDesigner.shape.section.footprint" />.
2. Set the millimetres for each side, from 0 to 42.
3. Turn on <Ui k="binDesigner.overhang.feet" /> if the overhang is wide.

The feet stay on the grid, so the bottom of the overhang needs supports when you print it. <Ui k="binDesigner.overhang.feet" /> adds feet under the overhang where it is wide enough. On a flat base, the overhang rests on the print bed.

<Ui k="binDesigner.overhang.taper.title" /> angles the wall outward above the base, so the bin reaches into a drawer with curved sides:

- Pick the profile: <Ui k="binDesigner.overhang.taper.profileChamfer" /> or <Ui k="binDesigner.overhang.taper.profileFillet" />.
- Set <Ui k="binDesigner.overhang.taper.bandHeight" />: how far up the wall the taper goes.
- Set <Ui k="binDesigner.overhang.taper.sidesHeading" />: the width the taper adds at the rim, up to 42 mm.

::: warning
Turn off overhang before you add pull tabs, label slots or lip notches. These features do not work with an overhang.
:::

A bin that the layout extends into the drawer margin shows <Ui k="binDesigner.overhang.placement.title" />. It prints with the overhang of the layout, so change it in the layout editor.

## Slant (Experimental)

<Ui k="binDesigner.slant.title" /> has the <Ui k="settings.experimental" /> label. It leans the bin to one side so tall items fit a shallow drawer, and the base stays flat on the grid. [Special bins](../designer/special-bins) explains it.

## Next steps

- [The base](./base): add magnets or screws, and choose the feet and the floor.
- [Walls](./walls): set the wall thickness, patterns, cutouts and handles.
- [Units and sizes](../concepts/units): see how units become millimetres.
- [Compartments and dividers](./compartments): divide the inside of the bin.
