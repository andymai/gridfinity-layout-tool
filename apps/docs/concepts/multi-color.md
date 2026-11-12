---
title: Multi-color printing
description: 'Learn how color zones become filaments in a 3MF file, and what happens when you print a bin in one color.'
sources:
  - src/features/bin-designer/types/featureColors.ts
  - src/features/bin-designer/utils/materialMapping.ts
  - src/features/bin-designer/utils/multiColorDesign.ts
  - src/features/generation/export/threemfExporter.ts
  - src/features/generation/export/threemfColor.ts
  - src/features/bin-designer/components/panel/ColorsSection/
  - src/features/bin-designer/components/ExportDialog/ExportDialog.tsx
  - src/features/generation/README.md
  - src/features/bin-designer/components/panel/shared/FlatTextClashWarning.tsx
---

# Multi-color printing

Got a printer with an AMS or another multi-material system? Give each part of a bin its own filament color: an orange lip, white label tabs, black text. The 3MF export carries those colors to your slicer, so the whole bin prints in one job. Here's how color zones work, what the 3MF file holds, and what happens when you print in one color.

## Color zones

A **color zone** is a part of the bin that takes one color. Turn on <Ui k="binDesigner.group.colors" /> in the <Ui k="binDesigner.group.finishing" /> group to see the zones. The bin designer shows a zone only when the bin has that part. For example, the <Ui k="binDesigner.colors.scoop" /> zone appears only on a bin with a finger scoop.

| Zone                                       | What it colors                                                  |
| ------------------------------------------ | --------------------------------------------------------------- |
| <Ui k="binDesigner.colors.body" />         | The walls, the floor and all parts that no other zone covers    |
| <Ui k="binDesigner.colors.lip" />          | The stacking lip                                                |
| <Ui k="binDesigner.colors.base" />         | The feet                                                        |
| <Ui k="binDesigner.colors.scoop" />        | The finger scoop                                                |
| <Ui k="binDesigner.colors.dividers" />     | The divider walls between compartments                          |
| <Ui k="binDesigner.colors.labelTab" />     | The label tabs                                                  |
| <Ui k="binDesigner.colors.lid" />          | The lid                                                         |
| <Ui k="binDesigner.colors.text" />         | Text on tabs, walls, the floor, cutouts and the lid             |
| <Ui k="binDesigner.colors.accent.title" /> | A band at the top or the bottom of the body, in mm or in layers |

The stacking lip can have more than one color, in up to 16 colored cells. See [Split the stacking lip](../designer/colors#split-the-stacking-lip).

An **accent band** colors the top or the bottom of the body. It needs no stacking lip or feet, and it covers every zone under it except text.

Cutouts and Bento compartments can have their own colors too. Open the <Ui k="binDesigner.cutouts.section.color" /> section of a cutout. There, pick <Ui k="binDesigner.cutouts.color.floor" /> or <Ui k="binDesigner.cutouts.color.floorAndWalls" />. A compartment in a <Ui k="binDesigner.interior.bento.title" /> bin has the same choices. A colored cutout or compartment makes the design multi-color, even when the <Ui k="binDesigner.group.colors" /> switch is off.

<Screenshot id="concepts-multi-color-zones" alt="The Multi-color section of the bin designer with zone colors and a bin with a two-color stacking lip in the preview." spec="Bin designer, desktop. Bin 2 × 2 × 4u, stacking lip on, label tabs on with text Bolts, finger scoop on. Finishing group open at Multi-color, on. Body light grey, stacking lip split into 2 bands (orange top, grey bottom), label tab white, text black. Crop to the zone list and the preview." />

## How the 3MF file carries the colors

The export turns colors into filaments:

- Each different color in the design becomes one filament in the file. The body color is filament 1.
- Zones with the same color share one filament.
- Each triangle of the model carries a paint code that names its filament. Bambu Studio, OrcaSlicer and PrusaSlicer read these codes.
- The lid is a separate object in the file, and it takes the lid color.
- One 3MF file holds up to 16 filaments. When a file holds several bins, all bins share one list of filaments.

In the export dialog, <Ui k="binDesigner.colors.slicerHandoff.show" /> lists the filaments with the numbers that the slicer shows.

<Screenshot id="concepts-multi-color-export" alt="The export dialog for a bin with four colors. STL and STEP are gray, and 3MF is selected. Show filament mapping lists filaments 1 to 4 with the zones that use each one." spec="Bin designer, bin 2 × 2 × 4u with label tab text Bolts. Multi-color on: body grey, one front left lip cell orange, label tab white, text dark. Export dialog open with Show filament mapping expanded. Crop from the dialog title to Filament 4." />

The file doesn't set the filament colors in your slicer. In the slicer, assign each filament to an AMS or MMU slot that holds the right color. [Map multi-color zones to filaments](../printing/slicers#map-multi-color-zones-to-filaments) gives the steps.

The file carries no slicer settings, so your own print profile stays in use. For this reason, Bambu Studio shows a notice that the file is not from Bambu Lab, and it loads only the geometry and the colors. You can ignore that notice.

::: tip
When a 3MF file holds several parts, the slicer can put them all on one plate. Use the arrange command of your slicer to spread them out.
:::

## Print in one color

Only one filament? A design with color zones still prints fine. These rules decide what the export writes:

- STL and STEP files carry no colors. For a multi-color design, the export dialog turns off these formats and selects 3MF.
- A colored cutout or a colored Bento compartment makes the design multi-color, whatever the <Ui k="binDesigner.group.colors" /> switch says.
- With the switch off and nothing else colored, the preview shows one body color, and the 3MF file carries no color data.
- With the switch on, the design is single-color only when every zone has the body color. Then the 3MF file carries no color data.
- A split export prints each piece in one color.

To get a single-color file, and to use STL or STEP again, clear every color:

1. For each colored cutout, set <Ui k="binDesigner.cutouts.section.color" /> to <Ui k="binDesigner.cutouts.color.off" />.
2. In a Bento bin, set each colored compartment to <Ui k="binDesigner.cutouts.color.off" /> too.
3. Turn off <Ui k="binDesigner.group.colors" />.

<Ui k="binDesigner.colors.matchAllToBody" /> is only a partial shortcut. It sets the stacking lip, label tabs, feet, scoop and dividers to the body color. It leaves the text, the lid and the accent bands as they are, and it doesn't change cutout or compartment colors.

::: warning
Do not use <Ui k="binDesigner.textMode.flat" /> text on a single-color print. Flat text is level with the surface, so it shows only in a second filament.
:::

You can still get two colors from a printer with one filament. Swappable label plates put the text depth on whole layers, so one filament change gives two-color labels.

## When it goes wrong

### STL and STEP are gray in the export dialog

Export 3MF to keep the colors. For a one-color STL or STEP file, clear every color first, as [Print in one color](#print-in-one-color) shows. The export dialog turns these two formats off for a design with color, because they carry no color data. A colored cutout or Bento compartment counts too, even with the <Ui k="binDesigner.group.colors" /> switch off.

### Flat text doesn't show

Give the text a color that differs from the surface under it. If the text settings offer <Ui k="binDesigner.textColor.useContrasting" />, click it. On a printer with one filament, pick <Ui k="binDesigner.textMode.emboss" /> or <Ui k="binDesigner.textMode.engrave" /> instead. Flat letters are level with the surface, so only a second color makes them visible.

### The slicer opens the file with one filament

Add the other filaments in the slicer by hand, or update Bambu Studio to 2.9.1 or later. The colors are still in the file, but Bambu Studio 2.8 doesn't add its filaments when you open it on an empty plate. See [The colors are wrong](../printing/troubleshooting#the-colors-are-wrong).

## Next steps

- [Colors](../designer/colors): set zone colors, palettes and the eyedropper step by step
- [Slicer setup](../printing/slicers): open the 3MF file and assign filaments in your slicer
- [Swappable label plates](../designer/label-plates): print two-color labels with one filament change
- [Fitting the print bed](./print-bed-fit): see why a split bin loses its colors
