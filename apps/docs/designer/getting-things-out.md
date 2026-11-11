---
title: Scoops, fillets and pull tabs
description: 'Add finger scoops, round the inside of each compartment, and lift a bin with pull tabs.'
sources:
  - src/features/bin-designer/components/panel/ScoopSection/
  - src/features/bin-designer/components/panel/InteriorFilletSection/
  - src/features/bin-designer/components/panel/PullTabSection/
  - src/features/bin-designer/types/pullTab.ts
  - src/shared/utils/pullTabPlan.ts
  - src/shared/utils/interiorFillet.ts
  - src/shared/constraints/rules.ts
---

# Scoops, fillets and pull tabs

Small parts hide in the corners of a deep bin, and a full bin can be hard to lift out of a drawer. The Gridfinity Layout Tool gives you three features for this. A finger scoop and an interior fillet help you get the contents out, and a pull tab helps you lift the bin.

The finger scoop and the interior fillet are on the <Ui k="binDesigner.category.interior" /> page of the bin designer. The pull tab is on the <Ui k="binDesigner.category.features" /> page.

## Add a finger scoop

A finger scoop is a ramp from the floor up to a wall. You slide small items up the ramp with a finger.

1. On the <Ui k="binDesigner.category.interior" /> page, turn on <Ui k="binDesigner.fingerScoop" />.
2. Under <Ui k="binDesigner.scoopSide" />, pick one or more walls for the ramp.
3. Under <Ui k="binDesigner.scoopStyle" />, pick <Ui k="binDesigner.scoopStyleCurved" /> or <Ui k="binDesigner.scoopStyleStraight" />.
4. Set the size.

Each compartment gets a ramp on every wall you pick. Ramps on two walls that meet cross each other in the corner. The front wall is the default, and at least one wall stays on.

### Set the scoop size

By default, <Ui k="binDesigner.scoopRadius" /> is <Ui k="binDesigner.scoopRadiusAutoLabel" />. The scoop then fits the size of each compartment. <Ui k="binDesigner.scoopMaxHeight" /> sets the highest it can go, from 5 mm up to the inside height of the bin. The default is 25 mm.

For a custom scoop, click the <Ui k="binDesigner.scoopRadiusAutoLabel" /> button beside <Ui k="binDesigner.scoopRadius" />. Then set two values:

- <Ui k="binDesigner.scoopHeight" />: how high the ramp rises up the wall.
- <Ui k="binDesigner.scoopRun" />: how far the ramp goes across the floor.

Each value is 5 mm or more. When the height is more than two times the run, the panel warns you. A scoop that steep can print with rough overhangs.

### When the scoop is not available

The finger scoop needs a solid floor in a rectangular bin with compartment walls. The panel gives the reason when you cannot turn it on:

- Removable dividers and solid bins have no place for a scoop.
- A custom shape needs a rectangular footprint.
- The inside mode of a lightweight floor has no solid floor for the ramp. Change the mode to underside to keep both. See [The base](./base#hollow-the-floor-from-underneath).
- A spacer, a base-only bin and a <Ui k="binDesigner.base.bodyType.nesting" /> body have no place for a scoop.

<Screenshot id="designer-getting-things-out-scoop" alt="A bin with three compartments and curved finger scoops on the front and back walls." spec="Bin designer, Interior page, bin 3 x 2 x 6 with Grid dividers set to 3 columns and 1 row. Turn on Finger scoop, pick the front and back walls and the Curved style. Show the Finger scoop section and the preview at an angle that shows the ramps. Crop to panel plus preview." />

## Round the inside with an interior fillet

<Ui k="binDesigner.interiorFillet.label" /> rounds the edges where the walls meet the floor, and the corners where the walls meet each other. Small parts then slide out, and the bin is easy to wipe clean.

1. On the <Ui k="binDesigner.category.interior" /> page, turn on <Ui k="binDesigner.interiorFillet.label" />.
2. Set the <Ui k="binDesigner.interiorFillet.radius" />, from 0.5 to 15 mm.

The radius starts at the radius of the inside corners of the bin, so the fillet meets the corners without a step.

### Limits of the fillet

A compartment that is too small for the radius gets the largest rounding that fits. The panel tells you when this happens. On a tray of small compartments, a large radius makes each compartment a bowl.

The fillet needs a solid floor. It does not work with removable dividers, because it would fill the divider slots. A solid bin, a spacer, a base-only bin and a <Ui k="binDesigner.base.bodyType.nesting" /> body cannot have it either. With a lightweight floor, use the underside mode.

## Add a pull tab

A pull tab is a raised grip that stands above the rim of a wall. Hold it to lift the bin out of a drawer.

1. On the <Ui k="binDesigner.category.features" /> page, turn on <Ui k="binDesigner.pullTab.title" />.
2. Under <Ui k="binDesigner.pullTab.wall" />, pick one or more walls.
3. Set <Ui k="binDesigner.pullTab.width" />, in millimetres or as a percentage of the wall.
4. Set <Ui k="binDesigner.pullTab.height" />, from 3 to 40 mm.

You can put a tab on one wall, on two opposite walls, or on all four. The tabs share the same size. Each wall with a tab gets thicker on the inside, to the value of <Ui k="binDesigner.pullTab.thickness" />. That value goes up to 4 mm. The tab is part of the <Ui k="assembledHeight.title" /> readout.

A recess on the inside of the tab gives your finger a grip. More controls set the shape of the tab and the recess:

- <Ui k="binDesigner.pullTab.topRadius" /> and <Ui k="binDesigner.pullTab.rootRadius" /> round the shoulders of the tab.
- <Ui k="binDesigner.pullTab.recessHeight" />, <Ui k="binDesigner.pullTab.recessDepth" /> and <Ui k="binDesigner.pullTab.recessBorder" /> set the size of the recess.
- <Ui k="binDesigner.pullTab.backRecess" /> adds the same grip on the outside of the wall.

::: warning
Keep the walls with a pull tab plain. A pull tab needs a wall with no cutouts, handles, patterns, text or label slots.
:::

A pull tab also needs a rectangular, hollow bin with walls, no lid and no overhang. On a small bin, tabs on opposite walls can close the inside. Then pick fewer walls or a thinner tab.

<Screenshot id="designer-getting-things-out-pull-tab" alt="A bin with pull tabs on the front and back walls, seen from the front." spec="Bin designer, Features page, bin 3 x 2 x 4 with no other wall features. Turn on Pull tab and pick the front and back walls. Show the Pull tab section and the preview from the front at a low angle. Crop to panel plus preview." />

## Lift a divided tray from the middle

A large tray full of dividers is hard to lift from one end. Put the pull tab on the center divider, and you can lift the tray with one hand.

1. Make a divider that runs from wall to wall at full height. See [Compartments and dividers](./compartments).
2. Under <Ui k="binDesigner.pullTab.wall" />, pick <Ui k="binDesigner.pullTab.side.center" />.
3. If the bin has dividers in both directions, pick one under <Ui k="binDesigner.pullTab.centerAxis" />.

The designer uses the divider nearest the middle of the bin, and makes it thicker on both sides. The center tab has these conditions:

- The divider must be straight and at full height.
- Label tabs must be off, because they use the tops of the dividers.
- <Ui k="binDesigner.extraWallHeight" /> must be 0.

## Next steps

- [Compartments and dividers](./compartments): set up the compartments that get the scoops.
- [Stacking](./stacking): see how the tab adds to the height of the bin.
- [Walls](./walls): add handles if you need a grip without a tab.
- [The base](./base#make-the-floor-lighter): choose a lightweight floor that keeps the scoop.
