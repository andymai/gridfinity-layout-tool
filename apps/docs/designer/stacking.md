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

Gridfinity bins stack. The feet of one bin sit in the **stacking lip** of the bin below, so a deep drawer can hold more than one level. In the Gridfinity Layout Tool, you can shape that lip and lock small bins onto big ones. You can also see how tall a stack gets before you print it.

The stacking controls are in the <Ui k="binDesigner.base.section.stacking" /> section of the <Ui k="binDesigner.group.base" /> group, just under the body type tiles. The <Ui k="assembledHeight.title" /> readout is in the <Ui k="binDesigner.group.shape" /> group. It sits under <Ui k="binDesigner.dimensions" />.

## Turn the stacking lip on or off

<Ui k="assembledHeight.stackingLip" /> is on by default. It lets the feet of another bin sit on top of this one. Not sure? Leave it on.

The lip changes how tall the dividers can be. With the lip on, a divider at <Ui k="binDesigner.dividerAutoHeight" /> height stops just below the feet of a stacked bin. With the lip off, dividers reach the rim.

Got contents that stand above the rim? <Ui k="binDesigner.extraWallHeight" />, in the <Ui k="binDesigner.dimensions" /> section, raises the lip with the outer walls. A bin on top then rests on the taller rim, above the tall contents.

A slanted bin has no stacking lip. See [Special bins](./special-bins).

### Round the rim of a bin without a lip

When the lip is off, <Ui k="binDesigner.base.rimFillet" /> appears. It rounds the top of the outer walls, a raised pull tab and full-height grid dividers, so the rim has no sharp top edge.

1. Turn off <Ui k="assembledHeight.stackingLip" />.
2. Turn on <Ui k="binDesigner.base.rimFillet" />.
3. Set <Ui k="binDesigner.base.rimFillet.radius" />. The default is 0.4 mm.

<Screenshot id="designer-stacking-round-rim" alt="A close view of a bin with its stacking lip. Turning off Stacking lip leaves a plain wall at the rim. Then Round top rim turns on and shows the Rim fillet radius slider at 0.4 mm." spec="Bin designer, bin 2 x 2 x 3, preview zoomed in. Show the bin, then turn off Stacking lip in close-up and show the bin again. Then turn on Round top rim in close-up." />

The thinner of the wall and the dividers limits the radius. The option needs a rectangular, hollow bin with walls.

## Make the lip print cleanly

The standard lip comes to a point. The top of that point prints as a thin line with nothing under it, so it can scar, curl or lift. If your lips print rough, change the shape of the point with <Ui k="binDesigner.base.lipTip" />:

| Peak                                       | Result                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------------- |
| <Ui k="binDesigner.base.lipTip.sharp" />   | The standard profile with a point. This is the default.                     |
| <Ui k="binDesigner.base.lipTip.round" />   | Rounds 0.4 mm off the point, so the top layer has solid material under it.  |
| <Ui k="binDesigner.base.lipTip.chamfer" /> | Cuts 0.4 mm off the point at an angle.                                      |
| <Ui k="binDesigner.base.lipTip.flat" />    | Cuts 0.7 mm off the point level, which leaves space for a full line on top. |

All four shapes stack the same way, so you can change the peak without any worry about fit. The change is only at the top of the point.

<Screenshot id="designer-stacking-top-rim" alt="In the Top rim section, picking Rounded under Lip peak and turning on Lip notches. Then a close view of the bin shows a small notch on the lip at each grid line." spec="Bin designer, Base group open, bin 3 x 2 x 3. In close-up, pick Rounded under Lip peak and turn on Lip notches. Then show the bin up close in the preview." />

## Keep smaller bins in place on bigger ones

A small bin on top of a big bin can slide along the rim. <Ui k="binDesigner.base.lipNotches" /> adds a small ridge on the lip at each grid line, so a smaller bin on top locks to a grid cell. A bin of the same size still sits as usual, and the outside of the lip does not change.

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
3. For a large box, set <Ui k="binDesigner.lid.retentionEdgeMagnets" />.

<Screenshot id="designer-stacking-nesting" alt="Picking the Nesting body type gives the box one tapered base. Then Magnet holes turns on under Mounting, and a view from below shows a magnet hole in each corner." spec="Bin designer, bin 2 x 2 x 6. In close-up, pick Nesting, then show the box. Turn on Magnet holes, then show the box from below." />

With magnets on, the box gets four corner magnets. <Ui k="binDesigner.lid.retentionEdgeMagnets" /> adds up to 3 more magnets along each long edge, only where the edge is long enough for them. The magnet size is the same as for the lid. To get matching magnet holes at the top, choose a magnetic lid. See [Lids](./lids).

A nesting box does not fit a Gridfinity baseplate. Its lower floor rules out a finger scoop, an interior fillet and removable dividers. Dividers and drainage holes still work.

::: tip
To put a box on top of a bin as a tray with a lid underside, use the <Ui k="binDesigner.lidBottom" /> body type instead. [Lids](./lids) explains it.
:::

## Read the assembled height

Will it fit under the drawer above? <Ui k="assembledHeight.title" /> answers that. It gives the height of the bin as it stands in the drawer: on its baseplate, with its lid.

Click the readout to see each part of the height. Each row shows only when the design has that part:

| Row                                     | What it measures                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------- |
| <Ui k="assembledHeight.baseplate" />    | The height that the plate adds. It is often 0 mm, because the feet drop into the pockets |
| <Ui k="assembledHeight.bin" />          | The body of the bin                                                                      |
| <Ui k="binDesigner.pullTab.title" />    | The pull tab above the rim                                                               |
| <Ui k="assembledHeight.stackingLip" />  | The stacking lip above the body                                                          |
| <Ui k="assembledHeight.lid" />          | The lid                                                                                  |
| <Ui k="assembledHeight.lidStackGrid" /> | The stacking grid on top of a stackable lid                                              |

The readout uses the baseplate of the active layout, which includes a low-profile base. When the layout has a measured drawer height, a line under the readout tells you if the bin fits. It gives the free space above the bin, or how much too tall the bin is.

Bins with the same number of height units come out the same height. A spacer counts like a bin of the same size, so a 2-unit spacer under a 2-unit bin reaches the top of a 4-unit bin.

<Screenshot id="designer-stacking-assembled-height" alt="The Assembled height readout open, with the baseplate, bin and stacking lip rows and the drawer fit line." spec="Bin designer opened from a layout that has a measured drawer height, bin 2 x 2 x 6 with the stacking lip on. In the Shape group, click Assembled height to open the rows. Show the Dimensions section with the open readout and the fit line. Crop to the panel." />

## When it goes wrong

### The bin is taller than the drawer

Click <Ui k="assembledHeight.title" /> to see which part adds the height. Then lower <Ui k="common.height" /> by one unit, or make the pull tab or the lid lower.

The readout measures the bin on its baseplate, with its lip, pull tab and lid. The line under it compares that height with the measured height of your drawer.

### The top of the lip prints rough or peels off

Set <Ui k="binDesigner.base.lipTip" /> to <Ui k="binDesigner.base.lipTip.round" />. For the widest top line, pick <Ui k="binDesigner.base.lipTip.flat" />. Bins stack the same way with every shape.

The standard lip ends in a point. Its top layer prints as a thin line with nothing under it, so it can scar or lift. See [Make the lip print cleanly](#make-the-lip-print-cleanly).

### A small bin slides around on top of a big one

Turn on <Ui k="binDesigner.base.lipNotches" /> on the big bin. A small ridge at each grid line then holds the small bin on one cell.

Can't turn the notches on? The note under the switch names the cause: a lid, a custom shape, an overhang, a <Ui k="binDesigner.footLattice.half" /> foot lattice, or the bin size. See [Keep smaller bins in place on bigger ones](#keep-smaller-bins-in-place-on-bigger-ones).

## Next steps

- [Lids](./lids): put a lid on the stacking lip.
- [Work in layers](../layouts/layers): stack bins in a layout.
- [The base](./base): choose the feet that sit in the lip.
- [Size and shape](./size-and-shape): set the height in units.
