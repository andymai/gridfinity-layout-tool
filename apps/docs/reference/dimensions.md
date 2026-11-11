---
title: Gridfinity dimensions
description: 'Look up the measurements of the grid, the height unit, the base and lip profiles, magnets, screws and clearances.'
sources:
  - src/shared/printSettings/gridfinityGeometry.ts
  - src/shared/generation/generatorConstants.ts
  - src/core/constants.ts
  - src/features/bin-designer/constants/gridfinity.ts
  - src/features/bin-designer/constants/defaults.ts
  - src/core/baseplateDefaults.ts
---

# Gridfinity dimensions

This page lists the measurements that the Gridfinity Layout Tool builds bins and baseplates to. Use it to compare a part with another Gridfinity model, or to measure a printed part when it does not fit. All values are in millimeters unless a row says otherwise.

For size tables in inches and a list of common bin sizes, see [Gridfinity sizes](https://gridfinitylayouttool.com/gridfinity-sizes).

## Grid and height units

| Measurement       | Value                 | Range in the app |
| ----------------- | --------------------- | ---------------- |
| Grid unit (pitch) | 42 mm                 | 20 to 60 mm      |
| Height unit       | 7 mm                  | 3 to 20 mm       |
| Half-grid step    | 0.5 grid unit (21 mm) |                  |
| Print bed size    | 256 mm (default)      | 42 to 3000 mm    |

Change the grid unit or the height unit only if your other parts use a size that is not standard. A layout can also have a different grid unit from front to back, for a grid that is not square.

## Bin size

| Measurement                         | Value                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Outer width and depth               | Grid units × 42 mm, minus 0.5 mm. A 1 × 1 bin is 41.5 mm wide.          |
| Height                              | Height units × 7 mm, from the bottom of the feet to the top of the wall |
| Stacking lip                        | Rises above the wall top. It is not in the height.                      |
| Wall thickness                      | 1.2 mm (default), 0.4 to 2.4 mm                                         |
| Divider thickness                   | 1.2 mm (default), 0.4 to 2.4 mm                                         |
| Width and depth in the bin designer | 0.5 to 16 grid units, in steps of 0.5                                   |
| Height in the bin designer          | 2 to 50 height units. A spacer can be 1.                                |
| Drawer size in a layout             | 0.5 to 50 grid units                                                    |

For example, a 2 × 3 bin with a height of 6 units is 83.5 mm × 125.5 mm. Its wall top is 42 mm high.

## Base profile

Each grid cell under a bin has one foot. The foot is a tapered block that drops into a pocket of the baseplate.

| Part of the foot                  | Value   |
| --------------------------------- | ------- |
| Total foot height                 | 4.75 mm |
| Bottom chamfer (45 degrees)       | 0.8 mm  |
| Straight middle band              | 1.8 mm  |
| Top chamfer (45 degrees)          | 2.15 mm |
| Inset at the underside, each side | 2.95 mm |
| Corner radius                     | 3.75 mm |

## Baseplate pocket profile

| Part of the pocket                   | Value   |
| ------------------------------------ | ------- |
| Total pocket depth                   | 4.65 mm |
| Bottom chamfer (45 degrees)          | 0.7 mm  |
| Straight middle band                 | 1.8 mm  |
| Top chamfer (45 degrees)             | 2.15 mm |
| Inset at the pocket floor, each side | 2.85 mm |
| Corner radius                        | 4 mm    |

The pocket is 0.1 mm shallower than the foot. A bin rests on the pocket floor, and its tapered sides stay clear of the pocket walls.

A low-profile base removes 1.1 mm from the straight middle band of the foot and of the pocket. The bin then has 1.1 mm more room inside at the same height. Standard bins still fit a low-profile plate with less grip, and low-profile bins still fit a standard plate.

## Stacking lip

| Part of the lip             | Value  |
| --------------------------- | ------ |
| Total lip height            | 4.4 mm |
| Bottom chamfer (45 degrees) | 0.7 mm |
| Straight band               | 1.8 mm |
| Top chamfer (45 degrees)    | 1.9 mm |
| Inset from the outer wall   | 2.6 mm |

## Magnets and screws

| Hole                                   | Default                                                           | Range                           |
| -------------------------------------- | ----------------------------------------------------------------- | ------------------------------- |
| Magnet hole in a bin                   | 6.5 mm wide, 2 mm deep                                            | 4 to 10 mm wide, 1 to 4 mm deep |
| Magnet hole in a baseplate             | 6.5 mm wide, 2 mm deep                                            | 4 to 10 mm wide, 1 to 4 mm deep |
| Material under a baseplate magnet hole | 0.5 mm                                                            |                                 |
| Magnet position at a 42 mm grid        | 13 mm from the cell center on each axis (8 mm from the cell edge) |                                 |
| Screw hole in a bin                    | 3 mm (M3)                                                         | 2 to 6 mm                       |
| Screw-down hole in a baseplate         | 3.4 mm (clearance for M3)                                         | 2 to 8 mm                       |
| Countersink head in a baseplate        | 6 mm wide                                                         |                                 |
| Counterbore in a baseplate             | 5.5 mm wide, 3 mm deep                                            |                                 |

A 6.5 mm hole takes a 6 mm magnet with room for print tolerance. Magnet holes make a baseplate taller by the magnet depth plus 0.5 mm. The baseplate screw-down hole is a clearance hole: the screw passes through it and pulls the plate down onto the drawer.

## Clearances and limits

| Measurement                                    | Value                                           |
| ---------------------------------------------- | ----------------------------------------------- |
| Gap between a bin and its grid cell            | 0.5 mm in total (0.25 mm on each side)          |
| Smallest edge strip that gets a partial pocket | 8 mm. A narrower drawer-fit margin stays solid. |
| Solid baseplate floor                          | 0.8 mm (default), 0.4 to 5 mm                   |
| Compartment grid in one bin                    | 1 to 12 columns and 1 to 12 rows                |
| Layers in one layout                           | 1 to 10                                         |

## Next steps

- [Units and sizes](../concepts/units): how grid units, height units and millimeters work together in the app.
- [Fit and tolerances](../printing/fit-and-tolerances): what to change when a printed bin is too tight or too loose.
- [Magnets and screws](../baseplates/magnets-and-screws): add magnet holes and screw-down holes to a baseplate.
- [The base](../designer/base): change the base of a bin in the bin designer.
