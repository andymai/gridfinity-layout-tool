---
title: Lidded boxes that stack
description: 'Parts boxes with magnetic lids that keep parts in their compartments and stack on a shelf.'
sources:
  - src/features/bin-designer/types/lid.ts
  - src/features/bin-designer/components/panel/LidSection/
  - src/features/bin-designer/utils/lidCompatibility.ts
  - src/features/generation/worker/generators/lidBuilder.ts
  - src/features/bin-designer/types/text.ts
---

# Lidded boxes that stack

A box of small parts that goes to a job needs a lid that stays shut. The parts must also stay in their own compartments when the box tips. This recipe makes four parts boxes for a repair kit. Magnets hold each lid shut, and the lid fills the space above the dividers. A grid on top of each lid locks the next box on, so a stack on a shelf stays put. The boxes have standard Gridfinity feet, so they also fit a baseplate in a drawer.

<Screenshot id="recipes-lidded-boxes-hero" alt="A 3 by 2 box with six compartments in the bin designer preview. Its lid floats above it, with a grid of Gridfinity sockets on top, and FUSES is cut into the front wall of the box." spec="Bin designer, desktop 1440 px, the Fuses box of this recipe: 3 x 2 x 6, Grid dividers 3 x 2, magnetic lid with Lid fill, Stackable top with Separate baseplate, wall text FUSES on the front, outside. Isometric view from the front right. Crop to the preview." />

## What you need

- A print bed that takes a part of 126 × 84 mm, the size of each box.
- 32 round magnets of 6 × 2 mm: 8 for each box, one in each corner of the box and of the lid.
- Super glue for the magnets and the stack plates.

## The plan

Each box is 3 × 2 × 6 with 6 compartments, so you make one design and copy it. Only the name on the front changes.

| Box        | Holds                          |
| ---------- | ------------------------------ |
| FUSES      | Blade and glass fuses          |
| TERMINALS  | Crimp terminals                |
| CONNECTORS | Wire connectors and splices    |
| SCREWS     | Small screws, nuts and washers |

Each compartment is about 40 × 40 mm and 35 mm deep. With its lid, a box stands 52.9 mm tall.

## Step 1: Size the box

1. Click <Ui k="toolSwitcher.binDesigner" /> in the header to open the bin designer.
2. Click the button next to the design name, then click <Ui k="binDesigner.newDesign" />.
3. Click the name in the header, and type Fuses box.
4. In the <Ui k="binDesigner.group.shape" /> group, set <Ui k="common.width" /> to 3, <Ui k="common.depth" /> to 2 and <Ui k="common.height" /> to 6.

The readout under the size shows 126 × 84 × 42 mm, and 123.1 × 81.1 × 35 mm inside.

## Step 2: Divide the box

In the <Ui k="binDesigner.group.interior" /> group, set <Ui k="binDesigner.columns" /> to 3 and <Ui k="binDesigner.rows" /> to 2. The panel shows the size of each compartment, about 39.8 × 39.9 mm.

## Step 3: Add a magnetic lid

1. Open the <Ui k="binDesigner.group.lid" /> group, and turn on <Ui k="binDesigner.lid.enable" />.
2. Under <Ui k="binDesigner.lid.section.attaches" />, pick <Ui k="binDesigner.lid.attachment.magnetic" />.
3. Turn on <Ui k="binDesigner.lid.fill" />.

The magnets pull the lid shut. <Ui k="binDesigner.lid.fill" /> fills the lid down to just above the dividers, so small parts stay in their own compartment when the box tips.

<Screenshot id="recipes-lidded-boxes-lid" alt="In the Lid group, Lid is turned on and Magnetic is picked. The hint asks for a 6 by 2 mm magnet in each corner of the bin and lid. Then Lid fill is turned on." spec="Clip. Bin designer, the 3 x 2 x 6 box with Grid dividers 3 x 2. Close-up of the Lid group: turn on Lid, pick Magnetic, turn on Lid fill. Then show the box and its lid in the preview." />

## Step 4: Put a grid on the lid

1. Under <Ui k="binDesigner.lid.section.topSurface" />, pick <Ui k="binDesigner.lid.topSurface.stackable" />.
2. Turn on <Ui k="binDesigner.lid.separateStackPlate" />.

<Screenshot id="recipes-lidded-boxes-stack-top" alt="Under Top surface, Stackable is picked. Its options show below it, and Separate baseplate (glue-on) is turned on." spec="Bin designer, the finished Fuses box. Crop the side panel from the Top surface heading to the Separate baseplate switch." />

The lid now has a grid of Gridfinity sockets on top. The box above locks onto it, as a box locks into a baseplate. With the separate plate, the grid prints flat as its own part, and the lid prints without supports. You glue the plate onto the lid after the print.

## Step 5: Put the name on the front

1. In the <Ui k="binDesigner.group.finishing" /> group, turn on <Ui k="binDesigner.walls.text.heading" />.
2. Type FUSES in the box for the front wall. Keep <Ui k="binDesigner.walls.text.face.outside" />.

On a shelf, you read the front of each box. The lid can't carry the name, because the grid covers its top.

## Step 6: Copy the box and export

1. Click the button next to the design name to open <Ui k="binDesigner.savedDesigns" />. Use <Ui k="common.duplicate" /> on the Fuses box three times.
2. Open each copy, and change its name and its front text to TERMINALS, CONNECTORS or SCREWS.
3. For each design, click the download icon in the header, pick a format, and download.

The bin designer saves each change, so you never press save. An STL export is a ZIP with one file for each part: the box, the lid and the stack plate. See [File formats](../printing/file-formats).

## Step 7: Print and fit the magnets

1. Print the box, the lid and the stack plate.
2. Glue the stack plate onto the lid top, with the grid up.
3. Glue a magnet into each corner of the box, all with the same side up.
4. Put a loose magnet on a box magnet, so that the two pull together. Mark the top of the loose magnet with a pen.
5. Glue that magnet into a corner pocket of the lid, with the marked side into the pocket. Do the same for each corner.
6. Before the glue sets, put the lid on, and make sure that each corner pulls shut.

## When it goes wrong

### You can't find Lid fill

Pick <Ui k="binDesigner.lid.attachment.magnetic" /> or <Ui k="binDesigner.lid.attachment.friction" /> under <Ui k="binDesigner.lid.section.attaches" />. The other attachments have no <Ui k="binDesigner.lid.fill" />, so the switch doesn't show.

### One corner of the lid pushes away

The lid magnet in that corner is the wrong way round. Before the glue sets, take it out and turn it over.

### The box on top slides off the lid

Make sure that the stack plate sits with the grid up, and that the glue holds it flat on the lid. The feet of the box above must drop into the sockets of the grid.

## Next steps

- [Lids](../designer/lids): every way a lid can attach, and its top, grip and holes
- [Stacking](../designer/stacking): the stacking lip, and boxes that nest on each other with no lid
- [Labels and text](../designer/labels-and-text#add-wall-text): wall text styles and finishes
- [File formats](../printing/file-formats): pick STL, 3MF or STEP
