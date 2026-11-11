---
title: Split for your print bed
description: 'Cut a large baseplate into pieces that fit your printer, draw your own splits, and join the pieces.'
sources:
  - src/features/baseplate/utils/splitPlanner.ts
  - src/features/baseplate/components/BaseplatePanel/SplitViewStrip.tsx
  - src/features/baseplate/components/BaseplatePanel/BaseSection.tsx
  - src/features/baseplate/utils/splitOverride.ts
  - src/shared/constants/connectors.ts
  - src/features/baseplate/utils/splitMargins.ts
  - src/features/baseplate/utils/printGuide.ts
  - src/features/baseplate/utils/buildBaseplateExportPieces.ts
---

# Split for your print bed

Most drawers are bigger than a print bed. That's fine. The baseplate generator cuts a big plate into pieces that each fit your printer, and it can add connectors to lock them together. Here's how to control where the plate splits and how the pieces join.

## Set your print bed size

1. In the baseplate generator, open <Ui k="common.physicalUnits" />.
2. Type your bed size in <Ui k="baseplate.printBedSize" />. The default is 256 mm.
3. Is your bed not square? Click the link button and type the width and the depth.

Any plate that is bigger than the bed splits automatically. The print bed size belongs to the layout, so the bins of the layout use the same value.

## Read the automatic split

When the plate splits, a map of the pieces appears at the bottom of the panel. It shows how many pieces you get, the bed size, and how many build-plate loads they take.

The Layout Tool aims for the fewest build-plate loads, not the fewest pieces. So it can pick more, smaller pieces when they pack onto fewer beds. It also counts the connector tongues in the size of each piece, so a piece with a tongue still fits the bed.

Each piece has a label, such as A1 or B2. The letter counts the columns from the left, and the number counts the rows from the front. Hover over a piece in the map to find it in the preview.

If a smaller margin can save pieces, the map tells you how much to remove and from which sides.

<Screenshot id="baseplates-splitting-map" alt="The split map of a plate in four pieces, with seam ticks on the rulers. A click on a tick adds a split, and a click on the old split removes it. The map then shows Custom split and Reset to automatic." spec="Baseplate generator, 10 by 7 plate on a 256 mm print bed, so that it splits into four pieces. Scroll the panel to the split map. Click the ruler tick at column 4, then the automatic split at column 5. Crop to the map area." />

## Draw your own split lines

Want a seam somewhere else, for example away from a heavy bin? You decide where the plate breaks.

1. Find the rulers above and to the left of the map. Each tick is a line between two grid cells.
2. Click a tick to add a split on that line. Click the split again to remove it.
3. To go back to the automatic plan, click <Ui k="baseplate.splitResetAuto" />.

A split can only go on a line between cells. While your own plan is active, the map shows <Ui k="baseplate.splitCustom" />. If you change the plate size, the Layout Tool drops your plan and splits the plate automatically again.

::: warning
If a piece of your plan is bigger than the bed, the map shows a warning and you can't export the plate. The bed check doesn't turn a piece by 90°. Add a split, or reset to the automatic plan.
:::

## Lock the pieces together

By default, <Ui k="baseplate.connectors.label" /> shows <Ui k="baseplate.connectors.none" />, and the pieces sit loose next to each other. To join them, pick a style under <Ui k="baseplate.connectors.label" /> in the <Ui k="baseplate.sectionBase" /> section. Connectors appear there only when the plate splits.

| Style                                           | How it joins                                   |
| ----------------------------------------------- | ---------------------------------------------- |
| <Ui k="baseplate.connectors.none" />            | <Ui k="baseplate.connectorDesc.none" />        |
| <Ui k="baseplate.connectorStyle.dovetail" />    | <Ui k="baseplate.connectorDesc.dovetail" />    |
| <Ui k="baseplate.connectorStyle.puzzle" />      | <Ui k="baseplate.connectorDesc.puzzle" />      |
| <Ui k="baseplate.connectorStyle.dovetailKey" /> | <Ui k="baseplate.connectorDesc.dovetailKey" /> |
| <Ui k="baseplate.connectorStyle.snapClip" />    | <Ui k="baseplate.connectorDesc.snapClip" />    |

A <Ui k="baseplate.connectorStyle.dovetailKey" /> or a <Ui k="baseplate.connectorStyle.snapClip" /> is a separate small part. The export includes its file and tells you how many copies to print. You put one into each seam junction from the top, as the print guide shows.

Pick a style, and more settings appear:

- <Ui k="baseplate.connectorFit.label" /> changes the connector gap, from −0.3 to +0.3 mm in steps of 0.05 mm. A higher value gives a looser fit.
- <Ui k="baseplate.dovetails.invert" /> swaps the tongue and groove sides on the seams. It works with <Ui k="baseplate.connectorStyle.dovetail" /> and <Ui k="baseplate.connectorStyle.puzzle" />.
- <Ui k="baseplate.connectorSlotsAllEdges" /> also cuts slots into the outer edges, so each piece can key onto a plate that you print later. It works with <Ui k="baseplate.connectorStyle.dovetailKey" /> and <Ui k="baseplate.connectorStyle.snapClip" />. Edges with a margin get no slots.
- <Ui k="baseplate.preferIdenticalPieces" /> makes opposite pieces the same shape, so the print guide can group them. This works only when opposite margins are equal.

A <Ui k="baseplate.connectorStyle.snapClip" /> needs a plate that is tall enough. A low-profile plate without magnet holes or a solid floor is too thin for clips. Snap clips also don't work with <Ui k="baseplate.stackPrint.enable" />.

With a <Ui k="settings.nozzleSize" /> above 0.4 mm, the Layout Tool makes the connectors bigger, so that your nozzle can print them.

### Test the fit first

Before you print a whole drawer of pieces, print a small test. Click <Ui k="baseplate.connectorSample.button" /> below the connector settings. You get your connector style at a range of fit values, and each coupon shows its value on the surface.

1. Print the test flat, with no supports. Use the same printer, filament and nozzle as for the plate.
2. Find the coupon that fits best.
3. Set <Ui k="baseplate.connectorFit.label" /> to the value on that coupon.

## Detach the margins

Wide margins make big pieces. Turn on <Ui k="baseplate.detachMargins" /> in <Ui k="baseplate.sectionDimensions" /> to print each margin as a separate strip. A margin must be at least 8 mm wide to detach. A bonus: if one strip prints badly, you can print that strip again by itself.

Turn on <Ui k="baseplate.detachMarginConnector" /> to join each strip to the plate with the seam connector. This needs a connector on the seams, of any style except <Ui k="baseplate.connectorStyle.snapClip" />. Without it, the strips stay in place by friction. A plate with a custom drawer shape can't detach its margins.

## Export a split plate

Click <Ui k="common.export" /> in the header. The export dialog tells you that the plate is bigger than the bed, and it selects the <Ui k="baseplate.export.enableSplit" /> box for you. Click the download button to get a ZIP with these files:

- One file for each piece, named by its label, such as A1. Print each file once.
- `print-guide.txt`, with the piece sizes, the connector notes and a map of the assembly.
- `assembly-map.png`, a top view that shows where each piece goes.

The guide groups pieces with the same shape, so you can print any copy again later. Want one file of the whole plate instead? Clear <Ui k="baseplate.export.enableSplit" />.

## Next steps

- [Eco plates and stack printing](./eco-and-stack-printing): stack the pieces into towers and print them in fewer jobs.
- [Drawers that are not rectangles](./odd-shaped-drawers): see how a custom shape changes the split.
- [Fitting the print bed](../concepts/print-bed-fit): learn how bins split for the same bed.
- [Fit and tolerances](../printing/fit-and-tolerances): find the other fit tests in the Layout Tool.
