---
title: Eco plates and stack printing
description: 'Print baseplates with less filament, stack many plates in one print job, and control plate height.'
sources:
  - src/features/baseplate/components/BaseplatePanel/StackPrintSection.tsx
  - src/features/baseplate/components/BaseplatePanel/BaseSection.tsx
  - src/features/baseplate/utils/stackPrint.ts
  - src/features/baseplate/utils/buildFullParams.ts
  - src/shared/generation/ecoPlate.ts
  - src/core/types/baseplate.ts
  - src/shared/printSettings/baseplateHeight.ts
---

# Eco plates and stack printing

A drawer full of baseplates uses a lot of filament and many print jobs. An eco plate removes plastic that the bins do not need. Stack printing puts many plates on top of each other, so that one print job makes many plates.

## Save filament with an eco plate

1. In the baseplate generator, open <Ui k="baseplate.sectionBase" />.
2. Turn on <Ui k="baseplate.ecoPlate" />.

The Layout Tool cuts the straight joints between the corner posts down to a thin bar. A plate then uses up to a third less filament. The bins sit on the corner posts only.

Split pieces keep the eco plate setting. With <Ui k="baseplate.stackPrint.enable" /> on, the eco plate stays only when <Ui k="baseplate.stackPrint.mixedSizes.label" /> is also on.

## Print plates in a stack

<Ui k="baseplate.stackPrint.enable" /> prints the plates of the drawer as a tower. The bottom plate prints right side up. Each plate above it prints upside down, with a thin air gap below it. After the print, you break the plates apart.

1. In the baseplate generator, turn on <Ui k="baseplate.stackPrint.enable" />. It is above the <Ui k="baseplate.sectionBase" /> section.
2. Set <Ui k="baseplate.stackPrint.gap.label" />. The default is 0.2 mm, which is one layer. The range is 0.1 to 1 mm.
3. In <Ui k="common.physicalUnits" />, set <Ui k="baseplate.maxPrintHeight" /> to the maximum Z height of your printer. The default is 250 mm.
4. Read the message below the settings. It tells you how many plates go into how many print files.

By default, pieces with the same shape stack together, up to the number that the drawer needs. A stack that is taller than the build height splits into more files.

<Screenshot id="baseplates-stack-section" alt="The Vertical stack settings with a gap of 0.2 mm and a message that counts the plates and print files." spec="Baseplate generator, 12 by 8 plate on a 256 mm bed so that it splits into identical pieces. Vertical stack on and expanded, Gap 0.2, Complete sets 1. Show the green output message. Preview shows the towers. Crop to the panel section and the preview." />

### Print more than one set

<Ui k="baseplate.stackPrint.copies.label" /> prints the whole baseplate more than once, for example for several drawers of the same size. At 1, each plate prints once. Each extra set adds one copy of every plate, up to 20 sets.

### Stack plates of different sizes

A split drawer often has pieces of different sizes, so each size makes its own small stack. Turn on <Ui k="baseplate.stackPrint.mixedSizes.label" /> to put pieces of different sizes in one tower. Each plate turns to line up its grid with the plate below. A piece with a shaped edge or a half-grid edge stacks only with pieces like it.

::: tip
Open the file in your slicer and print a small test before you print a full tower of mixed sizes.
:::

### What a stack changes

A flipped plate must print without supports. So <Ui k="baseplate.stackPrint.enable" /> removes these features while it is on:

- <Ui k="baseplate.magnetHoles" />
- <Ui k="baseplate.screwHoles.label" />
- <Ui k="baseplate.mountMagnets.label" />
- <Ui k="baseplate.solidFloor" />
- The <Ui k="baseplate.connectorStyle.snapClip" /> connector

The other connector styles and a corner radius stay. When you turn off the stack, your settings come back. Each stacked plate is also 0.4 mm shorter, so that the plates meet on a flat ridge. Bins sit in these plates in the same way.

A STEP export never stacks.

## Test the gap and separate the plates

Click <Ui k="baseplate.stackPrint.sampleButton" /> in the stack settings. You get a stack of two 1 by 1 plates, to tune the gap before you print a full tower.

To print a stack:

1. Print the file exactly as it is. Do not turn it or lay it flat.
2. Do not add supports.
3. Set the layer height in your slicer to the gap or less. A taller layer fills the gap and joins the plates.

To separate the plates, put a flat-head screwdriver in each gap and turn it gently.

With two materials, you can print the gap in a material that does not bond, such as PETG between PLA plates. Make the gap about 0.4 mm first. The <Ui k="baseplate.stackPrint.tips.heading" /> help and [Slicer setup](../printing/slicers#stack-printed-plates) give the slicer settings.

To look between the plates in the preview, use the <Ui k="baseplate.stackPrint.separate" /> slider.

## Control the plate height

A standard plate is 4.65 mm tall. These settings change the height:

| Setting                                 | Change in height                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------- |
| <Ui k="baseplate.lowProfileBase" />     | 1.1 mm lower. Bins get 1.1 mm more room inside at the same height.                           |
| <Ui k="baseplate.magnetHoles" />        | Taller by the magnet depth plus 0.5 mm                                                       |
| <Ui k="baseplate.solidFloor" />         | Taller by <Ui k="baseplate.solidFloorThickness" />, from 0.4 to 5 mm. The default is 0.8 mm. |
| <Ui k="baseplate.screwHoles.label" />   | A little taller if a screw must go in the pocket floor                                       |
| <Ui k="baseplate.mountMagnets.label" /> | No change                                                                                    |
| <Ui k="baseplate.stackPrint.enable" />  | 0.4 mm lower                                                                                 |

To keep a screw-down plate at the standard height, use a <Ui k="baseplate.screwHoles.headStyle.countersink" /> with a head diameter of 6 mm. The screws then fit in the solid corners where four pockets meet. See [Magnets and screws](./magnets-and-screws#keep-the-plate-at-standard-height).

## Next steps

- [Split for your print bed](./splitting): control the pieces that go into each stack.
- [Slicer setup](../printing/slicers): slice a stack and set up two materials.
- [The print list and ZIP export](../printing/print-list-and-zip): export the plate with all the bins of the layout.
