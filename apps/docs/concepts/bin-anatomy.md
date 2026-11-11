---
title: Anatomy of a bin
description: 'Learn each part of a Gridfinity bin, from the feet to the lid, and where to set it.'
sources:
  - src/shared/printSettings/gridfinityGeometry.ts
  - src/features/bin-designer/components/ParameterPanel/BinScrollPanel/BinScrollPanel.tsx
  - src/features/bin-designer/components/panel/BaseSection/
  - src/features/bin-designer/components/panel/InteriorSection/
  - src/features/bin-designer/components/panel/LidSection/
  - src/features/bin-designer/constants/defaults.ts
---

# Anatomy of a bin

Every Gridfinity bin has the same parts from the bottom up: feet, a floor, walls and a stacking lip. Inside, it can have compartments, label tabs and a scoop, and on top it can have a lid. This page names each part the way the bin designer names it, so you know where to look for each option.

<Screenshot id="concepts-bin-anatomy-overview" alt="A bin in the designer preview with a stacking lip, two compartments, a label tab and a finger scoop." spec="Bin designer, desktop. Bin 2 × 2 × 4u, standard base with magnet holes, stacking lip on, 2 compartments side by side, label tabs on with texts Screws and Nuts, finger scoop on. Preview at the default front-right angle. Crop to the preview." />

## Where each part lives in the bin designer

The bin designer panel puts the parts in five groups:

| Group                                  | Parts in the group                                              |
| -------------------------------------- | --------------------------------------------------------------- |
| <Ui k="binDesigner.group.shape" />     | Size, footprint, walls and wall cutouts                         |
| <Ui k="binDesigner.group.lid" />       | Lid, pull tab and handles                                       |
| <Ui k="binDesigner.group.interior" />  | Compartments and dividers, label tabs, fillet and finger scoop  |
| <Ui k="binDesigner.group.base" />      | Body type, stacking lip, magnet and screw holes, feet and floor |
| <Ui k="binDesigner.group.finishing" /> | Text, colors, wall surface, floor pattern and physical units    |

## Feet

Each grid cell under the bin has a foot. The foot is 4.75 mm tall, with sloped sides at 45°. It drops into a pocket of the baseplate and stops the bin from sliding. The outer walls of the bin are 0.5 mm smaller than its cells, so the feet drop in without force.

The <Ui k="binDesigner.group.base" /> group holds the options for the feet:

- <Ui k="binDesigner.base.section.mounting" /> adds <Ui k="binDesigner.base.magnetHoles" /> or <Ui k="binDesigner.base.screwHoles" /> under the feet. The magnet holes start at 6.5 mm wide and 2 mm deep, for 6 mm magnets. The screw holes start at 3 mm, for M3 screws.
- <Ui k="binDesigner.base.section.feet" /> holds <Ui k="binDesigner.halfSockets" />, a denser grid of smaller feet. It also holds <Ui k="binDesigner.detachableFeet" />, feet that you print as separate parts and attach with pins.

<Ui k="binDesigner.base.bodyType" /> changes the bin as a whole:

| Body type                                     | What you get                                                     |
| --------------------------------------------- | ---------------------------------------------------------------- |
| <Ui k="binDesigner.base.bodyType.standard" /> | Feet, floor and walls: the usual Gridfinity bin                  |
| <Ui k="binDesigner.base.bodyType.nesting" />  | One tapered base that nests in the lip of a bin of the same size |
| <Ui k="binDesigner.flatFloor" />              | A flat bottom that does not lock into a baseplate                |
| <Ui k="binDesigner.spacer" />                 | An open riser with no floor, to lift a bin                       |
| <Ui k="binDesigner.tile" />                   | Feet and floor with no walls                                     |
| <Ui k="binDesigner.lidBottom" />              | An underside that is a lid, so the bin sits on another bin       |

## Floor

The floor sits on the feet. On a standard bin, the first height unit (7 mm) holds the feet and the floor, and the space for items starts above it.

Under <Ui k="binDesigner.base.section.floor" />, <Ui k="binDesigner.lightweight" /> hollows the feet to use less filament. It has two modes:

- <Ui k="binDesigner.lightweightMode.interior" /> hollows each foot from the inside. It saves the most filament, but small items can settle into the hollows.
- <Ui k="binDesigner.lightweightMode.underside" /> hollows each foot from below and keeps the floor flat.

<Ui k="binDesigner.base.floorPattern" /> in the <Ui k="binDesigner.group.finishing" /> group cuts holes through the floor and the feet, so water and dust fall through.

## Walls

The walls stand on the floor and set the outer size of the bin. In the <Ui k="binDesigner.group.shape" /> group, <Ui k="binDesigner.style.section.walls" /> holds <Ui k="binDesigner.wallThickness" />. The bin designer starts at 1.2 mm, three lines of a 0.4 mm nozzle. Use a multiple of your nozzle size for the best result.

<Ui k="binDesigner.wallCutouts" /> cut openings through the walls, for cables or front access. <Ui k="binDesigner.style.section.wallSurface" /> in the <Ui k="binDesigner.group.finishing" /> group cuts a pattern of holes through the walls.

## Stacking lip

The stacking lip is the rim on top of the walls. It is 4.4 mm tall, and the feet of another bin sit in it. The option is <Ui k="assembledHeight.stackingLip" />, in the <Ui k="binDesigner.group.base" /> group under <Ui k="binDesigner.base.section.stacking" />. It sits with the feet because it is the partner of the feet of the bin above.

Without a stacking lip, no bin can stack on top, and a lid that sits on the bin has nothing to grip. A slanted bin has no stacking lip.

## Interior

The <Ui k="binDesigner.group.interior" /> group sets what is inside the walls. First pick one of four interior styles:

| Interior style                                 | What it makes                                       |
| ---------------------------------------------- | --------------------------------------------------- |
| <Ui k="binDesigner.interior.standard.title" /> | Compartments in a grid, with fixed divider walls    |
| <Ui k="binDesigner.interior.bento.title" />    | Compartments of any size, with walls where you want |
| <Ui k="binDesigner.interior.slotted.title" />  | Slots that hold dividers you print separately       |
| <Ui k="binDesigner.interior.solid.title" />    | A solid bin with tool-shaped cutouts in the top     |

Then add the parts that help you find and remove items:

- <Ui k="binDesigner.labelTabs" /> are tabs with a slope along a compartment edge. A label sits on each tab.
- <Ui k="binDesigner.fingerScoop" /> is a ramp from the floor up to a wall, so you can slide small parts out. The front wall is the default.
- <Ui k="binDesigner.interiorFillet.label" /> rounds the edges where the walls meet the floor.

A bin with a custom footprint (an L, T or U shape, for example) cannot have compartments, dividers, label tabs or a scoop. These parts need a rectangular bin.

## Lid

The <Ui k="binDesigner.group.lid" /> group adds a lid with <Ui k="binDesigner.lid.enable" />. The lid is a separate part in the export. Pick how it attaches under <Ui k="binDesigner.lid.section.attaches" />:

- <Ui k="binDesigner.lid.attachment.friction" />, <Ui k="binDesigner.lid.attachment.clickRails" />, <Ui k="binDesigner.lid.attachment.magnetic" /> and <Ui k="binDesigner.lid.attachment.hinge" /> lids sit on the stacking lip, so they need it.
- A <Ui k="binDesigner.lid.attachment.slide" /> lid runs in a channel of its own.

The top of the lid can be <Ui k="binDesigner.lid.topSurface.flat" />, <Ui k="binDesigner.lid.topSurface.stackable" /> or <Ui k="binDesigner.lid.topSurface.tray" />. A stackable top has a grid of sockets, so bins can stand on the lid.

## Next steps

- [The base](../designer/base): set the feet, magnets, screws and floor
- [Walls](../designer/walls): set the wall thickness, patterns and cutouts
- [Compartments and dividers](../designer/compartments): divide the inside of a bin
- [Lids](../designer/lids): add a lid and pick how it attaches
- [Units and sizes](./units): see how the parts add up in height
