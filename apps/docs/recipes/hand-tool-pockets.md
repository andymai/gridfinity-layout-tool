---
title: Hand tools with custom pockets
description: 'Scan hand tools with a phone, cut a pocket for each one, and test the fit first.'
sources:
  - src/features/bin-designer/utils/startScan.ts
  - src/features/bin-designer/components/panel/CutoutsSection/scanImport/useScanImport.ts
  - src/features/bin-designer/components/panel/CutoutsSection/ToolThicknessPrompt.tsx
  - src/shared/utils/cutoutDepth.ts
  - src/features/bin-designer/components/panel/CutoutsSection/fingerAccessPlan.ts
  - src/features/bin-designer/components/panel/CutoutsSection/pocketChecks.ts
  - src/shared/utils/fitTestPlan.ts
  - src/features/scan-capture/
---

# Hand tools with custom pockets

A pocket shaped like each tool shows at a glance which tool is out of the drawer. In this recipe, you photograph three hand tools with your phone, and the bin designer cuts a pocket for each one. You add a finger scoop to lift each tool out, and you print a thin test before the full bin.

<Screenshot id="recipes-hand-tool-pockets-hero" alt="A solid bin with three tool-shaped pockets for pliers, a wrench and a screwdriver, each with a round finger scoop." spec="Bin designer, desktop 1440 px. Design 4 x 3 x 3u with Custom cutouts. Three scanned tool cutouts side by side: pliers, a 150 mm adjustable wrench and a screwdriver, each with Finger access on its long side, Round form and Curved floor. Cutout editor closed. Preview turned to show the pockets from the front right at about 45 degrees. Show the full window." />

## What you need

- The tools. This recipe uses pliers, an adjustable wrench and a screwdriver, each shorter than 160 mm.
- A phone with a browser, and a size reference. A bank card works. The printed calibration sheet works best.
- Calipers or a ruler, to measure the thickest part of each tool.
- A print bed of 168 mm or more. The bin is 4 × 3 grid units, or 168 × 126 mm.

For the filament, read the export window in the bin designer. It counts the solid bin. The bin list in the layout editor counts a hollow bin, so it reads low for this one.

## Step 1: Start a solid bin

1. Open the [bin designer](https://gridfinitylayouttool.com/designer), and set the size to 4 × 3 grid units, 3u tall.
2. In the <Ui k="binDesigner.group.interior" /> group, pick <Ui k="binDesigner.interior.solid.title" />.

The bin is now a solid block, and the pockets cut down into its top. Inside its 1.2 mm walls, the top is 165.1 × 123.1 mm. That's 4 × 42 mm less 0.5 mm of fit gap and two walls, by 3 × 42 mm less the same.

Not sure of the size? Lay the tools side by side with a finger's width between them, and measure the space they take. Round up to whole grid units of 42 mm.

## Step 2: Scan the tools with your phone

1. Click <Ui k="binDesigner.cutouts.scanImport.title" />, then <Ui k="binDesigner.cutouts.scanImport.routePhone" />.
2. Point the phone camera at the QR code and open the link. The link lasts 10 minutes, so lay out the tools and the reference first.
3. Put the tools on a plain sheet with a gap between them, and the card flat beside them.
4. Tap <Ui k="scan.takePhoto" />, and hold the phone level, straight above the tools.
5. Check each outline in the review, and tap <Ui k="scan.use" />.

The tools land in the bin as one group. Each pocket already has 0.4 mm of clearance and a chamfer at its top edge, so the tool drops in. [Scan with your phone](../cutouts/phone-scan) covers the size references and the review screen.

::: tip
No phone? Click <Ui k="binDesigner.cutouts.scanImport.title" /> and trace a photo from your computer instead, as in [Trace a photo](../cutouts/photo-trace). Or draw the pockets yourself with the <Ui k="binDesigner.cutouts.addSlot" /> and <Ui k="binDesigner.cutouts.penTool" /> tools.
:::

## Step 3: Set the pocket depth

The bin designer now asks how thick the tools are. Measure the thickest part of each tool.

<Screenshot id="recipes-hand-tool-pockets-thickness" alt="The tool thickness prompt over the cutout board, with a thickness of 18 mm and 3 mm that sticks out." spec="Cutout editor of a 4 x 3 x 3u Custom cutouts bin, right after a phone scan of three tools. The thickness prompt for 3 tools shows, with Same thickness for all turned on, Thickness 18 and Sticks out 3 typed. Crop to the prompt and the board around it." />

Say the pliers are 18 mm thick. Type 18 in <Ui k="binDesigner.cutouts.depthPrompt.thickness" />. A 3u bin has room for 16.25 mm: 21 mm of bin, less 4.75 mm of feet. So the prompt warns you and offers to make the bin 4u tall. You have two good choices:

| Choice                                                                  | Result                                                                    |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Make the bin 4u tall                                                    | The tool sits flush. A 4u bin has room for 23.25 mm.                      |
| Type 3 in <Ui k="binDesigner.cutouts.depthPrompt.proud" />, and keep 3u | The pocket is 15 mm deep, and the tool stands 3 mm proud for a good grip. |

Then click <Ui k="binDesigner.cutouts.depthPrompt.apply" />. To give each tool its own depth, turn off the switch that sets the same thickness for all.

## Step 4: Add finger access and arrange

A snug pocket holds a tool well, but you need a way to get a fingertip under it.

1. A click on the board selects the whole group. To select one tool, click its row in the <Ui k="binDesigner.shapeList.tabShapes" /> tab.
2. In the <Ui k="binDesigner.shapeList.tabProperties" /> tab, open <Ui k="binDesigner.cutouts.section.shape" /> and click <Ui k="binDesigner.cutouts.finger.add" />.
3. Do the same for each tool.

Each scoop is 20 mm wide and 40 mm long, across the middle of the long side. Half of it cuts beside the tool, and half lies over it.

Drag the group to place the tools in the bin. If a tool hangs past the edge, a warning offers a button that makes the bin larger. [Arrange cutouts](../cutouts/arranging) shows how to align and pack them.

Then read <Ui k="binDesigner.cutoutEditor.checks.title" /> at the top of the <Ui k="binDesigner.shapeList.tabProperties" /> tab. It flags any spot with less than 1.2 mm of plastic, for example between two pockets.

## Step 5: Print a fit test first

A full solid bin is a long print. A test ring takes a fraction of the filament.

1. In the <Ui k="binDesigner.shapeList.tabProperties" /> tab, click <Ui k="binDesigner.cutouts.fitTest.button" />.
2. Pick <Ui k="binDesigner.cutouts.fitTest.modeOutline" />. Each pocket becomes a thin ring, 0.6 mm tall and 1.2 mm wide, whose inside edge is the pocket wall.
3. Export the file and print it flat.
4. Lay each tool in its ring.

<Screenshot id="recipes-hand-tool-pockets-fit-test" alt="The fit test window in Outline only mode, with the ring settings and the filament and time of the test next to the whole bin." spec="Bin designer, desktop 1440 px, the same 4 x 3 x 3u bin with three scanned pockets. Open Print fit test from the Properties tab, pick Outline only, keep the default outline height and ring width. Crop to the dialog with its estimates." />

The window also compares the filament and the time of the test with the whole bin. When every tool drops in with a small, even gap, export the bin with <Ui k="common.export" />. To put it in a drawer, use <Ui k="binDesigner.placeInLayout.action" /> in <Ui k="binDesigner.savedDesigns" />.

## When it goes wrong

### A tool is too tight, or it rattles

Select that pocket and open <Ui k="binDesigner.cutouts.section.fit" />. Make <Ui k="binDesigner.cutouts.clearance" /> larger for a tight tool, or smaller for a loose one. Scans start at 0.4 mm. Print a new ring before the bin. [Fit and tolerances](../printing/fit-and-tolerances) helps you find the value that suits your printer.

### A tool is hard to lift out

Add finger access to that pocket if it has none. You can also set <Ui k="binDesigner.cutouts.entryProfile" /> to <Ui k="binDesigner.cutouts.entryProfile.round" />, a smooth curve for tools that you lift by hand. Or let the tool stick out a few millimeters, as in step 3.

### The pocket is the wrong size

A bank card measures less exactly than the printed calibration sheet. Print the sheet at 100% and check that its bar is 100 mm. For a tall tool, lay a measuring strip on top of it, because the top of a tall tool looks larger to the camera. Compare the size in the phone review with a ruler before you tap <Ui k="scan.use" />. See [Scan with your phone](../cutouts/phone-scan#pick-a-size-reference).

## Next steps

- [Check before you print](../cutouts/print-checks): every pocket warning, and the full-card fit test
- [Cutout basics](../cutouts/basics): depth modes, two-depth pockets and wall openings
- [Arrange cutouts](../cutouts/arranging): repeats, groups and labels for each pocket
- [Swappable label plates](../designer/label-plates#add-sockets-on-cutout-bins): a label plate beside each tool
