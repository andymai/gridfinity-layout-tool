---
title: Fit and tolerances
description: 'Make bins, plates and connectors fit on your printer with the nozzle size, fit settings and test prints.'
sources:
  - src/shared/printSettings/gridfinityGeometry.ts
  - src/shared/printSettings/printSettings.ts
  - src/shared/constants/connectors.ts
  - src/shared/generation/socketNozzle.ts
  - src/features/bin-designer/hooks/useSyncPhysicalUnits.ts
  - src/features/baseplate/utils/printGuide.ts
  - src/features/bin-designer/components/CutoutWorkspace/FitTestButton.tsx
---

# Fit and tolerances

Each printer and each filament prints a little differently. A part that fits on one printer can be tight on another. This page shows which fits the Gridfinity Layout Tool lets you tune, and the test prints that help you find the correct values.

## Test before you print a full drawer

Print one small bin and one small baseplate piece first. Put the bin in the plate and make sure that it sits flat and lifts out freely. Then print the rest.

For each part that must fit closely, the Layout Tool has a small test print. See [Fit test prints](#fit-test-prints) below.

## How a bin fits the plate

The Gridfinity standard sets this fit. Each pocket of the plate is 0.25 mm larger than the bin foot on each face, which gives 0.5 mm in total. The Layout Tool has no setting for this gap. It follows the open Gridfinity dimensions, so its bins and plates work with Gridfinity parts from other sources.

The bin and the plate must agree on the grid. The bin designer takes these values from the active layout, so a bin that you export fits that layout's plate:

- <Ui k="baseplate.gridUnit" />
- <Ui k="binDesigner.heightUnit" />
- <Ui k="baseplate.magnetAnchor" />
- <Ui k="baseplate.lowProfileBase" />

If you change one of these values, export the bins and the plate again. A low-profile bin still fits a standard plate, and a standard bin still fits a low-profile plate with less grip.

## Set your nozzle size

The nozzle size changes the parts that must fit closely, so that a wider nozzle can still print them. Set it in Settings, in the <Ui k="settings.tabs.print" /> tab. The same <Ui k="settings.nozzleSize" /> field is also in the baseplate generator, in the bin designer and below the bin list. All of them change one value.

The range is 0.2 to 1.0 mm, and the default is 0.4 mm. Above 0.4 mm, the Layout Tool changes these parts:

- The keys and snap clips that join baseplate pieces
- The connectors and wall locks of a split bin
- The sockets that hold swappable label plates

At 0.4 mm, these parts keep their standard shape. The nozzle size does not change the walls of a bin. It also changes the print time estimate. See [Filament and time estimates](./estimates).

## Fit settings

| Setting                                          | Where                                  | What it changes                                                                           |
| ------------------------------------------------ | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| <Ui k="baseplate.connectorFit.label" />          | Baseplate generator, connectors        | The gap of the connectors that join plate pieces, from −0.3 to +0.3 mm. Higher is looser. |
| <Ui k="baseplate.stackPrint.gap.label" />        | Baseplate generator, stack             | The air gap between stacked plates                                                        |
| <Ui k="baseplate.mountMagnets.diameter.label" /> | Baseplate generator, underside magnets | The hole size. Add 0.2 to 0.5 mm to the magnet diameter.                                  |
| <Ui k="baseplate.magnetCrushRibs" />             | Bins and baseplates, magnet holes      | Ridges that grip a magnet with no glue                                                    |
| <Ui k="binDesigner.cutouts.clearance" />         | Bin designer, each cutout              | The extra size of a pocket, so that the part drops in                                     |
| <Ui k="binDesigner.dividerClearance" />          | Bin designer, removable dividers       | The fit of the dividers in their slots                                                    |
| <Ui k="binDesigner.plateFitOffset" />            | Bin designer, label tab sockets        | The fit of a label plate in its socket. Negative is tighter.                              |
| <Ui k="binDesigner.lid.hinge.fitClearance" />    | Bin designer, hinged lid               | The gap between the hinge and the pin                                                     |
| <Ui k="binDesigner.lid.slide.clearance" />       | Bin designer, sliding lid              | The gap between the lid and its channel                                                   |

For a hinge or a sliding lid, raise the value if the part binds, and lower it if the part rattles.

## Fit test prints

| Test            | Where to find it                                                         | What you get                                                                     |
| --------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| Connector fit   | <Ui k="baseplate.connectorSample.button" /> under the connector settings | One coupon for each fit value, with the value on the surface                     |
| Stack fit       | <Ui k="baseplate.stackPrint.sampleButton" /> in the stack settings       | A stack of two 1 by 1 plates, to tune the gap                                    |
| Cutout fit      | <Ui k="binDesigner.cutouts.fitTest.button" /> in the cutout editor       | A thin slice of the bin top with every cutout, or a thin ring around each cutout |
| Label plate fit | <Ui k="binDesigner.fitSample.button" /> in the label tab settings        | Five sockets from −0.10 to +0.10 mm, and one blank plate                         |

Print each test with the same printer, filament, nozzle and settings as the real part. Print it flat, with no supports. Then set the fit setting to the value of the test part that fits best.

<Screenshot id="printing-fit-connector-test" alt="The connector fit sample dialog with its print tips." spec="Baseplate generator with a plate split into four pieces and the Puzzle key connector selected. Click Print fit test under the connector settings. Show the dialog with its description and print tips. Crop to the dialog." />

### When a connector key is too tight

The print guide of a split baseplate gives these tips for a puzzle key or a snap clip:

- Use a 0.4 mm nozzle. A larger nozzle loses the detail of the key.
- In your slicer, set the initial layer horizontal expansion to about −0.1 to −0.2 mm. First-layer squish is the most frequent cause of a tight key.
- Print the key flat, with 2 or more walls.
- If the key does not go in, raise <Ui k="baseplate.connectorFit.label" />. If it is loose, lower it.

## Next steps

- [Split for your print bed](../baseplates/splitting): choose a connector style for plate pieces.
- [Print checks](../cutouts/print-checks): find thin walls and merged pockets before you print.
- [Troubleshooting prints](./troubleshooting): solve a bin that is too tight in the plate.
