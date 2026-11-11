---
title: Make your first baseplate
description: 'Size a baseplate from your layout, add magnet holes, split it for your print bed, and export it.'
sources:
  - src/features/baseplate/hooks/useBaseplateFirstRun.ts
  - src/features/baseplate/components/BaseplatePanel/DimensionsSection.tsx
  - src/features/baseplate/components/BaseplatePanel/BaseSection.tsx
  - src/features/baseplate/components/BaseplatePanel/PhysicalUnitsSection.tsx
  - src/features/baseplate/components/BaseplatePanel/SplitViewStrip.tsx
  - src/features/baseplate/components/BaseplatePage/BaseplatePage.tsx
  - src/core/baseplateDefaults.ts
---

# Make your first baseplate

The baseplate is the grid in the bottom of your drawer that your bins drop into. Let's make one. You'll take the size from your layout, add magnet holes if you want them, split the plate to fit your printer, and export the files.

Do the [first drawer tutorial](./first-drawer) first, so that your layout has the size of your real drawer.

## Step 1: Open the baseplate generator

Click <Ui k="toolSwitcher.baseplateGenerator" /> in the tool switcher at the top left. You can also open the [baseplate generator](https://gridfinitylayouttool.com/baseplate) directly.

On your first visit, a card titled <Ui k="baseplate.quickstart.title" /> explains how the baseplate generator works. Click <Ui k="baseplate.quickstart.dismiss" /> to close it, or make a change and it closes by itself. On a phone, the card does not show.

The settings panel is on the left, and the 3D preview of the plate is on the right.

## Step 2: Check the size

You don't have to type the size again. The baseplate generator works on your active layout, and <Ui k="baseplate.syncWithLayout" /> in the <Ui k="baseplate.sectionDimensions" /> group is on by default. The plate then has the same size as the drawer grid in the layout editor.

While sync is on, you can't change the <Ui k="baseplate.gridWidth" /> and <Ui k="baseplate.gridDepth" /> steppers. Change the drawer in the layout editor, and the plate changes with it.

Look at the size line under the steppers. It shows the plate size in millimeters. The plate must be smaller than the inside of your drawer.

<Screenshot id="getting-started-first-baseplate-dimensions" alt="The dimensions group of the baseplate generator, with sync with layout on and the plate size in millimeters." spec="Baseplate generator, desktop 1440 px, active layout with a 9 x 7 grid, defaults otherwise. Crop to the dimensions group at the top of the panel." />

::: tip
Want the plate to fill the drawer to the edges? Click the size line, then type the inside size of your drawer in millimeters. The baseplate generator picks the largest grid that fits and fills the gap at the sides with <Ui k="baseplate.padding" />. This turns off <Ui k="baseplate.syncWithLayout" />.
:::

## Step 3: Add magnet holes

Magnets are optional. Add them if your bins also have magnets, or if the drawer gets hard use. Not sure? Skip them. The feet hold bins well in a drawer that gets normal use.

1. Open the <Ui k="baseplate.sectionBase" /> group, and turn on <Ui k="baseplate.magnetHoles" />.
2. Set <Ui k="baseplate.magnetDiameter" /> and <Ui k="baseplate.magnetDepth" /> to suit your magnets.

The default holes are 6.5 mm wide and 2 mm deep, which suits the common 6 × 2 mm disc magnet. The preview shows the holes in the plate.

## Step 4: Split the plate for your print bed

A drawer is often larger than a print bed. When the plate is too large, the baseplate generator splits it into pieces for you. It only needs to know the size of your bed.

1. Open the <Ui k="common.physicalUnits" /> group.
2. Set <Ui k="baseplate.printBedSize" /> to the width and depth of your print bed in millimeters. The default is 256 × 256 mm.

This is the same print bed size that the layout editor uses. If the plate is too large for the bed, a map of the pieces shows at the bottom of the panel. Each piece has a label, such as A1 or B2. The map also tells you how many build-plate loads the pieces need.

<Screenshot id="getting-started-first-baseplate-split" alt="The map of a baseplate split into four labeled pieces, with the split plate in the 3D preview." spec="Baseplate generator, desktop 1440 px, plate 9 x 7 grid units, print bed 220 x 220 mm. Scroll the panel to the split map at the bottom. Show the panel and the preview side by side." />

Want the seams somewhere else? Click a line on the map to add or remove a split. To go back to the automatic split, click <Ui k="baseplate.splitResetAuto" />.

When the plate splits, a <Ui k="baseplate.connectors.label" /> option shows in the <Ui k="baseplate.sectionBase" /> group. It starts at <Ui k="baseplate.connectors.none" />, and the pieces sit side by side. Pick a connector style if you want the pieces to lock together.

## Step 5: Export the plate

1. Click <Ui k="common.export" /> (the download icon) in the header.
2. Under <Ui k="export.format" />, pick 3MF, STL or STEP.
3. For a split plate, keep <Ui k="baseplate.export.enableSplit" /> on.
4. Click the download button at the bottom of the window.

A split plate comes as one ZIP file. It holds one file for each piece, named with the piece label, and a print guide. Print each piece flat on the bed, with no supports.

After your first export, a message says <Ui k="baseplate.plannerBridge.message" />. Click <Ui k="baseplate.plannerBridge.action" /> to go back to your drawer layout.

## Next steps

- [Baseplate basics](../baseplates/basics): all the size and shape options
- [Magnets and screws](../baseplates/magnets-and-screws): magnet sizes, screw holes and magnets under the plate
- [Split for your print bed](../baseplates/splitting): connector styles, fit and custom splits
- [Eco plates and stack printing](../baseplates/eco-and-stack-printing): use less filament and print plates in a stack
