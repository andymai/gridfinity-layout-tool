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
  - src/features/bin-designer/constants/gridfinity.ts
---

# Walls

Thin walls print fast and leave more room inside. Thick walls survive a toolbox. Here's how to pick a thickness in the Gridfinity Layout Tool, and how to add patterns, openings, handles and label slots. Drainage holes are here too, because they use the same patterns as the walls. [Anatomy of a bin](../concepts/bin-anatomy#walls) shows where the walls sit in a bin.

The wall controls are in three groups of the bin designer:

- <Ui k="binDesigner.group.shape" />: the wall thickness and wall cutouts.
- <Ui k="binDesigner.group.lid" />: handles.
- <Ui k="binDesigner.group.finishing" />: wall patterns, label slots and drainage holes.

## Set the wall thickness

In the <Ui k="binDesigner.group.shape" /> group, find the <Ui k="binDesigner.style.section.walls" /> section. Its <Ui k="binDesigner.wallThickness" /> slider stops at fixed values from 0.4 to 2.6 mm. Not sure? Keep the default, 1.2 mm. It suits most bins.

| Thickness     | Use it for                                         |
| ------------- | -------------------------------------------------- |
| 0.4 to 0.8 mm | Light contents and fast prints. 0.4 mm is fragile. |
| 1.2 mm        | Most bins: a balance of strength and speed.        |
| 1.6 to 2.0 mm | Heavier contents and larger bins.                  |
| 2.4 to 2.6 mm | The most strength and rigidity.                    |

For the best result, use a multiple of your nozzle size. For example, 1.2 mm is three lines of a 0.4 mm nozzle.

## Add a wall pattern

A wall pattern cuts rows of holes through the walls, so you can see what's inside.

1. In the <Ui k="binDesigner.group.finishing" /> group, go to <Ui k="binDesigner.style.section.wallSurface" />.
2. Pick a <Ui k="binDesigner.walls.pattern.label" />.
3. Set <Ui k="binDesigner.walls.pattern.scale" />: finer holes to the left, larger holes to the right.
4. Set <Ui k="binDesigner.walls.pattern.strutWidth" />, the solid material between the holes.

| Pattern                                                | The holes                                                         |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| <Ui k="binDesigner.walls.pattern.honeycomb" />         | Six-sided, like a honeycomb                                       |
| <Ui k="binDesigner.walls.pattern.round" />             | Round                                                             |
| <Ui k="binDesigner.walls.pattern.diamond" />           | Diamonds                                                          |
| <Ui k="binDesigner.walls.pattern.triangle" />          | Triangles                                                         |
| <Ui k="binDesigner.walls.pattern.slots" />             | Long, narrow slots                                                |
| <Ui k="binDesigner.walls.pattern.groupKumiko" /> group | A set of lattice patterns, each one lattice around all four walls |
| <Ui k="binDesigner.walls.pattern.none" />              | No holes. It turns the pattern off.                               |

The strut width goes from 0.8 to 2.4 mm. 0.8 mm is two lines of a 0.4 mm nozzle. For a bin that gets knocked about, use a wider strut.

### Choose which walls get the pattern

Use the <Ui k="binDesigner.walls.pattern.sides" /> picker to put the pattern on some walls only, for example the front alone.

Turn on <Ui k="binDesigner.walls.pattern.dividers" /> to give the compartment dividers the same pattern and scale. Dividers that are too small for the pattern stay solid.

A Kumiko pattern is one lattice around all four walls. It needs a rectangular bin with no divider slots and no label slots.

::: tip
A wall pattern takes longer to build on a tall bin. If an export runs out of memory, make the pattern bolder, lower the height, or turn the pattern off.
:::

The pattern stops below <Ui k="binDesigner.extraWallHeight" />. For a taller patterned wall, raise the height of the bin. A solid bin and a <Ui k="binDesigner.tile" /> bin cannot have a wall pattern. A wall with divider slots stays solid.

<Screenshot id="designer-walls-pattern" alt="A bin with a honeycomb pattern on the front wall only, and the Wall surface controls." spec="Bin designer, Finishing group open, bin 3 x 2 x 6. Pick Honeycomb, set Pattern scale to 50 percent, and in Patterned walls turn off every wall except the front. Show the Wall surface section and the preview from the front. Crop to panel plus preview." />

## Cut openings in the walls

<Ui k="binDesigner.wallCutouts" /> cut a notch down from the top of a wall. Use one to reach in from the side, or to run a cable.

1. In the <Ui k="binDesigner.group.shape" /> group, turn on <Ui k="binDesigner.wallCutouts" />.
2. Pick one of the three shapes.
3. Pick the walls in the wall picker.
4. Set <Ui k="binDesigner.wallCutouts.span" /> and <Ui k="binDesigner.wallCutouts.height" />.

| Shape                                           | The notch                     |
| ----------------------------------------------- | ----------------------------- |
| <Ui k="binDesigner.wallCutouts.shape.uShape" /> | A rectangular notch           |
| <Ui k="binDesigner.wallCutouts.shape.scoop" />  | A half circle                 |
| <Ui k="binDesigner.wallCutouts.shape.funnel" /> | A tapered U, wider at the top |

The button beside each value changes it between a percentage of the wall and millimeters. In millimeters, the bin designer measures the height down from the rim, so bins of different heights get a cut at the same line. A cutout deeper than its wall stops at the wall.

<Ui k="binDesigner.wallCutouts.linked" /> gives all walls the same size. Click it to change to <Ui k="binDesigner.wallCutouts.independent" /> and size each wall alone. Two folds give more control:

| Fold                                        | What it sets                                                                                                                                                                                                   |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.wallCutouts.position" /> | Where the cut sits: <Ui k="binDesigner.alignment.left" />, <Ui k="binDesigner.alignment.center" /> or <Ui k="binDesigner.alignment.right" />, with an <Ui k="binDesigner.wallCutouts.offset" /> of up to 50 mm |
| <Ui k="binDesigner.wallCutouts.corners" />  | A round on the top corners. The bottom fillet takes a value, or you leave it on <Ui k="binDesigner.wallCutouts.cornerAuto" />                                                                                  |

<Ui k="binDesigner.wallCutouts.interior" /> carries the opening through each divider. When you turn on wall cutouts on a bin with compartments, the bin designer turns this on for you.

## Add handles

<Ui k="binDesigner.handles" /> cut a hole through a wall, so you can lift the bin out of a deep drawer.

1. In the <Ui k="binDesigner.group.lid" /> group, turn on <Ui k="binDesigner.handles" />.
2. Pick a hole shape.
3. Pick the walls in the wall picker.
4. Set the size and place of the hole.

| Control                                         | What it sets                                                                                                                            |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Hole shape                                      | <Ui k="binDesigner.handles.shape.rectangle" />, <Ui k="binDesigner.handles.shape.oval" /> or <Ui k="binDesigner.handles.shape.scoop" /> |
| <Ui k="binDesigner.handles.width" />            | A percentage of the wall, from 10 to 100 %                                                                                              |
| <Ui k="binDesigner.handles.height" />           | Millimeters, from 8 to 30 mm                                                                                                            |
| <Ui k="binDesigner.handles.verticalPosition" /> | In the fold under the sizes: the place of the hole on the wall, from 20 to 90 %                                                         |
| <Ui k="binDesigner.handles.count" />            | In the same fold: 1 to 3 holes                                                                                                          |
| <Ui k="binDesigner.handles.chamfer" />          | A chamfer around the hole                                                                                                               |
| <Ui k="binDesigner.handles.interior" />         | Cuts the handles through the dividers too                                                                                               |

Wide holes can need supports when you print them. When label tabs are on, the back wall cannot have a handle. A wall with divider slots cannot have a handle either. When the slots run in one direction only, the other two walls can.

## Add label slots

Want labels that you can swap later? <Ui k="binDesigner.walls.labelSlots.heading" /> cut a vertical slot in the cells of the walls you pick. Each slot holds a 1U label plate that drops in from the top and shows through a window in the wall. The controls are in the <Ui k="binDesigner.style.section.wallSurface" /> section of the <Ui k="binDesigner.group.finishing" /> group.

1. Turn on <Ui k="binDesigner.walls.labelSlots.heading" />.
2. Pick the walls in <Ui k="binDesigner.walls.labelSlots.sides" />.
3. Set <Ui k="binDesigner.walls.labelSlots.spacing" />, from <Ui k="binDesigner.walls.labelSlots.everyCell" /> to one slot in every 6 cells.

When the wall is too thin to hold the slot, a rib on the inside backs it. Each slot also notches the stacking lip. A wall thinner than 0.8 mm leaves a fragile frame in front of the plate. Label slots need a rectangular bin with no overhang, and walls tall enough for an 11 mm plate. [Swappable label plates](./label-plates) explains the plates.

## Add drainage holes

<Ui k="binDesigner.base.floorPattern" /> cut holes through the floor and the feet below it, so water and dust fall straight through. Use them for wet items, or for items that must dry.

1. In the <Ui k="binDesigner.group.finishing" /> group, go to <Ui k="binDesigner.base.section.floorPattern" />.
2. Turn on <Ui k="binDesigner.base.floorPattern" />.
3. Pick a <Ui k="binDesigner.base.floorPattern.shape" />.
4. Set <Ui k="binDesigner.walls.pattern.scale" />.

The holes stay inside the flat bottom of each foot, so the edges that lock into the baseplate stay whole. If the holes are too large for the base, the panel asks for a finer scale. The inside mode of a lightweight floor leaves no solid floor to drill, so use its underside mode. A solid bin, a spacer and a <Ui k="binDesigner.tile" /> bin cannot have drainage holes.

<Screenshot id="designer-walls-drainage" alt="A bin with round drainage holes through the floor, seen from below." spec="Bin designer, Finishing group open, bin 2 x 2 x 3. Turn on Drainage holes with the Round shape at 50 percent scale. Turn the preview to show the underside with the holes through the feet. Crop to panel plus preview." />

## Next steps

- [Compartments and dividers](./compartments): divide the bin inside the walls.
- [Labels and text](./labels-and-text): put text on the outer walls.
- [Scoops, fillets and pull tabs](./getting-things-out): add a raised grip to a plain wall.
- [Lids](./lids): see how wall features affect a lid.
