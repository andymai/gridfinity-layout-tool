---
title: Eco plates and stack printing
description: 'Print baseplates with less filament, stack many plates in one print job, and control plate height.'
sources:
  - src/features/baseplate/components/BaseplatePanel/StackPrintSection.tsx
  - src/features/baseplate/components/BaseplatePanel/BaseSection.tsx
  - src/features/baseplate/utils/stackPrint.ts
  - src/features/baseplate/utils/stackPlanning.ts
  - src/features/baseplate/hooks/useStackPrintStatus.ts
  - src/features/baseplate/utils/buildFullParams.ts
  - src/shared/generation/ecoPlate.ts
  - src/core/types/baseplate.ts
  - src/shared/printSettings/baseplateHeight.ts
---

# Eco plates and stack printing

A drawer full of baseplates takes a lot of filament and a lot of print jobs. Two options cut both down. An **eco plate** leaves out plastic that the bins don't need. **Stack printing** builds a tower of plates, so one print job makes many plates.

## Save filament with an eco plate

In the baseplate generator, open <Ui k="baseplate.sectionBase" /> and turn on <Ui k="baseplate.ecoPlate" />.

The Layout Tool cuts the straight joints between the corner posts down to a thin bar. A plate then uses up to a third less filament. The bins sit on the corner posts only.

Split pieces keep the eco plate setting. With <Ui k="baseplate.stackPrint.enable" /> on, the eco plate stays only when <Ui k="baseplate.stackPrint.mixedSizes.label" /> is also on.

## Print plates in a stack

<Ui k="baseplate.stackPrint.enable" /> prints the plates of your drawer as one tower. The bottom plate prints right side up. Each plate above it prints upside down, with a thin air gap below it. After the print, you break the plates apart.

1. In the baseplate generator, turn on <Ui k="baseplate.stackPrint.enable" />. It sits above the <Ui k="baseplate.sectionBase" /> section.
2. Set <Ui k="baseplate.stackPrint.gap.label" />. The range is 0.1 to 1 mm. Not sure? Keep the default of 0.2 mm, which is one layer.
3. In <Ui k="common.physicalUnits" />, set <Ui k="baseplate.maxPrintHeight" /> to the maximum Z height of your printer. The default is 250 mm.
4. Read the message below the settings. It tells you how many plates go into how many print files.

By default, pieces with the same shape stack together, up to the number that the drawer needs. A stack that is taller than the build height splits into more files.

<Screenshot id="baseplates-stack-section" alt="Vertical stack is turned on, and its settings open with a gap of 0.2 mm and a message that counts the plates and print files. In the preview, the Separate slider then pulls the tower of four plates apart." spec="Baseplate generator, 12 by 8 plate on a 256 mm bed, so that it splits into four identical pieces. Turn on Vertical stack in a close-up of the panel. Then, in the iso preview, drag the Separate slider to the top." />

### Print more than one set

Do you have several drawers of the same size? <Ui k="baseplate.stackPrint.copies.label" /> prints the whole baseplate more than once. At 1, each plate prints once. Each extra set adds one copy of every plate, up to 20 sets.

### Stack plates of different sizes

A split drawer often has pieces of different sizes, so each size makes its own small stack. Turn on <Ui k="baseplate.stackPrint.mixedSizes.label" /> to put pieces of different sizes in one tower. Each plate turns to line up its grid with the plate below. A piece with a shaped edge or a half-grid edge stacks only with pieces like it.

::: tip
Open the file in your slicer and print a small test before you print a full tower of mixed sizes.
:::

### What a stack changes

A flipped plate must print without supports. So while <Ui k="baseplate.stackPrint.enable" /> is on, it removes these features:

- <Ui k="baseplate.magnetHoles" />
- <Ui k="baseplate.screwHoles.label" />
- <Ui k="baseplate.mountMagnets.label" />
- <Ui k="baseplate.solidFloor" />
- The <Ui k="baseplate.connectorStyle.snapClip" /> connector

The other connector styles and a corner radius stay. You lose nothing: when you turn off the stack, your settings come back.

Each stacked plate is also 0.4 mm shorter, so that the plates meet on a flat ridge. Bins sit in these plates in the same way. A STEP export never stacks.

## Test the gap and separate the plates

Click <Ui k="baseplate.stackPrint.sampleButton" /> in the stack settings. You get a stack of two 1 by 1 plates. It's a cheap way to tune the gap before you print a full tower.

Slice the tower exactly as it is in the file, with no supports. Keep the layer height at the gap or less, or the plates fuse together. [Stack-printed plates](../printing/slicers#stack-printed-plates) gives the slicer steps.

To separate the plates, put a flat-head screwdriver in each gap and turn it gently.

Have two materials? Print the gap in a material that doesn't bond, such as PETG between PLA plates. Make the gap about 0.4 mm first. The <Ui k="baseplate.stackPrint.tips.heading" /> help and [Slicer setup](../printing/slicers#stack-printed-plates) give the slicer settings.

To look between the plates in the preview, drag the <Ui k="baseplate.stackPrint.separate" /> slider.

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

## When it goes wrong

A message in the stack settings tells you when a stack can't form. Here's what each one means.

### The message says there's nothing to stack

Does your baseplate split into pieces? Turn on <Ui k="baseplate.stackPrint.mixedSizes.label" />, so that pieces of different sizes share a tower. Is it one plate? Raise <Ui k="baseplate.stackPrint.copies.label" /> to 2 or more. The stack then holds copies of your plate.

By default, only plates with the same shape stack together. Your baseplate fits the bed in one piece, or each piece has a different shape. So one set has no pair to stack.

### Each plate prints as its own file

Change the margins, or set a larger <Ui k="baseplate.printBedSize" /> if your printer has the room.

A plate stacks only on a plate that holds it safely. With the margins and outlines that you have, no piece can rest on another one.

### Only one plate fits in each stack, or a plate won't print

Set <Ui k="baseplate.maxPrintHeight" /> to the real Z height of your printer. If that is already right, make the <Ui k="baseplate.stackPrint.gap.label" /> smaller.

The stack can't be taller than the build height. When the limit is low, each tower holds only one plate. When a single plate is taller than the limit, the message tells you that it won't print.

### Stacked plates stick together

See [Stacked plates stick together](../printing/troubleshooting#stacked-plates-stick-together). Print the stack fit test before the next full tower.

## Next steps

- [Split for your print bed](./splitting): control the pieces that go into each stack.
- [Slicer setup](../printing/slicers): slice a stack and set up two materials.
- [The print list and ZIP export](../printing/print-list-and-zip): export the plate with all the bins of the layout.
