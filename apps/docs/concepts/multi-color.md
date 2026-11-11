---
title: Multi-color printing
description: 'Learn how color zones become filaments in a 3MF file, and what happens when you print a bin in one color.'
sources:
  - src/features/bin-designer/types/featureColors.ts
  - src/features/bin-designer/utils/materialMapping.ts
  - src/features/generation/export/threemfExporter.ts
  - src/features/generation/export/threemfColor.ts
  - src/features/bin-designer/components/panel/ColorsSection/
  - src/features/bin-designer/components/ExportDialog/ExportDialog.tsx
  - src/features/generation/README.md
---

# Multi-color printing

The bin designer can give each part of a bin its own filament color. The export writes a 3MF file in which each part carries its color. A printer with an AMS or another multi-material system then prints the bin in one job. This page explains color zones, what the 3MF file holds, and what happens when you print in one color.

## Color zones

A color zone is a part of the bin that takes one color. Turn on <Ui k="binDesigner.group.colors" /> in the <Ui k="binDesigner.group.finishing" /> group to see the zones. The designer shows a zone only when the bin has that part. For example, the <Ui k="binDesigner.colors.scoop" /> zone appears only on a bin with a finger scoop.

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

The stacking lip can have more than one color. Turn on <Ui k="binDesigner.colors.lip.splitZones" />, then set <Ui k="binDesigner.colors.lip.cornersLabel" /> and <Ui k="binDesigner.colors.lip.bandsLabel" />. Each axis takes 1, 2 or 4, so the lip has up to 16 colored cells.

An accent band colors the top or the bottom of the body. It needs no stacking lip or feet, and it covers every zone under it except text.

Cutouts can have their own colors too. Set the color in the <Ui k="binDesigner.cutouts.section.color" /> section of a cutout, and pick <Ui k="binDesigner.cutouts.color.floor" /> or <Ui k="binDesigner.cutouts.color.floorAndWalls" />. A colored cutout makes the design multi-color, even when the <Ui k="binDesigner.group.colors" /> switch is off.

<Screenshot id="concepts-multi-color-zones" alt="The Multi-color section of the bin designer with zone colors and a bin with a two-color stacking lip in the preview." spec="Bin designer, desktop. Bin 2 × 2 × 4u, stacking lip on, label tabs on with text Bolts, finger scoop on. Finishing group open at Multi-color, on. Body light grey, stacking lip split into 2 bands (orange top, grey bottom), label tab white, text black. Crop to the zone list and the preview." />

## How the 3MF file carries the colors

The export turns colors into filaments:

- Each different color in the design becomes one filament in the file. The body color is filament 1.
- Zones with the same color share one filament.
- Each triangle of the model carries a paint code that names its filament. Bambu Studio, OrcaSlicer and PrusaSlicer read these codes.
- The lid is a separate object in the file, and it takes the lid color.
- One 3MF file holds up to 16 filaments. When a file holds several bins, all bins share one list of filaments.

In the export dialog, <Ui k="binDesigner.colors.slicerHandoff.show" /> lists the filaments with the numbers that the slicer shows.

The file does not set the filament colors in your slicer. In the slicer, assign each filament to an AMS or MMU slot that holds the right color.

The file carries no slicer settings, so your own print profile stays in use. For this reason, Bambu Studio shows a notice that the file is not from Bambu Lab, and it loads only the geometry and the colors.

::: tip
When a 3MF file holds several parts, the slicer can put them all on one plate. Use the arrange command of your slicer to spread them out.
:::

## Print in one color

A design with color zones still prints on a printer with one filament. These rules decide what the export does:

- When <Ui k="binDesigner.group.colors" /> is off, the preview shows one body color, and the 3MF file carries no color data.
- When every zone has the body color, the design is single-color, and the 3MF file carries no color data.
- STL and STEP files carry no colors. For a multi-color design, the export dialog turns off these formats and selects 3MF.
- A split export prints each piece in one color.

To print a multi-color design in one color, turn off <Ui k="binDesigner.group.colors" />, or use <Ui k="binDesigner.colors.matchAllToBody" />.

::: warning
Do not use <Ui k="binDesigner.textMode.flat" /> text on a single-color print. Flat text is level with the surface, so it shows only in a second filament.
:::

You can also get two colors from a printer with one filament. Swappable label plates put the text depth on whole layers, so one filament change gives two-color labels.

## Next steps

- [Colors](../designer/colors): set zone colors, palettes and the eyedropper step by step
- [Slicer setup](../printing/slicers): open the 3MF file and assign filaments in your slicer
- [Swappable label plates](../designer/label-plates): print two-color labels with one filament change
- [Fitting the print bed](./print-bed-fit): see why a split bin loses its colors
