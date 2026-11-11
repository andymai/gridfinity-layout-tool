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

Take a photo of a tool with your phone, and a cutout that fits it appears in the bin designer on your computer. The phone traces the outline, and a size reference in the photo lets it measure the outline too. The photo stays on your phone, and only the outline goes to the computer.

A good scan comes down to three things: a size reference, a plain background, and a photo from straight above. Get those three right, and your first scan should come out well.

## Before you start

Have these ready:

- **Your phone.** The QR code opens a page in the phone's browser, so there's no app to install. The phone needs a connection to send the outline.
- **A size reference.** A bank card works. The printed calibration sheet works best. See [Pick a size reference](#pick-a-size-reference).
- **A plain surface that contrasts with the tool.** For example, put a dark tool on a sheet of white paper. The phone finds the tool by how its color differs from the surface.

The scan link on the computer lasts 10 minutes, so set out the tool and the reference first.

## Pick a size reference

The reference tells the phone the true size of the tool. It also corrects a photo taken at a small angle. The table lists the references from the most accurate to the least accurate.

| Reference                 | How to place it                                                                   | Notes                                                                |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Printed calibration sheet | Lay the tool on the sheet, inside the ring of black squares.                      | The most accurate reference. It has a 100 mm bar to check the print. |
| Gridfinity baseplate      | Lay the tool on the baseplate.                                                    | Only as accurate as the printer that made the baseplate.             |
| Bank, transit or ID card  | Lay the card flat beside the tool, not under it, with the full card in the photo. | Any card of the standard 85.6 × 53.98 mm size.                       |

Not sure? Start with a card from your wallet. The phone reads only the card's shape, so the printing on it doesn't matter. A gift card or a hotel key card of the standard size works too. When you want the best accuracy, print the calibration sheet.

For a tall tool, add a measuring strip. See [Measure a tall tool at its own height](#measure-a-tall-tool-at-its-own-height).

## Print the calibration sheet

1. Start a scan on the computer and click <Ui k="binDesigner.cutouts.scanImport.routePhone" />. See [Start a scan](#start-a-scan-on-the-computer).
2. Click <Ui k="binDesigner.cutouts.scanImport.calibrationSheet" />. You get an SVG file.
3. Print it at 100% (actual size). Don't let the printer scale it to fit the page.
4. Measure the bar under the squares. It must be exactly 100 mm. If it isn't, correct the print scale and print the sheet again.

The sheet is A4, and all its marks also fit on US Letter. It has 18 black squares of 14 mm, 42 mm apart, which is the same spacing as a Gridfinity baseplate. Print it once and keep it for every scan.

::: tip
Keep the tool inside the ring of squares, and don't let it cover a square. The scan still works with a few squares out of view, but each visible square makes the size more accurate.
:::

<Screenshot id="cutouts-phone-scan-sheet" alt="The calibration sheet: a ring of 18 black squares with an empty center for the tool, and a 100 mm bar under it to check the print scale." spec="The SVG file that Print calibration sheet saves, shown as an A4 page. Crop to the sheet with a small margin." />

## Start a scan on the computer

1. In the bin designer, click <Ui k="binDesigner.cutouts.scanImport.title" />, then <Ui k="binDesigner.cutouts.scanImport.routePhone" />.
2. Point the phone camera at the QR code and open the link.

Took longer than 10 minutes? No problem. Click <Ui k="binDesigner.cutouts.scanImport.back" />, then click <Ui k="binDesigner.cutouts.scanImport.routePhone" /> again for a new code. If phone scanning isn't available, <Ui k="binDesigner.cutouts.scanImport.upload" /> accepts an outline that you traced in another app.

## Take the photo on the phone

1. Lay the tool and the reference on a plain surface with no clutter.
2. Tap <Ui k="scan.takePhoto" />, or tap <Ui k="scan.uploadPhoto" /> to use a photo from the phone.
3. Hold the phone level, straight above the tool. Fit the whole tool and the whole reference in the photo.
4. Look at the review. If the highlighted shape isn't your tool, tap the tool in the photo.
5. Tap <Ui k="scan.use" />.
6. Tap <Ui k="scan.sent.another" /> to scan one more tool, or <Ui k="scan.sent.done" />.

Nothing goes to the computer until you tap <Ui k="scan.use" />, so you can retake a photo as often as you like.

### Read the review

The box under the photo shows how the phone sized the tool. For one tool, it gives the size in millimeters, so you can hold a ruler to the tool and compare. A line under the size names the reference that set it. With the sheet or a baseplate, another line says how closely the fit agrees, in millimeters.

### If something looks off

| What you see                         | What to do                                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| The outline is wrong or ragged       | Tap the tool in the photo to redraw it. If that doesn't help, tap <Ui k="scan.retake" /> and use a plainer background. |
| The phone can't find a clear outline | Retake the photo on a plain background with more contrast to the tool.                                                 |
| The phone finds no card              | Lay the card flat beside the tool, with the whole card in the photo, on a plain surface.                               |
| A warning about a steep angle        | Retake the photo from straighter above. A steep angle makes the size less accurate.                                    |
| The phone says the link expired      | Start a new scan from your computer.                                                                                   |

A soft shadow is usually fine. The phone looks at the change in color more than the change in brightness, so a shadow does little harm.

### What lands on the computer

On the computer, each outline comes into the cutout editor as a cutout. It already has 0.4 mm of clearance and an entry chamfer, so the tool drops in. The editor then asks how thick the tool is, to set the depth. See [Set the tool thickness](./import-svg-stl#set-the-tool-thickness).

Before you print the whole bin, [print a fit test](./print-checks#print-a-fit-test). A fit test is a thin print of the bin top, so you learn about the fit before the full print.

### Use a card of a different size

If your card isn't the standard size, tap <Ui k="scan.cardSize.change" /> beside <Ui k="scan.cardSize.label" /> on the review screen. Type the long side and the short side. The phone remembers these values for later scans.

### A photo with no reference

No reference in the photo? The scan still works. The computer then asks for the real length of the longest side of the tool.

## Scan several tools in one photo

Lay the tools with a gap between each one. The phone traces every tool and sizes each one from the same reference. On the review screen:

- Remove an outline that you don't want.
- Tap a tool to draw its outline again, or to add a tool that the phone missed.
- Turn on <Ui k="scan.review.keepHoles" /> to keep plastic in the holes of a tool, such as the ring of a spanner. See [Trace a photo](./photo-trace#keep-holes-as-islands).

The tools come into the bin designer as one group, so you can move them as a block.

## Measure a tall tool at its own height

The top of a tall tool sits nearer to the camera than the table, so it looks larger in the photo. A measuring strip on top of the tool measures the tool at its own height.

1. In the scan dialog, after you click <Ui k="binDesigner.cutouts.scanImport.routePhone" />, click <Ui k="binDesigner.cutouts.scanImport.measuringStrips" />.
2. Print the page at 100%, and measure the bar: it must be 100 mm.
3. Cut out the strips. They have 3, 4 or 5 squares.
4. Lay one strip flat across the top of the tool, with the squares up.
5. Take the photo from straight above.

When the photo also has a sheet, the strip sets the size. The strip hides part of the edge, so the phone fills in the outline under the strip. It marks that tool, so look at the filled edge before you use the outline.

## Places to start a scan

You can start a scan from several places:

- The <Ui k="binDesigner.cutouts.scanImport.title" /> button under <Ui k="binDesigner.interior.solid.title" /> in the <Ui k="binDesigner.group.interior" /> group.
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
