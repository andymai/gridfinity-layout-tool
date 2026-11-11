---
title: The base
description: 'Add magnet and screw holes to a bin, choose its feet, and make its floor lighter.'
sources:
  - src/features/bin-designer/components/panel/BaseSection/
  - src/features/bin-designer/types/base.ts
  - src/shared/constraints/rules.ts
  - src/shared/utils/detachableFeetPlan.ts
  - src/shared/generation/lowProfileBase.ts
  - src/features/generation/worker/generators/socketBuilder.ts
---

# The base

The base is the underside of a bin: the feet that lock into a baseplate, the holes for magnets and screws, and the floor. Add magnets to the bins and the baseplate, and your bins snap onto the plate instead of sliding around. Hollow the feet, and the bin uses less filament. [Anatomy of a bin](../concepts/bin-anatomy#feet) explains how the feet sit in a baseplate.

In the bin designer of the Gridfinity Layout Tool, open the <Ui k="binDesigner.group.base" /> group. Below the <Ui k="binDesigner.base.bodyType" /> tiles and the stacking lip controls, the base controls sit in three sections:

- <Ui k="binDesigner.base.section.mounting" />: magnet and screw holes.
- <Ui k="binDesigner.base.section.feet" />: half-size feet, the foot lattice and detachable feet.
- <Ui k="binDesigner.base.section.floor" />: the lightweight floor.

When a body type cannot have a section, the section shows one line that tells you why.

## Add magnet holes

1. Under <Ui k="binDesigner.base.section.mounting" />, turn on <Ui k="binDesigner.base.magnetHoles" />.
2. Set <Ui k="binDesigner.base.magnetDiameter" /> to the diameter of your magnets.
3. Set <Ui k="binDesigner.base.magnetDepth" /> to the thickness of your magnets.

The diameter goes from 4 to 10 mm, with a default of 6.5 mm. The depth goes from 1 to 4 mm, with a default of 2 mm. Not sure? Keep the defaults. They suit a standard 6 by 2 mm magnet.

### Hold magnets without glue

Glue is messy. Two options under <Ui k="binDesigner.base.magnetHoles" /> help a magnet stay in its hole without it, and you can use both together.

| Option                                      | What it does                                                                            |
| ------------------------------------------- | --------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.base.magnetCrushRibs" /> | Eight ridges in each hole crush when you press the magnet in, so it holds without glue. |
| <Ui k="binDesigner.base.magnetChamfer" />   | A 45° lead-in at the opening of each hole guides the magnet in straight.                |

A lightweight floor and a <Ui k="binDesigner.base.bodyType.nesting" /> body leave too little material around each hole for <Ui k="binDesigner.base.magnetChamfer" />.

## Add screw holes

Turn on <Ui k="binDesigner.base.screwHoles" /> and set <Ui k="binDesigner.base.screwDiameter" />, from 2 to 6 mm. The default is 3 mm. A bin can have magnet holes and screw holes together.

## Put holes at the corners only

By default, every foot gets its holes. Turn on <Ui k="binDesigner.base.cornerHolesOnly" /> to put the holes only at the outer corners of the bin. A large bin then needs fewer magnets and lifts off the baseplate more easily.

A half-size foot keeps the holes it has space for: two along its long side, or one in its center.

::: info
Three body types cannot have magnet or screw holes:

- <Ui k="binDesigner.flatFloor" />
- <Ui k="binDesigner.lidBottom" />
- <Ui k="binDesigner.spacer" />

A <Ui k="binDesigner.base.bodyType.nesting" /> body takes magnets but no screws, and places its magnets itself. See [Stacking](./stacking#nest-boxes-on-each-other).
:::

<Screenshot id="designer-base-mounting" alt="The Mounting group with magnet holes, crush ribs and corners only turned on." spec="Bin designer, Base group open, bin 3 x 3 x 3. Turn on Magnet holes, Crush ribs and Corners only. Show the Mounting section, and turn the preview to show the underside. Crop to panel plus preview." />

## Use half-size feet

Turn on <Ui k="binDesigner.halfSockets" /> under <Ui k="binDesigner.base.section.feet" /> to split each foot into feet half a grid unit wide. These feet seat in a baseplate at either half-unit offset.

### Set the foot lattice

A foot must land inside one pocket of the baseplate. A full foot on the edge of a pocket doesn't drop in. The <Ui k="binDesigner.footLattice" /> fold sets where the feet fall on each axis:

- <Ui k="binDesigner.footLattice.grid" />: use it when the edge of the bin is on a grid line. This is the default.
- <Ui k="binDesigner.footLattice.half" />: use it on an axis where the bin sits half a unit off the grid.

Half sockets, a custom shape and a half-unit size keep the lattice on grid.

## Print detachable feet

<Ui k="binDesigner.detachableFeet" /> prints the bin with a flat bottom and pin holes in the floor. The feet print as separate parts, and you press them on by hand. Wear one out? Print a new foot and swap it.

1. Turn on <Ui k="binDesigner.detachableFeet" />.
2. Pick a <Ui k="binDesigner.detachableFeet.pinSize" />, from ø2.6 to ø3.2 mm. The default is ø2.8 mm.
3. Drag the slider in the 3D preview to drop the feet off the bin and look at the joint.

The pin holes are 3 mm wide. If a foot won't go on, pick a smaller pin. If a foot comes loose, pick a larger pin.

The feet go at the outer whole cells, never under the middle of the floor. The bin designer adds feet where the gap between two feet is more than 140 mm. The panel shows how much material the bin saves.

::: warning
Use a wall of 1 mm or thicker for detachable feet. A thinner wall leaves too little floor to hold a pin, so you cannot turn on the toggle.
:::

With detachable feet on, these options have no effect:

- <Ui k="binDesigner.halfSockets" />
- <Ui k="binDesigner.lightweight" />
- <Ui k="binDesigner.overhang.feet" />

A spacer needs its built-in feet to hold together, so it cannot have detachable feet.

## Make the floor lighter

Want to save filament on a big batch? <Ui k="binDesigner.lightweight" /> under <Ui k="binDesigner.base.section.floor" /> hollows each foot. <Ui k="binDesigner.lightweightMode" /> sets the side it opens from:

| Mode                                             | Result                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.lightweightMode.interior" />  | Each foot is hollow from the inside, and the grid shape shows in the floor. It saves the most filament. |
| <Ui k="binDesigner.lightweightMode.underside" /> | Each foot is hollow from below, and the floor of the bin stays flat.                                    |

Small or flat items can fall into the recesses of the <Ui k="binDesigner.lightweightMode.interior" /> mode. That mode also removes the solid floor that a finger scoop, an interior fillet, cutouts and drainage holes need.

### Hollow the floor from underneath

Pick <Ui k="binDesigner.lightweightMode.underside" /> to keep a flat floor inside the bin. If you're not sure which mode to use, this is the safer pick. Each foot becomes a ring with a 3 mm wall, and the floor of the bin closes it at the top. Finger scoops and drainage holes still work.

When another feature blocks the lightweight floor, the panel can show <Ui k="binDesigner.lightweight.useUnderside" />. Click it to turn on the floor in the underside mode, which works with that feature.

A spacer cannot have a lightweight floor. A <Ui k="binDesigner.tile" /> bin can use only the underside mode.

<Screenshot id="designer-base-lightweight" alt="The Floor group with Lightweight floor on in the Underside mode, and the preview from below." spec="Bin designer, Base group open, bin 2 x 2 x 3. Turn on Lightweight floor and pick Underside. Turn the preview to show the hollow feet from below. Crop to panel plus preview." />

## Use a low-profile base

<Ui k="baseplate.lowProfileBase" /> is an option of the layout in the baseplate generator. It gives every bin in the drawer 1.1 mm more space inside at the same height. The feet are 1.1 mm shorter, and the floor is 1.1 mm lower.

When the layout uses it, the <Ui k="binDesigner.base.section.feet" /> section shows a note. Standard Gridfinity bins still sit in a low-profile plate, with less grip. A design that you share or publish always gets standard feet, because the low-profile setting belongs to your layout, not to the design.

## Make a bin without sockets

A <Ui k="binDesigner.flatFloor" /> has no Gridfinity feet, so the bin sits flat on any surface and doesn't lock into a baseplate. Use it for a shelf or a desk. A <Ui k="binDesigner.lidBottom" /> also has no feet, because its underside is a lid.

These two body types cannot have magnet or screw holes, half sockets, a lightweight floor or detachable feet. Drainage holes still work on a flat base.

For all six body types, see [Pick a body type](./size-and-shape#pick-a-body-type). For imported bins and Workshop builds, see [Other bin types](./special-bins#other-bin-types).

## Next steps

- [Stacking](./stacking): set the stacking lip on top of the bin.
- [Walls](./walls#add-drainage-holes): add drainage holes to the floor.
- [Magnets and screws](../baseplates/magnets-and-screws): match the holes in the baseplate.
- [Fit and tolerances](../printing/fit-and-tolerances): tune the fit of magnets and pins.
