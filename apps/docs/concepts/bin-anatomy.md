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
  - src/shared/constraints/rules.ts
---

# Anatomy of a bin

Learn the parts of a bin, and you'll know where to find every option in the bin designer. From the bottom up, every Gridfinity bin has feet, a floor, walls and a stacking lip. Inside, it can have compartments, label tabs and a scoop. On top, it can have a lid.

This page names each part the way the bin designer does, and tells you which group to open for it.

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

Each grid cell under the bin has a **foot**. The foot is 4.75 mm tall, with sloped sides at 45°. It drops into a pocket of the baseplate and stops the bin from sliding around. The outer walls of the bin are 0.5 mm smaller than its cells, so the feet drop in without force.

The <Ui k="binDesigner.group.base" /> group holds the options for the feet.

**Holes under the feet.** <Ui k="binDesigner.base.section.mounting" /> holds the holes. <Ui k="binDesigner.base.magnetHoles" /> start at 6.5 mm wide and 2 mm deep, for 6 mm magnets. <Ui k="binDesigner.base.screwHoles" /> start at 3 mm, for M3 screws.

**The feet themselves.** <Ui k="binDesigner.base.section.feet" /> holds <Ui k="binDesigner.halfSockets" />, a denser grid of smaller feet. It also holds <Ui k="binDesigner.detachableFeet" />, feet that you print as separate parts and attach with pins.

<Ui k="binDesigner.base.bodyType" /> changes the bin as a whole. A new design starts as a standard bin.

| Body type                                     | What you get                                                     |
| --------------------------------------------- | ---------------------------------------------------------------- |
| <Ui k="binDesigner.base.bodyType.standard" /> | Feet, floor and walls: the usual Gridfinity bin                  |
| <Ui k="binDesigner.base.bodyType.nesting" />  | One tapered base that nests in the lip of a bin of the same size |
| <Ui k="binDesigner.flatFloor" />              | A flat bottom that does not lock into a baseplate                |
| <Ui k="binDesigner.spacer" />                 | An open riser with no floor, to lift a bin                       |
| <Ui k="binDesigner.tile" />                   | Feet and floor with no walls                                     |
| <Ui k="binDesigner.lidBottom" />              | An underside that is a lid, so the bin sits on another bin       |

## Floor

The floor sits on the feet. On a standard bin, the first height unit (7 mm) holds the feet and the floor, and the room for your items starts above it.

Want to save filament? Under <Ui k="binDesigner.base.section.floor" />, <Ui k="binDesigner.lightweight" /> hollows the feet. It has two modes:

- <Ui k="binDesigner.lightweightMode.interior" /> hollows each foot from the inside. It saves the most filament, but small items can settle into the hollows.
- <Ui k="binDesigner.lightweightMode.underside" /> hollows each foot from below and keeps the floor flat. Pick this one for a bin of small parts.

<Ui k="binDesigner.base.floorPattern" /> in the <Ui k="binDesigner.group.finishing" /> group cuts holes through the floor and the feet, so water and dust fall through.

## Walls

The walls stand on the floor and set the outer size of the bin. To set how thick they are, open the <Ui k="binDesigner.group.shape" /> group and find <Ui k="binDesigner.style.section.walls" />. There you set <Ui k="binDesigner.wallThickness" />.

The bin designer starts at 1.2 mm, which is three lines of a 0.4 mm nozzle. Use a multiple of your nozzle size for the best result. Not sure? Keep 1.2 mm.

Want openings for cables or front access? <Ui k="binDesigner.wallCutouts" /> cut them through the walls. <Ui k="binDesigner.style.section.wallSurface" /> in the <Ui k="binDesigner.group.finishing" /> group cuts a pattern of holes through the walls.

## Stacking lip

The **stacking lip** is the rim on top of the walls. It's 4.4 mm tall, and the feet of another bin sit in it, the same way they sit in a baseplate. Turn it on or off with <Ui k="assembledHeight.stackingLip" />. You find it in the <Ui k="binDesigner.group.base" /> group, under <Ui k="binDesigner.base.section.stacking" />. It sits with the feet because it is the partner of the feet of the bin above.

Without a stacking lip, no bin can stack on top, and a lid that sits on the bin has nothing to grip. A slanted bin has no stacking lip.

## Interior

The <Ui k="binDesigner.group.interior" /> group sets what's inside the walls. First, pick one of four interior styles:

| Interior style                                 | What it makes                                       |
| ---------------------------------------------- | --------------------------------------------------- |
| <Ui k="binDesigner.interior.standard.title" /> | Compartments in a grid, with fixed divider walls    |
| <Ui k="binDesigner.interior.bento.title" />    | Compartments of any size, with walls where you want |
| <Ui k="binDesigner.interior.slotted.title" />  | Slots that hold dividers you print separately       |
| <Ui k="binDesigner.interior.solid.title" />    | A solid bin with tool-shaped cutouts in the top     |

Then add the parts that help you find and grab your items:

- <Ui k="binDesigner.labelTabs" /> are tabs with a slope along a compartment edge. A label sits on each tab.
- <Ui k="binDesigner.fingerScoop" /> is a ramp from the floor up to a wall, so you can slide small parts out with a finger. The front wall is the default.
- <Ui k="binDesigner.interiorFillet.label" /> rounds the edges where the walls meet the floor.

A bin with a custom footprint (an L, T or U shape, for example) can't have compartments, dividers, label tabs or a scoop. These parts need a rectangular bin.

## Lid

The <Ui k="binDesigner.group.lid" /> group adds a lid with <Ui k="binDesigner.lid.enable" />. The lid is a separate part in the export. Under <Ui k="binDesigner.lid.section.attaches" />, pick how it holds on:

| Attachment                                       | What it needs                |
| ------------------------------------------------ | ---------------------------- |
| <Ui k="binDesigner.lid.attachment.friction" />   | Sits on the stacking lip     |
| <Ui k="binDesigner.lid.attachment.clickRails" /> | Sits on the stacking lip     |
| <Ui k="binDesigner.lid.attachment.magnetic" />   | Sits on the stacking lip     |
| <Ui k="binDesigner.lid.attachment.hinge" />      | Sits on the stacking lip     |
| <Ui k="binDesigner.lid.attachment.slide" />      | Runs in a channel of its own |

So for every lid except the sliding one, keep the stacking lip on.

The top of the lid can be <Ui k="binDesigner.lid.topSurface.flat" /> or <Ui k="binDesigner.lid.topSurface.tray" />. Pick <Ui k="binDesigner.lid.topSurface.stackable" /> to give it a grid of sockets, so bins can stand on the lid.

## When it goes wrong

### Label tabs and the scoop are gray

Click <Ui k="binDesigner.dependency.editFootprint" />, and make the bin a rectangle again. The gray controls tell you that they need a rectangular footprint. A bin with a custom footprint can't have compartments, dividers, label tabs or a scoop. See [Make a bin that is not a rectangle](../designer/size-and-shape#make-a-bin-that-is-not-a-rectangle).

### The lid switch is gray

Click <Ui k="binDesigner.dependency.enableStackingLip" /> under the switch. The switch shows <Ui k="binDesigner.lid.requiresStackingLip" />, because every lid except the sliding one sits on the stacking lip.

### The scoop or the fillet won't turn on

Set <Ui k="binDesigner.lightweightMode" /> to <Ui k="binDesigner.lightweightMode.underside" />. Then the bin keeps its lightweight floor and gets the scoop too. <Ui k="binDesigner.lightweightMode.interior" /> leaves no solid floor for a scoop ramp or a fillet. The same goes for drainage holes and cutouts in the top of the bin.

## Next steps

- [The base](../designer/base): set the feet, magnets, screws and floor
- [Walls](../designer/walls): set the wall thickness, patterns and cutouts
- [Compartments and dividers](../designer/compartments): divide the inside of a bin
- [Lids](../designer/lids): add a lid and pick how it attaches
- [Units and sizes](./units): see how the parts add up in height
