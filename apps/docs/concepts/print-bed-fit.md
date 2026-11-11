---
title: Fitting the print bed
description: 'See how the Layout Tool checks each part against your print bed, and how it splits a large part.'
sources:
  - src/core/constants.ts
  - src/core/bedFit.ts
  - src/shared/utils/binSplitFit.ts
  - src/features/bin-designer/hooks/useLayoutPrintBed.ts
  - src/features/bin-designer/components/panel/SplitOptionsSection/
  - src/features/baseplate/components/BaseplatePanel/SplitViewStrip.tsx
  - src/features/baseplate/utils/splitPlanner.ts
  - src/features/bin-designer/components/ExportDialog/ExportDialog.tsx
  - src/shell/layoutExport/planLayoutBinExport.ts
---

# Fitting the print bed

Every printer has a largest part that it can print. Tell the Gridfinity Layout Tool your print bed size, and it checks each bin and each baseplate against it. When a part is too large, it tells you, and it can split the part into pieces that fit. Here's how the check works and where to set the bed size.

## One bed size for each layout

The **print bed size** is a width and a depth in millimeters. The default is a 256 mm square bed, and you can set any size from 42 mm to 3000 mm. The width and depth fields have a chain icon. Click the chain to unlink them for a bed that is not square.

The bed size belongs to the layout. All three tools show the same value, and the layout ZIP export uses it too. Change it in one tool, and the other tools use the changed value.

| Where                       | Group or tab                                                                 | Field                                   |
| --------------------------- | ---------------------------------------------------------------------------- | --------------------------------------- |
| Layout editor               | <Ui k="common.physicalUnits" /> in the left panel                            | <Ui k="sidebar.printBed" />             |
| Bin designer                | <Ui k="binDesigner.group.finishing" />, then <Ui k="common.physicalUnits" /> | <Ui k="settings.printBed" />            |
| Baseplate generator         | <Ui k="common.physicalUnits" />                                              | <Ui k="baseplate.printBedSize" />       |
| <Ui k="sidebar.settings" /> | <Ui k="settings.tabs.defaults" />                                            | <Ui k="settings.defaultPrintBedSize" /> |

The value in <Ui k="settings.tabs.defaults" /> applies only to layouts that you create after you change it.

## How the fit check works

The Layout Tool measures the part in millimeters and tries three placements on the bed:

1. Square to the bed, as the part sits in the layout.
2. Turned 90°.
3. At an angle, across the bed.

A long, narrow part can fit at an angle when it doesn't fit square. Think of a long ruler that fits from corner to corner on a small desk. For example, a 63 mm × 294 mm part is too long for a 256 mm bed both ways round, but it fits at 45°. When a bin fits only at an angle, the bin designer tells you to turn it in your slicer, or to split it.

An overhang counts in the check. An **overhang** makes the body larger than its grid cells. So a bin that fits by its grid size can still be too large to print.

## When a bin is too large

In the layout editor, a bin that doesn't fit shows <Ui k="grid.split" /> or a warning mark on the grid. The inspector shows <Ui k="inspector.split.title" /> with the number of pieces. The print list counts each piece, so your totals stay right.

In the bin designer, the split options appear in the <Ui k="binDesigner.group.shape" /> group when the bin needs a split. The bin splits along the width, the depth or both. Two kinds of connectors hold the pieces together:

- <Ui k="binDesigner.splitConnectors" /> adds a joint with a 45° slope in the floor, so the pieces line up. A bin with a lightweight floor has no solid floor for it.
- <Ui k="binDesigner.splitWallConnectors" /> adds keys in the walls.

The connectors get larger for a nozzle wider than 0.4 mm, so they stay printable. To check the fit before you print, switch the preview between <Ui k="binDesigner.splitAssembled" /> and <Ui k="binDesigner.splitExploded" />. In the export dialog, <Ui k="binDesigner.splitExport.enableSplit" /> writes one file for each piece into a ZIP file.

::: warning
Do not split a bin with color zones if you want to keep the colors. A split export prints each piece in one color.
:::

A slanted bin can't split, because a cut would cross its body at an angle. If a slanted bin is too large, use a smaller angle or make the bin smaller.

<Screenshot id="concepts-print-bed-split-bin" alt="A 6 by 2 bin that is too long for a 180 mm print bed, assembled in the bin designer preview. A click on Exploded shows its two pieces apart." spec="Clip. Bin designer, layout print bed 180 × 180, bin 6 × 2 × 3u, standard base, stacking lip on. The assembled bin, a close-up click on Exploded, then the two pieces apart." />

## When a baseplate is too large

The baseplate generator splits a large baseplate into pieces for you. It shows the number of pieces, and how many times you must fill the print bed to print them all. The split leaves room on the bed for the connector tongues.

By default, the pieces sit loose. You can pick a connector style that locks them together, and you can move the split lines. If a piece is larger than the bed, the baseplate generator stops the export until you change the split. [Split for your print bed](../baseplates/splitting) shows how.

A drawer shape changes the pieces of a split plate: each piece follows the outline, and a seam that the shape crosses gets no connector. See [Drawers that are not rectangles](../baseplates/odd-shaped-drawers#split-a-shaped-plate).

## When it goes wrong

### A bin too large for your printer doesn't split

Open the layout that the bin belongs to, and check <Ui k="sidebar.printBed" /> in the <Ui k="common.physicalUnits" /> group. Set it to the bed of your printer.

The bin designer checks the bin against the print bed of the open layout. The value in <Ui k="settings.tabs.defaults" /> only applies to layouts that you create later.

### The export says the bin fits only when laid diagonally

Export it whole, and turn it diagonally on the bed in your slicer. To print it in pieces instead, tick <Ui k="binDesigner.splitExport.enableSplit" /> in the export dialog. For a bin that fits only at an angle, <Ui k="binDesigner.splitExport.enableSplit" /> starts off.

### You want to split a part in your slicer

For one bin, clear <Ui k="binDesigner.splitExport.enableSplit" /> in the export dialog. The layout ZIP and the baseplate generator split each part that is larger than the print bed. To stop that, set the print bed to 3000 mm, the largest value. Set it back to your real bed before you need the Layout Tool to split again.

### The baseplate export is gray

Click <Ui k="baseplate.splitResetAuto" />, or move your split lines so that each piece fits the bed. A red message in the split view names the pieces that are too large. The baseplate generator stops the export until every piece fits.

## Next steps

- [Split for your print bed](../baseplates/splitting): set connectors and split lines for a large baseplate
- [The print list and ZIP export](../printing/print-list-and-zip): see the pieces of each bin in the print list
- [Size and shape](../designer/size-and-shape): change a bin so that it fits your printer
- [Units and sizes](./units): see how grid units convert to millimeters
