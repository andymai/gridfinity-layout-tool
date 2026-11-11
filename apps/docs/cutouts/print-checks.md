---
title: Check before you print
description: 'Find cutouts that print badly, print a fit test, and add finger access to lift a snug tool out.'
sources:
  - src/features/bin-designer/components/panel/CutoutsSection/pocketChecks.ts
  - src/features/bin-designer/components/panel/CutoutsSection/PocketIssueList.tsx
  - src/features/bin-designer/components/panel/CutoutsSection/cutoutDepthShortfall.ts
  - src/features/bin-designer/components/CutoutWorkspace/FitTestButton.tsx
  - src/shared/utils/fitTestPlan.ts
  - src/shared/utils/fitTestOutlinePlan.ts
  - src/features/bin-designer/components/panel/CutoutsSection/fingerAccessPlan.ts
  - src/features/bin-designer/components/CutoutWorkspace/FingerAccessControls.tsx
---

# Check before you print

A full bin can take hours to print, so find the problems before the printer does. The Gridfinity Layout Tool checks your cutouts as it will cut them, and it can make a small fit test for you to print first. This page shows how to read the warnings, test the fit of your parts, and help a snug tool lift out.

## Find the warnings

The warnings show at the top of the <Ui k="binDesigner.shapeList.tabProperties" /> tab in the cutout editor. They stay there when you select a cutout. They're advice, not rules: no warning stops an export.

## Cutouts that are too deep

A cutout can't go deeper than the plastic that the bin has under the top surface. When you ask for more, the Layout Tool cuts the cutout shallower.

- The panel shows how many cutouts the Layout Tool will cut shallower than you asked.
- Select one of them. Under <Ui k="binDesigner.cutouts.cutDepth" />, a line gives the depth that the bin has room for.

To sort it out, lower the depth or the lean, or move the cutout away from the edge of the bin. You can also make the bin taller. When you set a tool thickness after a scan or an import, the prompt offers to make the bin taller for you.

## Pocket checks

<Ui k="binDesigner.cutoutEditor.checks.title" /> measures each cutout with its clearance and its entry edge, because both make the cutout wider at the top. Each check looks for plastic thinner than 1.2 mm:

| Warning                      | What it means                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| Two cutouts merge            | Clearance and entry edges make the two cutouts touch, so they cut one opening.                |
| Thin plastic between cutouts | Less than 1.2 mm of plastic stays between two cutouts, or between two copies of a repeat.     |
| Thin wall                    | A cutout leaves less than 1.2 mm of bin wall, or breaks through the wall.                     |
| Under the stacking lip       | A cutout reaches under the lip, where a tool can catch.                                       |
| Thin floor                   | Less than 1.2 mm of plastic stays under a cutout. A thin floor can bend or let light through. |
| Thin island                  | An island in a traced cutout is less than 1.2 mm across at the top.                           |

Select a warning to select its cutouts on the board. Two warnings come with a fix. A thin floor has a button that sets the floor to the minimum. A thin island has <Ui k="binDesigner.cutoutEditor.checks.islandFix" />.

The checks skip cutouts that you drew to overlap, such as a cutout and its finger access.

::: warning
Look at the 3D preview when two cutouts lean toward each other. The checks measure at the top surface, so they don't see two cutouts that meet lower down.
:::

<Screenshot id="cutouts-print-checks-list" alt="The Pocket checks list shows a thin wall warning and a thin floor warning with its fix button." spec="Cut editor, 2x1 bin, 3u tall. Place a circle 1 mm from the left wall and a rectangle with To floor depth at 0.8 mm floor. Show the Properties tab with the Pocket checks list and the floor fix button, and the board with the two cutouts. Crop to the board and the panel." />

## Print a fit test

Print one small test before the whole bin. A fit test shows if your parts fit, for a fraction of the filament.

1. In the <Ui k="binDesigner.shapeList.tabProperties" /> tab, click <Ui k="binDesigner.cutouts.fitTest.button" />.
2. Under <Ui k="binDesigner.cutouts.fitTest.mode" />, pick <Ui k="binDesigner.cutouts.fitTest.modeCard" /> or <Ui k="binDesigner.cutouts.fitTest.modeOutline" />, and set the size fields.
3. Pick a file format and export the file.
4. Print it flat, the way it comes out, and put each part in its place.

| Type                                               | What prints                                                                                   | Pick it when                                        | Settings                                                                                                                                                                                          |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.cutouts.fitTest.modeCard" />    | A thin slice of the top of the bin, with every cutout at its real size, position and spacing. | You also want to check the spacing between cutouts. | <Ui k="binDesigner.cutouts.fitTest.thickness" /> starts between 3 and 5 mm, from your deepest cutout. A cutout deeper than the card goes through it.                                              |
| <Ui k="binDesigner.cutouts.fitTest.modeOutline" /> | A thin ring around each cutout. The inside edge of the ring is where the cutout wall will be. | You only need to check how each part fits.          | <Ui k="binDesigner.cutouts.fitTest.outlineHeight" /> goes from 0.2 to 2 mm and starts at 0.6 mm. <Ui k="binDesigner.cutouts.fitTest.outlineWall" /> goes from 0.8 to 2.4 mm and starts at 1.2 mm. |

<Ui k="binDesigner.cutouts.fitTest.estimatesTitle" /> compares the filament and the time of the test with the whole bin. A card 1 mm or thicker has the design name, the clearance and the thickness on its bottom face. That way, you can tell your test prints apart.

STEP isn't available for an outline or for a design with STL imprints. Use STL or 3MF. When the test is larger than your print bed, it exports as pieces in a ZIP file.

### Correct the fit

- The part is too tight, or it rides up on the ring: increase <Ui k="binDesigner.cutouts.clearance" /> on that cutout.
- The part rattles, or a wide gap goes all the way round: decrease <Ui k="binDesigner.cutouts.clearance" />.

Then export a new test, or print the bin.

## Add finger access for a snug tool

A snug cutout holds a tool well, but the tool can be hard to lift out. Finger access cuts a scoop beside the cutout, so a fingertip gets under the tool.

1. Select the cutout.
2. In <Ui k="binDesigner.cutouts.section.shape" />, click <Ui k="binDesigner.cutouts.finger.add" />.

The scoop goes across the middle of the long side of the cutout. It's 20 mm wide and 40 mm long: half of it cuts into the plastic beside the cutout, and half lies over the cutout. It moves with the cutout. Select the scoop to change it:

- <Ui k="binDesigner.cutouts.finger.form" />: <Ui k="binDesigner.cutouts.finger.form.slot" /> or <Ui k="binDesigner.cutouts.finger.form.circle" />.
- <Ui k="binDesigner.cutouts.finger.bottom" />: <Ui k="binDesigner.cutouts.finger.bottom.curved" /> follows the fingertip. <Ui k="binDesigner.cutouts.finger.bottom.flat" /> keeps the scoop settings of the cut.

Already drew a slot or a circle for your finger? Select it, and you see the <Ui k="binDesigner.cutouts.finger.name" /> switch in place of the button. The switch changes that slot or circle into finger access.

A repeat can't get finger access, because each copy needs its own. Use <Ui k="binDesigner.cutouts.repeat.flatten" /> first.

<Screenshot id="cutouts-print-checks-finger" alt="A long rectangle cutout with a round finger access scoop across its long side." spec="Cut editor with one 140 x 22 mm rectangle. Select it and click Add finger access, then select the new scoop and pick the Round shape and Curved floor. Show the board with the slot and the scoop, and the 3D preview of the scoop. Crop to the board and the preview." />

## Next steps

- [Cutout basics](./basics): set the clearance, the entry edge and the depth.
- [Fit and tolerances](../printing/fit-and-tolerances): tune the fit of bins in your printer.
- [File formats](../printing/file-formats): pick STL, 3MF or STEP.
