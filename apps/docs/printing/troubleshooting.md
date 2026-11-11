---
title: Troubleshooting prints
description: 'Solve common problems with exported files: tight bins, missing labels or bins, rejected 3MF files and wrong colors.'
sources:
  - src/features/bin-designer/hooks/useSyncPhysicalUnits.ts
  - src/shell/layoutExport/planLayoutBinExport.ts
  - src/shell/layoutExport/buildLayoutManifest.ts
  - src/features/generation/README.md
  - src/features/bin-designer/components/ExportDialog/ExportDialog.tsx
  - src/features/baseplate/hooks/useBaseplateExport.ts
  - src/core/baseplateDefaults.ts
---

# Troubleshooting prints

This page lists the most frequent problems with files from the Gridfinity Layout Tool. Each problem has its cause and the setting that solves it. Find the symptom that you see, then follow the steps.

## A bin is too tight in the plate

The gap between a bin foot and a plate pocket comes from the Gridfinity standard, and no setting changes it. One cause that you can solve in the Layout Tool is a bin with a different grid from the plate.

1. Open the layout of the drawer, then open the bin in the bin designer. The bin designer takes the grid unit, the height unit, the magnet anchor and the low-profile base from the active layout.
2. Export the bin again from that layout.
3. If you changed the <Ui k="baseplate.gridUnit" /> after you printed the plate, export and print the plate again too.

If the bin sits high on one spot, look for a screw head or a magnet that stands up from the plate. A screw head must sit flush. Set <Ui k="baseplate.screwHoles.headStyle.label" /> and <Ui k="baseplate.screwHoles.headDiameter.label" /> to match your screws. See [Magnets and screws](../baseplates/magnets-and-screws).

If a large bin is hard to lift out because of its magnets, turn on <Ui k="binDesigner.base.cornerHolesOnly" /> in the base of the bin. The bin then has magnets at its outer corners only.

## Connector keys or plate pieces are too tight

1. Print the connector fit test, and set <Ui k="baseplate.connectorFit.label" /> to the best value.
2. In your slicer, set the initial layer horizontal expansion to about −0.1 to −0.2 mm.
3. Use a 0.4 mm nozzle for the keys if you can.

See [Fit and tolerances](./fit-and-tolerances#when-a-connector-key-is-too-tight).

## Stacked plates do not come apart

The layer height in your slicer is larger than the stack gap, so the gap closed during the print. Set the layer height to the gap or less, or make <Ui k="baseplate.stackPrint.gap.label" /> larger. Print the stack fit test before the next full tower. See [Eco plates and stack printing](../baseplates/eco-and-stack-printing).

## Labels are missing from the export

**Blank label tabs on a linked bin.** If <Ui k="binDesigner.labelText" /> is blank, linked bins print the label that they have in the layout. Only the 3D layout preview and the layout ZIP fill in those labels. An export from the bin designer prints the tabs blank. Export the layout with <Ui k="header.export" />, or type the label text in the design.

**Label tabs with no text.** The bin list shows <Ui k="print.row.blankLabelTabs" /> on a row whose tabs print with no text. Add the text in the bin designer.

**Swappable label plates.** The plates are separate prints, so the bin file never holds them. In the export dialog of the bin designer, use the second download button to get the plates. The layout ZIP puts them in the `labels/` folder. The ZIP skips a plate that is wider than the print bed, and the manifest counts the skipped plates.

## Bins are missing from the layout ZIP

Open `manifest.txt` in the ZIP. Its last section lists each bin that the export skipped, and why:

| Reason                                              | What to do                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| The bin has no link to a saved design.              | Link the bin to a design. See [Saved designs and linked bins](../concepts/saved-designs). |
| The linked design could not load.                   | Open the bin and link it to a design that exists.                                         |
| STEP cannot hold an imported mesh or a mesh cutout. | Export the layout as STL or 3MF.                                                          |

Each design is in the ZIP once, not once for each bin. Print each file as many times as the manifest says.

## The baseplate is missing from the layout ZIP

If the baseplate fails, the Layout Tool exports the bins only, and a message tells you. If the message names some pieces, those pieces of your custom split are larger than the print bed. Open the baseplate generator and click <Ui k="baseplate.splitResetAuto" />, or add a split. See [Split for your print bed](../baseplates/splitting#draw-your-own-split-lines).

## A slicer rejects a 3MF file

Bambu Studio versions 2.8.2.60 and 2.8.2.61 reject a 3MF file with no project settings. The Layout Tool leaves those settings out on purpose, because they replace your print profile. Update Bambu Studio to 2.8.3 or later. For a one-color part, you can also export STL.

## The colors are wrong

| Symptom                                             | Cause and what to do                                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The slicer shows only one filament.                 | Bambu Studio 2.8.x on an empty plate does not add the filaments of the file. Add the filaments by hand, or update to 2.9.1 or later.                        |
| The zones have the wrong colors.                    | The file does not set slot colors. Use <Ui k="binDesigner.colors.slicerHandoff.show" /> in the export dialog, and assign each filament to the correct slot. |
| The whole bin prints in one color.                  | STL, STEP and split exports lose the colors. Export a whole bin as 3MF.                                                                                     |
| Two bins share a filament in a layout project file. | Parts with the same color use the same filament. This is the expected result.                                                                               |

See [Slicer setup](./slicers#map-multi-color-zones-to-filaments).

## The export stops with an error

If the export of a bin times out or runs out of memory, the design is too complex for the geometry engine. Make the bin lower, or make the wall pattern bolder or turn it off. Then export again.

## Next steps

- [Fit and tolerances](./fit-and-tolerances): find the fit settings and the test prints.
- [Slicer setup](./slicers): open the files and map the colors.
- [The print list and ZIP export](./print-list-and-zip): learn what the layout ZIP holds.
