---
title: Gridfinity in five minutes
description: 'Learn the 42 mm grid, the 7 mm height unit, and the parts of a Gridfinity drawer.'
sources:
  - src/shared/printSettings/gridfinityGeometry.ts
  - src/core/constants.ts
  - src/core/baseplateDefaults.ts
  - src/features/bin-designer/constants/defaults.ts
  - src/features/bin-designer/types/base.ts
  - src/shared/utils/heightUnits.ts
  - src/shared/printSettings/baseplateHeight.ts
---

# Gridfinity in five minutes

Gridfinity is an open storage system for 3D printers. Bins sit on a grid plate in a drawer, and each Gridfinity bin fits each Gridfinity plate. This page gives you the few facts that you need before you plan your first drawer.

## Two numbers

Almost all of Gridfinity comes from two sizes.

**The grid unit is 42 mm.** Each bin and each baseplate uses a square grid of 42 × 42 mm cells. One cell is one grid unit. A 2 × 3 bin is 2 grid units wide and 3 grid units deep, which is 84 × 126 mm.

**The height unit is 7 mm.** Bin heights count in height units of 7 mm. The count includes the base of the bin, so the usable depth is one unit less than the height.

| Bin height     | Body height | Usable depth (about) |
| -------------- | ----------- | -------------------- |
| 3 height units | 21 mm       | 14 mm                |
| 4 height units | 28 mm       | 21 mm                |
| 6 height units | 42 mm       | 35 mm                |

Some drawers need a smaller step. A half grid unit is 21 mm. In the Layout Tool, <Ui k="sidebar.halfBinMode" /> lets bins use sizes and positions in steps of 0.5 grid units. Press <kbd>H</kbd> to turn it on or off.

## The parts of a drawer

<Screenshot id="introduction-gridfinity-basics-parts" alt="A bin with a stacking lip that sits on a split baseplate in the 3D preview." spec="Baseplate generator at 1440 px wide, 4 x 3 plate, print bed 100 mm so that the plate splits. Separately, bin designer with a 2 x 1 bin, 4 height units, stacking lip on. Compose or crop one image that shows the plate pattern and a bin with its feet and lip visible, at an angle from the front left." />

**The baseplate** is a flat plate with a raised grid pattern. It sits on the floor of the drawer, and you print it one time. A plate is about 5 mm thick. If the drawer is larger than your print bed, the plate prints in pieces that sit side by side.

**The bin** holds your items. Under the bin, each grid unit has a shaped foot. The feet drop into the baseplate pattern with about 0.5 mm of clearance. Bins stay in place when you open the drawer, and you lift them out when you need them.

**The stacking lip** is the top edge of a standard bin. It has the same shape as the baseplate pattern, so the feet of one bin can sit on top of another bin. The lip adds about 4.4 mm above the bin body. In the bin designer, <Ui k="assembledHeight.stackingLip" /> is on by default.

## Check the drawer height

Before you print tall bins, add up the heights. Your tallest bin plus its lip (about 4.4 mm) must fit under the closed drawer. A plain baseplate adds almost no height, because the feet sit in its pockets. Magnet holes in the plate add the magnet depth plus about 0.6 mm. The layout editor does this check for you when you give it the measured height of the drawer. [Plan your first drawer](../getting-started/first-drawer) shows how.

## Magnets and screws

Magnets are optional. The shape of the feet holds bins well enough in a drawer that opens and closes normally. Add magnets when a drawer gets hard use, or when you want a plate to stay on a steel surface.

| Where               | Option                                  | What it does                                                     |
| ------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| Baseplate generator | <Ui k="baseplate.magnetHoles" />        | Holes in the top of the plate for magnets that hold the bins.    |
| Baseplate generator | <Ui k="baseplate.mountMagnets.label" /> | Holes in the bottom of the plate, so it holds to a steel drawer. |
| Baseplate generator | <Ui k="baseplate.screwHoles.label" />   | Holes to attach the plate to a drawer bottom, a bench or a wall. |
| Bin designer        | <Ui k="binDesigner.base.magnetHoles" /> | Holes in the feet of a bin for magnets.                          |

The default magnet holes suit the common 6 × 2 mm disc magnet. The holes are 6.5 mm wide, so the magnet has some clearance.

## Other grid sizes

The Layout Tool uses 42 mm and 7 mm by default. To use a different grid, change <Ui k="sidebar.gridUnit" /> and <Ui k="sidebar.heightUnit" /> in the <Ui k="common.physicalUnits" /> group of the layout editor sidebar. The grid unit can be 20 to 60 mm, and the height unit can be 3 to 20 mm. <Ui k="settings.resetGridfinityStandard" /> sets both values back to 42 mm and 7 mm.

## Learn more

- [What is Gridfinity?](https://gridfinitylayouttool.com/what-is-gridfinity): how the system works, print settings, and common mistakes
- [Gridfinity sizes](https://gridfinitylayouttool.com/gridfinity-sizes): all sizes in millimeters and inches, and how to convert a drawer to grid units

## Next steps

- [Plan your first drawer](../getting-started/first-drawer): put these numbers to use in the layout editor
- [Units and sizes](../concepts/units): how the Layout Tool converts between grid units, height units and millimeters
- [Gridfinity dimensions](../reference/dimensions): every dimension in one table
