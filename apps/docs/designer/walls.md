---
title: Walls
description: 'Set the wall thickness, add wall patterns, cut openings and handles, add label slots, and put drainage holes in the floor.'
sources:
  - src/features/bin-designer/components/panel/WallsSection/
  - src/features/bin-designer/components/panel/WallCutoutsSection/
  - src/features/bin-designer/components/panel/HandleSection/
  - src/features/bin-designer/components/panel/BaseSection/FloorPatternSection.tsx
  - src/features/bin-designer/types/walls.ts
  - src/features/bin-designer/types/handles.ts
  - src/shared/utils/wallLabelSlotPlan.ts
---

# Walls

The walls of a bin in the Gridfinity Layout Tool can be thin or strong, solid or patterned. You can also cut openings, handles and label slots into them. This page also covers drainage holes, because they use the same patterns as the walls.

The controls are on three pages of the bin designer:

- <Ui k="binDesigner.category.shape" />: the wall thickness.
- <Ui k="binDesigner.category.style" />: wall patterns, label slots and drainage holes.
- <Ui k="binDesigner.category.features" />: wall cutouts and handles.

## Set the wall thickness

Use the <Ui k="binDesigner.wallThickness" /> slider under <Ui k="binDesigner.style.section.walls" /> on the Shape page. It stops at fixed values from 0.4 to 2.6 mm. The default is 1.2 mm.

| Thickness     | Use it for                                         |
| ------------- | -------------------------------------------------- |
| 0.4 to 0.8 mm | Light contents and fast prints. 0.4 mm is fragile. |
| 1.2 mm        | Most bins: a balance of strength and speed.        |
| 1.6 to 2.0 mm | Heavier contents and larger bins.                  |
| 2.4 to 2.6 mm | The most strength and rigidity.                    |

For the best result, use a multiple of your nozzle size. For example, 1.2 mm is three lines of a 0.4 mm nozzle.

## Add a wall pattern

A wall pattern cuts a repeated shape of holes through the walls.

1. Open the <Ui k="binDesigner.category.style" /> page.
2. Under <Ui k="binDesigner.style.section.wallSurface" />, pick a <Ui k="binDesigner.walls.pattern.label" />.
3. Set <Ui k="binDesigner.walls.pattern.scale" />: finer holes to the left, larger holes to the right.
4. Set <Ui k="binDesigner.walls.pattern.strutWidth" />, the solid material between the holes.

The patterns are <Ui k="binDesigner.walls.pattern.honeycomb" />, <Ui k="binDesigner.walls.pattern.round" />, <Ui k="binDesigner.walls.pattern.diamond" />, <Ui k="binDesigner.walls.pattern.triangle" /> and <Ui k="binDesigner.walls.pattern.slots" />. A group of <Ui k="binDesigner.walls.pattern.groupKumiko" /> lattice patterns is also in the list. <Ui k="binDesigner.walls.pattern.none" /> turns the pattern off.

The strut width goes from 0.8 to 2.4 mm. 0.8 mm is two lines of a 0.4 mm nozzle. Use a wider strut for a bin that gets knocked about.

### Choose which walls get the pattern

Use the <Ui k="binDesigner.walls.pattern.sides" /> picker to put the pattern on some walls only.

Turn on <Ui k="binDesigner.walls.pattern.dividers" /> to give the compartment dividers the same pattern and scale. Dividers that are too small for the pattern stay solid.

A Kumiko pattern is one lattice around all four walls. It needs a rectangular bin with no divider slots and no label slots.

::: tip
A wall pattern takes longer to build on a tall bin. If an export runs out of memory, make the pattern bolder, lower the height, or turn the pattern off.
:::

The pattern stops below <Ui k="binDesigner.extraWallHeight" />. For a taller patterned wall, raise the height of the bin. A solid bin and a <Ui k="binDesigner.tile" /> bin cannot have a wall pattern. A wall with divider slots stays solid.

<Screenshot id="designer-walls-pattern" alt="A bin with a honeycomb pattern on the front wall only, and the Wall surface controls." spec="Bin designer, Style page, bin 3 x 2 x 6. Pick Honeycomb, set Pattern scale to 50 percent, and in Patterned walls turn off every wall except the front. Show the Wall surface section and the preview from the front. Crop to panel plus preview." />

## Cut openings in the walls

<Ui k="binDesigner.wallCutouts" /> cut a notch down from the top of a wall, so you can reach in or run a cable.

1. Open the <Ui k="binDesigner.category.features" /> page.
2. Turn on <Ui k="binDesigner.wallCutouts" />.
3. Pick a shape: <Ui k="binDesigner.wallCutouts.shape.uShape" />, <Ui k="binDesigner.wallCutouts.shape.scoop" /> or <Ui k="binDesigner.wallCutouts.shape.funnel" />.
4. Pick the walls in the wall picker.
5. Set <Ui k="binDesigner.wallCutouts.span" /> and <Ui k="binDesigner.wallCutouts.height" />.

The button beside each value changes it between a percentage of the wall and millimetres. In millimetres, the designer measures the height down from the rim, so bins of different heights get a cut at the same line. A cutout deeper than its wall stops at the wall.

<Ui k="binDesigner.wallCutouts.linked" /> gives all walls the same size. Click it to change to <Ui k="binDesigner.wallCutouts.independent" /> and size each wall alone. Two folds give more control:

- <Ui k="binDesigner.wallCutouts.position" />: pick <Ui k="binDesigner.alignment.left" />, <Ui k="binDesigner.alignment.center" /> or <Ui k="binDesigner.alignment.right" />, and add an <Ui k="binDesigner.wallCutouts.offset" /> of up to 50 mm.
- <Ui k="binDesigner.wallCutouts.corners" />: round the top corners, and set the bottom fillet or leave it on <Ui k="binDesigner.wallCutouts.cornerAuto" />.

<Ui k="binDesigner.wallCutouts.interior" /> carries the opening through each divider. When you turn on wall cutouts on a bin with compartments, the designer turns this on for you.

## Add handles

<Ui k="binDesigner.handles" /> cut a hole through a wall, so you can lift the bin out of a deep drawer.

1. On the <Ui k="binDesigner.category.features" /> page, turn on <Ui k="binDesigner.handles" />.
2. Pick a shape: <Ui k="binDesigner.handles.shape.rectangle" />, <Ui k="binDesigner.handles.shape.oval" /> or <Ui k="binDesigner.handles.shape.scoop" />.
3. Pick the walls in the wall picker.
4. Set <Ui k="binDesigner.handles.width" /> as a percentage of the wall, and <Ui k="binDesigner.handles.height" /> in millimetres.

The width goes from 10 to 100 %, and the height from 8 to 30 mm. The fold under the sizes sets the <Ui k="binDesigner.handles.verticalPosition" /> on the wall, from 20 to 90 %, and a <Ui k="binDesigner.handles.count" /> of 1 to 3 holes. <Ui k="binDesigner.handles.chamfer" /> adds a chamfer around the hole, and <Ui k="binDesigner.handles.interior" /> cuts the handles through the dividers too.

Wide holes can need supports when you print them. When label tabs are on, the back wall cannot have a handle. A wall with divider slots cannot have a handle either. When the slots run in one direction only, the other two walls can.

## Add label slots

<Ui k="binDesigner.walls.labelSlots.heading" /> on the <Ui k="binDesigner.category.style" /> page cut a vertical slot in the cells of the walls you pick. Each slot holds a 1u label plate that drops in from the top and shows through a window in the wall.

1. Turn on <Ui k="binDesigner.walls.labelSlots.heading" />.
2. Pick the walls in <Ui k="binDesigner.walls.labelSlots.sides" />.
3. Set <Ui k="binDesigner.walls.labelSlots.spacing" />, from <Ui k="binDesigner.walls.labelSlots.everyCell" /> to one slot in every 6 cells.

When the wall is too thin to hold the slot, a rib on the inside backs it. Each slot also notches the stacking lip. A wall thinner than 0.8 mm leaves a fragile frame in front of the plate. Label slots need a rectangular bin with no overhang, and walls tall enough for an 11 mm plate. [Swappable label plates](./label-plates) explains the plates.

## Add drainage holes

<Ui k="binDesigner.base.floorPattern" /> cut holes through the floor and the feet below it, so water and dust fall straight through. Use them for wet items or items that must dry.

1. On the <Ui k="binDesigner.category.style" /> page, go to <Ui k="binDesigner.base.section.floorPattern" />.
2. Turn on <Ui k="binDesigner.base.floorPattern" />.
3. Pick a <Ui k="binDesigner.base.floorPattern.shape" />.
4. Set <Ui k="binDesigner.walls.pattern.scale" />.

The holes stay inside the flat bottom of each foot, so the edges that lock into the baseplate stay whole. If the holes are too large for the base, the panel asks for a finer scale. The inside mode of a lightweight floor leaves no solid floor to drill, so use its underside mode. A solid bin, a spacer and a <Ui k="binDesigner.tile" /> bin cannot have drainage holes.

<Screenshot id="designer-walls-drainage" alt="A bin with round drainage holes through the floor, seen from below." spec="Bin designer, Style page, bin 2 x 2 x 3. Turn on Drainage holes with the Round shape at 50 percent scale. Turn the preview to show the underside with the holes through the feet. Crop to panel plus preview." />

## Next steps

- [Compartments and dividers](./compartments): divide the bin inside the walls.
- [Labels and text](./labels-and-text): put text on the outer walls.
- [Scoops, fillets and pull tabs](./getting-things-out): add a raised grip to a plain wall.
- [Lids](./lids): see how wall features affect a lid.
