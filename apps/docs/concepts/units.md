---
title: Units and sizes
description: 'Learn how grid units, height units and millimeters relate, and how bins, lips and baseplates add up in height.'
sources:
  - src/core/constants.ts
  - src/shared/printSettings/gridfinityGeometry.ts
  - src/shared/utils/heightUnits.ts
  - src/shared/printSettings/baseplateHeight.ts
  - src/shell/Sidebar/Sidebar.tsx
  - src/features/bin-designer/components/panel/PhysicalUnitsSection/
  - src/core/store/halfGridMode.ts
  - src/shared/generation/gridPitch.ts
---

# Units and sizes

The Gridfinity Layout Tool measures a drawer in two units: the grid unit across the floor and the height unit up from it. This page shows how the units convert to millimeters and how a stack adds up, so you can predict whether it fits in your drawer.

## Grid units and height units

A grid unit is one square cell of the grid. On a standard Gridfinity grid, one grid unit is 42 mm wide and 42 mm deep. A bin of 2 × 3 grid units covers 84 mm × 126 mm of the drawer.

A height unit is 7 mm of height. The count starts at the bottom of the feet, so the first height unit holds the feet and the floor. The space for your items starts above it.

| Size                                   | Millimeters on a standard grid |
| -------------------------------------- | ------------------------------ |
| 1 grid unit, width or depth            | 42                             |
| 1 height unit                          | 7                              |
| Body of a bin that is H units tall     | H × 7                          |
| Inside, from the floor to the wall top | 7 less than the body           |
| Stacking lip on top of the body        | 4.4                            |

For example, a 3-unit bin has a body of 21 mm. The stacking lip adds 4.4 mm, so the bin prints 25.4 mm tall. Items up to 14 mm tall fit below the wall top.

The outer walls of a bin are 0.5 mm smaller than its cells. A 1 × 1 bin measures 41.5 mm, and this gap lets the bin drop into a baseplate. The bin designer shows the space inside the walls as <Ui k="binDesigner.interiorDimensions" />, before dividers, scoops and label tabs.

## Where you set the units

In the layout editor, the <Ui k="common.physicalUnits" /> group in the left panel holds <Ui k="sidebar.gridUnit" />, <Ui k="sidebar.heightUnit" /> and <Ui k="sidebar.printBed" />. The layout editor accepts a grid unit from 20 mm to 60 mm and a height unit from 3 mm to 20 mm. <Ui k="settings.resetGridfinityStandard" /> sets 42 mm and 7 mm again.

The units belong to the layout. The bin designer shows the same grid unit and height unit in the <Ui k="binDesigner.group.finishing" /> group, under <Ui k="common.physicalUnits" />. The baseplate generator shows the same grid unit. When you change a value in one tool, the other tools use the changed value.

To set the grid unit for each layout that you create, open <Ui k="sidebar.settings" />, then <Ui k="settings.tabs.defaults" />, and change <Ui k="settings.defaultGridUnit" />.

<Screenshot id="concepts-units-physical-units" alt="The Physical units group in the layout editor with the grid unit, height unit and print bed fields." spec="Layout editor, desktop, left panel scrolled so the Physical units group is open. Standard values: grid unit 42, height unit 7, print bed 256. Crop to the group and its reset button." />

## Grids that are not 42 mm

Bins and baseplates from other Gridfinity makers use the 42 mm grid. Keep 42 mm if you want your parts to fit theirs. Change the grid unit when you build a system of your own, for example a 21 mm half-pitch grid or a 25 mm mini grid.

The grid unit field has a chain icon. Select the chain to unlink X and Y, then type a different pitch for the depth. A grid that is not square can fill a drawer that is not a multiple of 42 mm. Only the cell pitch stretches. Holes, corner radii, walls and the stacking lip keep their size.

In the bin designer, a separate Y pitch applies to that design only.

On a grid larger than 42 mm, the baseplate generator shows <Ui k="baseplate.magnetAnchor" />. It sets where the magnet holes sit in each cell, for the baseplate, the bins and the lids together.

## Half-grid mode

<Ui k="sidebar.halfBinMode" /> lets bins use sizes and positions in steps of 0.5 grid units. On a standard grid, a half step is 21 mm, so a 1.5 × 2 bin covers 63 mm × 84 mm. Press <kbd>H</kbd> to turn the mode on or off. The Layout Tool keeps your choice in this browser.

Half-grid mode does not change the feet of a bin. A 1.5 × 2 bin still has whole-cell feet, with a half-width foot at one edge. For a denser grid of feet, turn on <Ui k="binDesigner.halfSockets" /> under <Ui k="binDesigner.base.section.feet" /> in the bin designer.

When the drawer width or depth ends in a half unit, <Ui k="sidebar.halfUnitEdgePosition" /> appears. It sets the side that gets the half column (<Ui k="sidebar.left" /> or <Ui k="sidebar.right" />) or the half row (<Ui k="sidebar.bottom" /> or <Ui k="sidebar.top" />).

::: info
You cannot turn off half-grid mode while a bin has a half-unit size or position. The dialog that opens can move those bins to the stash and then turn off the mode.
:::

## How heights add up

The height in a drawer starts at the floor of the drawer and ends at the top of the highest stacking lip.

| Part                        | Height it adds                                    |
| --------------------------- | ------------------------------------------------- |
| Plain baseplate under a bin | About 0.1 mm, because the feet sit in the pockets |
| Baseplate with magnet holes | About 0.6 mm more than the magnet depth           |
| First bin of H units        | H × 7 + 4.4 mm                                    |
| Each bin stacked on top     | H × 7 mm less 0.35 mm                             |

A baseplate with magnet holes has a floor under the magnets, so the bin sits higher. A solid floor under the plate adds its thickness in the same way.

A stacked bin sinks 4.75 mm into the stacking lip below it, which is the full height of its feet. That is why each bin on top adds a little less than its body height. Two 3-unit bins in a stack stand 46.05 mm tall without a baseplate.

Two tools do this arithmetic for you:

- In the layout editor, <Ui k="stackSolver.title" /> under <Ui k="common.physicalUnits" /> lists the tallest bin heights that fit under your measured drawer height.
- In the bin designer, <Ui k="assembledHeight.title" /> under the dimensions shows the height of the bin on a baseplate, with its lid.

::: tip
A layout with <Ui k="baseplate.lowProfileBase" /> turned on in the baseplate generator uses feet that are 1.1 mm shorter. Each bin then gets 1.1 mm more room inside at the same height.
:::

## Next steps

- [Set up the drawer](../layouts/drawer-setup): measure your drawer and turn the size into grid units
- [Size and shape](../designer/size-and-shape): set the width, depth and height of a custom bin
- [Fitting the print bed](./print-bed-fit): see when the Layout Tool splits a part for your printer
- [Gridfinity dimensions](../reference/dimensions): look up every Gridfinity measurement in one table
