---
title: Scan with your phone
description: 'Photograph a tool with your phone and get a cutout at its true size on your computer.'
sources:
  - src/features/scan-capture/
  - src/shell/scanBoot.tsx
  - api/scan-session.ts
  - src/features/bin-designer/components/panel/CutoutsSection/scanImport/
  - src/shared/scanReview/components/ScanCaptureFlow/
  - src/shared/scanTrace/calibrationGrid.ts
  - src/shared/scanTrace/measuringStrip.ts
  - src/features/bin-designer/utils/startScan.ts
---

# Scan with your phone

Start a scan on your computer and take a photo of the tool with your phone. The Gridfinity Layout Tool then cuts a cutout that fits the tool. The phone finds the outline of the tool, so the photo stays on your phone. Only the outline goes to the computer.

## Pick a size reference

The scan must have something of a known size in the photo. The reference sets the true size of the outline, and it also corrects a photo taken at a small angle. The table lists the references from the most accurate to the least accurate.

| Reference                 | How to place it                                                                   | Notes                                                                |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Printed calibration sheet | Lay the tool on the sheet, inside the ring of black squares.                      | The most accurate reference. It has a 100 mm bar to check the print. |
| Gridfinity baseplate      | Lay the tool on the baseplate.                                                    | Only as accurate as the printer that made the baseplate.             |
| Bank, transit or ID card  | Lay the card flat beside the tool, not under it, with the full card in the photo. | Any card of the standard 85.6 × 53.98 mm size.                       |

For a tall tool, add a measuring strip. See [Measure a tall tool at its own height](#measure-a-tall-tool-at-its-own-height).

## Print the calibration sheet

1. Start a scan on the computer and click <Ui k="binDesigner.cutouts.scanImport.routePhone" />. See [Start a scan](#start-a-scan-on-the-computer).
2. Click <Ui k="binDesigner.cutouts.scanImport.calibrationSheet" />. You get an SVG file.
3. Print it at 100% (actual size). Do not let the printer scale it to fit the page.
4. Measure the bar under the squares. It must be exactly 100 mm.
5. If the bar is not 100 mm, correct the print scale and print the sheet again.

The sheet is A4, and all its marks also fit on US Letter. It has 18 black squares of 14 mm, 42 mm apart, which is the same spacing as a Gridfinity baseplate.

::: tip
Keep the tool inside the ring of squares, and do not let it cover a square. The scan still works with a few squares out of view, but each visible square makes the size more accurate.
:::

<Screenshot id="cutouts-phone-scan-sheet" alt="A wrench on the printed calibration sheet, photographed from straight above." spec="Real photo, not a UI capture. Printed calibration sheet on a plain desk, a 150 mm wrench inside the ring of black squares, no squares covered, phone held level above the center. Crop to the sheet with a small margin." />

## Start a scan on the computer

1. In the bin designer, click <Ui k="binDesigner.cutouts.scanImport.title" />.
2. Click <Ui k="binDesigner.cutouts.scanImport.routePhone" />.
3. Point the phone camera at the QR code and open the link.

The link expires after 10 minutes. If it expires, click <Ui k="binDesigner.cutouts.scanImport.back" />, then click <Ui k="binDesigner.cutouts.scanImport.routePhone" /> again to get a new code. If phone scanning is not available, <Ui k="binDesigner.cutouts.scanImport.upload" /> accepts an outline that you traced in another app.

## Take the photo on the phone

1. Lay the tool and the reference on a plain surface with no clutter.
2. Tap <Ui k="scan.takePhoto" />, or tap <Ui k="scan.uploadPhoto" /> to use a photo from the phone.
3. Hold the phone straight above the tool, with the full tool in the photo.
4. Look at the review. A line under the photo names the reference that set the size.
5. If the highlighted shape is not your tool, tap the tool in the photo.
6. Tap <Ui k="scan.use" />.
7. Tap <Ui k="scan.sent.another" /> to scan one more tool, or <Ui k="scan.sent.done" />.

If the outline looks wrong, tap <Ui k="scan.retake" /> and use a plainer background. If the phone warns about a steep angle, take the photo again from straighter above.

On the computer, each outline comes into the cutout editor as a cutout. The editor then asks how thick the tool is, to set the depth. See [Set the tool thickness](./import-svg-stl#set-the-tool-thickness).

### Use a card of a different size

If your card is not the standard size, tap <Ui k="scan.cardSize.change" /> beside <Ui k="scan.cardSize.label" /> on the review screen. Type the long side and the short side. The phone keeps these values.

### A photo with no reference

With no reference in the photo, the computer asks for the real length of the longest side of the tool.

## Scan several tools in one photo

Lay the tools with a gap between each one. The phone traces every tool and sizes each one from the same reference. On the review screen:

- Remove an outline that you do not want.
- Tap a tool to draw its outline again, or to add a tool that the phone did not find.
- Turn on <Ui k="scan.review.keepHoles" /> to keep plastic in the holes of a tool, such as the ring of a spanner. See [Trace a photo](./photo-trace#keep-holes-as-islands).

The tools come into the bin designer as one group, so you can move them as a block.

## Measure a tall tool at its own height

The top of a tall tool is nearer to the camera than the table, so it looks larger. A measuring strip on top of the tool measures the tool at its own height.

1. In the scan dialog, after you click <Ui k="binDesigner.cutouts.scanImport.routePhone" />, click <Ui k="binDesigner.cutouts.scanImport.measuringStrips" />.
2. Print the page at 100%. Measure the bar: it must be 100 mm.
3. Cut out the strips. They have 3, 4 or 5 squares.
4. Lay one strip flat across the top of the tool, with the squares up.
5. Take the photo from straight above.

When the photo also has a sheet, the strip sets the size. The strip hides part of the edge, so the phone fills in the outline under the strip. It marks that tool, so look at the filled edge before you use the outline.

## Places to start a scan

- The <Ui k="binDesigner.cutouts.scanImport.title" /> button under <Ui k="binDesigner.interior.solid.title" /> on the <Ui k="binDesigner.category.interior" /> page.
- The <Ui k="binDesigner.interior.scanLink" /> link under the other interior modes. It changes the interior to <Ui k="binDesigner.interior.solid.title" />.
- The header of the cutout editor, and <Ui k="binDesigner.cutouts.scanImport.buttonLabel" /> in its toolbar.
- The command palette on a computer: press <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>Cmd</kbd>+<kbd>K</kbd> on a Mac) and type "scan". Outside the bin designer, this starts a new bin that grows to fit the tools that you scan.
- <Ui k="workshop.profile.scan" /> on a cutter part in a [Workshop](./workshop) build.

Each place first asks if the photo is on your phone or on this computer.

In the bin designer on a phone or a tablet, the scan runs on that device. It adds the tools to the bin, and makes the bin larger to fit them.

## Next steps

- [Trace a photo](./photo-trace): trace a photo that is already on your computer.
- [Check before you print](./print-checks): print a fit test of the scanned tools.
- [Arrange cutouts](./arranging): pack the scanned tools in the bin.
