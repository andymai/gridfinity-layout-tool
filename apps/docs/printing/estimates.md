---
title: Filament and time estimates
description: 'Find the filament, time and cost estimates, learn what they assume, and know how far to trust them.'
sources:
  - src/shared/printSettings/printSettings.ts
  - src/shared/printSettings/standardBinVolume.ts
  - src/features/print-export/utils/printEstimates.ts
  - src/features/print-export/hooks/usePrintList.ts
  - src/features/bin-designer/utils/printEstimates.ts
  - src/shell/layoutExport/buildLayoutManifest.ts
---

# Filament and time estimates

The Gridfinity Layout Tool estimates the filament, the print time and the cost before you slice. Use the estimates to plan a drawer and to compare designs. Use your slicer for the final numbers.

## Where the estimates show

| Place                                              | What it shows                                                                                                        |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| <Ui k="rightPanel.binList" /> in the layout editor | Filament in meters for each row. The summary shows the time, the cost, the filament and the part of a spool.         |
| Bin designer, export dialog                        | <Ui k="binDesigner.printEstimatesPla" />: filament, weight, time and cost, with the triangle count and the file size |
| Cutout fit test dialog                             | The cost of the test print and of the whole bin                                                                      |
| `manifest.txt` in the layout ZIP                   | Grams and time for each bin file, and the total                                                                      |
| A 3MF file                                         | The time and the grams, stored in the file                                                                           |
| Community gallery                                  | The time and the filament of a published design                                                                      |

The baseplate generator shows no estimate. Slice the plate to get one.

<Screenshot id="printing-estimates-summary" alt="The summary below the bin list with time, cost, filament and spool use." spec="Layout editor with a 6 by 4 drawer and about ten bins. Right panel, Bin list expanded, scrolled to the summary at the bottom. Crop to the nozzle size row and the summary." />

## What the estimates assume

The estimates use these values:

- PLA, at 1.24 g/cm³
- 1.75 mm filament, with about 330 m on a 1 kg spool
- The values in Settings, in the <Ui k="settings.tabs.print" /> tab

| Setting                               | Default         | Effect on the estimate                                                              |
| ------------------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| <Ui k="settings.filamentCostPerKg" /> | $20 for each kg | The cost                                                                            |
| <Ui k="settings.printLayerHeight" />  | 0.2 mm          | Time. Thinner layers take longer: 0.12 mm takes about 1.67 times as long as 0.2 mm. |
| <Ui k="settings.infillPercent" />     | 15%             | Time. Each percent above 15 adds 0.3%.                                              |
| <Ui k="settings.nozzleSize" />        | 0.4 mm          | Time. A 0.6 mm nozzle takes about two thirds of the time.                           |

The time model uses an average flow of 11 mm³ of plastic each second, for a 0.4 mm nozzle. It also adds 16 minutes for each print plate, for bed heating, the first layer and cooling. The bin list finds the number of plates from the total area of the bins and the size of your print bed.

The nozzle size changes only the time. The amount of plastic in a bin stays the same.

## What each estimate counts

The bin list and the layout manifest know only the width, depth and height of each bin. They count a standard bin: the walls, the floor, the feet and the stacking lip. They do not count cutouts, dividers or compartments. For standard bins from 1 by 1 by 2 to 4 by 4 by 6, this model is within about 2% of the real volume.

The estimate in the bin designer uses the full design. It also counts the dividers, the label tabs and the scoops. Use it when a bin has many features.

Some cases change the count:

- A bin that is too large for the bed counts once for each piece.
- Bins in the stash are not in the bin list.
- For an imported mesh design, the bin list uses the standard bin. The manifest uses the measured volume of the mesh when it has one.

## How far to trust the estimates

The filament estimate is close for a standard bin. The Layout Tool tuned its model against the solids that its own generator builds. The time estimate is less exact. Print speed depends on your printer and your slicer profile, so treat the time as a rough guide.

For the numbers that you plan with, slice the file. Your slicer knows your printer, your profile and the real shape.

In the community gallery, a design shows <Ui k="community.cost.estimated" /> until a few people report their prints. After that, it shows the print times from those reports.

## Next steps

- [The print list and ZIP export](./print-list-and-zip): read the bin list and the manifest.
- [Fit and tolerances](./fit-and-tolerances): set the nozzle size for your printer.
- [The community gallery](../sharing/community): add your own print report to a design.
