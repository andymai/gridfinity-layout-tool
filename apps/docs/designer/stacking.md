---
title: Stacking
description: 'Set the stacking lip, stack smaller bins on bigger ones, nest boxes, and read the assembled height.'
sources:
  - src/features/bin-designer/components/panel/BaseSection/BaseSection.tsx
  - src/features/bin-designer/components/panel/AssembledHeightBreakdown/
  - src/features/bin-designer/hooks/useAssembledHeight.ts
  - src/features/bin-designer/types/base.ts
  - src/shared/utils/lipNotchPlan.ts
  - src/shared/printSettings/assembledHeight.ts
---

# Stacking

Gridfinity bins stack: the feet of one bin sit in the stacking lip of the bin below. The Gridfinity Layout Tool lets you shape that lip, lock small bins onto big ones, and see how tall a stack gets.

The stacking controls are in the <Ui k="binDesigner.base.section.stacking" /> group of the <Ui k="binDesigner.category.shape" /> page. The <Ui k="assembledHeight.title" /> readout is under <Ui k="binDesigner.dimensions" /> on the same page.

## Turn the stacking lip on or off

<Ui k="assembledHeight.stackingLip" /> is on by default. It lets the feet of another bin sit on top of this one.

The lip changes how tall the dividers can be. With the lip on, a divider at <Ui k="binDesigner.dividerAutoHeight" /> height stops just below the feet of a stacked bin. With the lip off, dividers reach the rim.

<Ui k="binDesigner.extraWallHeight" /> on the <Ui k="binDesigner.category.shape" /> page raises the lip with the outer walls. A bin on top then rests on the taller rim, above tall contents.

A slanted bin has no stacking lip. See [Special bins](./special-bins).

### Round the rim of a bin without a lip

When the lip is off, <Ui k="binDesigner.base.rimFillet" /> appears. It rounds the top of the outer walls, a raised pull tab and full-height grid dividers.

1. Turn off <Ui k="assembledHeight.stackingLip" />.
2. Turn on <Ui k="binDesigner.base.rimFillet" />.
3. Set <Ui k="binDesigner.base.rimFillet.radius" />. The default is 0.4 mm.

The thinner of the wall and the dividers limits the radius. The option needs a rectangular, hollow bin with walls.

## Make the lip print cleanly

The standard lip comes to a point. The top of that point prints as a thin line with nothing under it, so it can scar, curl or lift. <Ui k="binDesigner.base.lipTip" /> changes the shape of the point:

| Peak                                       | Result                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| <Ui k="binDesigner.base.lipTip.sharp" />   | The standard profile with a point. This is the default.                     |
| <Ui k="binDesigner.base.lipTip.round" />   | Rounds 0.4 mm off the point, so the top layer has solid material under it.  |
| <Ui k="binDesigner.base.lipTip.chamfer" /> | Cuts 0.4 mm off the point at an angle.                                      |
| <Ui k="binDesigner.base.lipTip.flat" />    | Cuts 0.7 mm off the point level, which leaves space for a full line on top. |

All four shapes stack the same way. The change is only at the top of the point.

<Screenshot id="designer-stacking-top-rim" alt="The Top rim group with the stacking lip on, the Rounded lip peak and Lip notches turned on." spec="Bin designer, Shape page, bin 3 x 2 x 3. Keep Stacking lip on, pick Rounded under Lip peak and turn on Lip notches. Show the Top rim group and a close preview of the lip with its notches. Crop to panel plus preview." />

## Keep smaller bins in place on bigger ones

A small bin on top of a big bin can slide along the rim. <Ui k="binDesigner.base.lipNotches" /> adds a small ridge on the lip at each grid line. A smaller bin on top then locks to a grid cell. A bin of the same size still sits as usual, and the outside of the lip does not change.

1. Make sure <Ui k="assembledHeight.stackingLip" /> is on.
2. Turn on <Ui k="binDesigner.base.lipNotches" />.

Lip notches need all of these:

- No lid. A lid has its own grid for the bin above.
- A rectangular footprint with no overhang.
- A width and depth in whole or half units, and a bin larger than one unit.
- No <Ui k="binDesigner.footLattice.half" /> foot lattice, because its feet land on the notches.

## Nest boxes on each other

The <Ui k="binDesigner.base.bodyType.nesting" /> body type is for boxes that stand on top of one another, not on a baseplate. Its underside is one tapered base that sits in the stacking lip of a bin of the same size. The floor prints flat on the print bed.

1. Under <Ui k="binDesigner.base.bodyType" />, pick <Ui k="binDesigner.base.bodyType.nesting" />.
2. To hold the stack together, turn on <Ui k="binDesigner.base.magnetHoles" /> under <Ui k="binDesigner.base.section.mounting" />.
3. Set <Ui k="binDesigner.lid.retentionEdgeMagnets" /> for a large box.

With magnets on, the box gets four corner magnets. <Ui k="binDesigner.lid.retentionEdgeMagnets" /> adds up to 3 more magnets along each long edge, only where the edge is long enough for them. The magnet size is the same as for the lid. To get matching pockets at the top, choose a magnetic lid. See [Lids](./lids).

A nesting box does not fit a Gridfinity baseplate. Its lower floor rules out a finger scoop, an interior fillet and removable dividers. Dividers and drainage holes still work.

::: tip
To put a box on top of a bin as a tray with a lid underside, use the <Ui k="binDesigner.lidBottom" /> body type instead. [Lids](./lids) explains it.
:::

## Read the assembled height

<Ui k="assembledHeight.title" /> gives the height of the bin as it stands in the drawer: on its baseplate, with its lid. Use it to see if the bin fits under the drawer above.

Click the readout to show each part of the height:

- <Ui k="assembledHeight.baseplate" />: the height the plate adds. It is often 0 mm, because the feet drop into the pockets of the plate.
- <Ui k="assembledHeight.bin" />: the body of the bin.
- <Ui k="binDesigner.pullTab.title" />, <Ui k="assembledHeight.stackingLip" />, <Ui k="assembledHeight.lid" /> and <Ui k="assembledHeight.lidStackGrid" />: each part that rises above the bin, when the design has it.

The readout uses the baseplate of the active layout, which includes a low-profile base. When the layout has a measured drawer height, a line under the readout tells you if the bin fits. It gives the free space above the bin, or how much too tall the bin is.

Bins with the same number of height units come out the same height. A spacer counts like a bin of the same size, so a 2-unit spacer under a 2-unit bin reaches the top of a 4-unit bin.

<Screenshot id="designer-stacking-assembled-height" alt="The Assembled height readout open, with the baseplate, bin and stacking lip rows and the drawer fit line." spec="Bin designer opened from a layout that has a measured drawer height, bin 2 x 2 x 6 with the stacking lip on. On the Shape page, click Assembled height to open the rows. Show the Dimensions section with the open readout and the fit line. Crop to the panel." />

## Next steps

- [Lids](./lids): put a lid on the stacking lip.
- [Work in layers](../layouts/layers): stack bins in a layout.
- [The base](./base): choose the feet that sit in the lip.
- [Size and shape](./size-and-shape): set the height in units.
