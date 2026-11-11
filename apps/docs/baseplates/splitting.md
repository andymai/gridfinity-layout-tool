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

Most drawers are larger than a print bed. The baseplate generator cuts a large plate into pieces that each fit your printer, and it can add connectors that lock the pieces together. This page shows how to control where the plate splits and how the pieces join.

## Set your print bed size

1. In the baseplate generator, open <Ui k="common.physicalUnits" />.
2. Enter your bed in <Ui k="baseplate.printBedSize" />. The default is 256 mm.
3. If your bed is not square, click the link button and enter the width and the depth.

A plate that is larger than the bed splits automatically. The print bed size belongs to the layout, so the bins of the layout use the same value.

## Read the automatic split

When the plate splits, a map of the pieces shows at the bottom of the panel. The map shows the number of pieces, the bed size, and the number of build-plate loads.

The Layout Tool looks for the split with the fewest build-plate loads, not the fewest pieces. It can use more, smaller pieces when they pack onto fewer beds. It also includes the connector tongues in the size of each piece, so a piece with a tongue still fits the bed.

Each piece has a label, such as A1 or B2. The letter counts the columns from the left, and the number counts the rows from the front. Point at a piece in the map to find it in the preview.

If less margin can save pieces, the map tells you how much to remove and from which sides.

<Screenshot id="baseplates-splitting-map" alt="The split map of a plate in six pieces, with the seam ticks on the rulers beside it." spec="Baseplate generator, 10 by 7 plate on a 256 mm print bed so that it splits into several pieces. Scroll the panel to the split map at the bottom. Show the map with piece labels, the rulers with seam ticks, and the Reset to automatic line if present. Crop to the map area." />

## Draw your own split lines

You can decide where the plate breaks, for example to keep a seam away from a heavy bin.

1. Find the rulers above and to the left of the map. Each tick is a line between two grid cells.
2. Click a tick to add a split on that line. Click a split again to remove it.
3. To go back to the automatic plan, click <Ui k="baseplate.splitResetAuto" />.

A split can only go on a line between cells. While your own plan is active, the map shows <Ui k="baseplate.splitCustom" />. If you change the plate size, the Layout Tool drops your plan and splits the plate automatically again.

::: warning
If a piece of your plan is larger than the bed, the map shows a warning and you cannot export the plate. The bed check does not turn a piece by 90°. Add a split, or reset to the automatic plan.
:::

## Lock the pieces together

By default the pieces sit loose next to each other. To join them, pick a style under <Ui k="baseplate.connectors.label" /> in the <Ui k="baseplate.sectionBase" /> section. The section shows connectors only when the plate splits.

| Style                                           | How it joins                                   |
| ----------------------------------------------- | ---------------------------------------------- |
| <Ui k="baseplate.connectors.none" />            | <Ui k="baseplate.connectorDesc.none" />        |
| <Ui k="baseplate.connectorStyle.dovetail" />    | <Ui k="baseplate.connectorDesc.dovetail" />    |
| <Ui k="baseplate.connectorStyle.puzzle" />      | <Ui k="baseplate.connectorDesc.puzzle" />      |
| <Ui k="baseplate.connectorStyle.dovetailKey" /> | <Ui k="baseplate.connectorDesc.dovetailKey" /> |
| <Ui k="baseplate.connectorStyle.snapClip" />    | <Ui k="baseplate.connectorDesc.snapClip" />    |

A <Ui k="baseplate.connectorStyle.dovetailKey" /> or a <Ui k="baseplate.connectorStyle.snapClip" /> is a separate part. The export includes its file and the number of copies to print. You fit one into each seam junction from the top, as the print guide tells you.

When you select a style, more settings show:

- <Ui k="baseplate.connectorFit.label" /> changes the connector gap, from −0.3 to +0.3 mm in steps of 0.05 mm. A higher value gives a looser fit.
- <Ui k="baseplate.dovetails.invert" /> swaps the tongue and groove sides on the seams. It applies to Dovetail and Puzzle.
- <Ui k="baseplate.connectorSlotsAllEdges" /> also cuts slots into the outer edges, so each piece can key onto a plate that you print later. It applies to Puzzle key and Snap clip. Edges with a margin get no slots.
- <Ui k="baseplate.preferIdenticalPieces" /> makes opposite pieces the same shape, so the print guide can group them. This works only when opposite margins are equal.

A <Ui k="baseplate.connectorStyle.snapClip" /> needs a plate that is tall enough. A low-profile plate without magnet holes or a solid floor is too thin for clips. Snap clips also do not work with <Ui k="baseplate.stackPrint.enable" />.

When your <Ui k="settings.nozzleSize" /> is more than 0.4 mm, the Layout Tool makes the connectors larger, so that your nozzle can print them.

### Test the fit first

Click <Ui k="baseplate.connectorSample.button" /> below the connector settings. You get a small test print of your connector style at a range of fit values. Each coupon shows its value on the surface.

1. Print the test flat, with no supports.
2. Use the same printer, filament and nozzle as for the plate.
3. Find the coupon that fits best.
4. Set <Ui k="baseplate.connectorFit.label" /> to the value on that coupon.

## Detach the margins

Wide margins make large pieces. <Ui k="baseplate.detachMargins" /> in <Ui k="baseplate.sectionDimensions" /> prints each margin as a separate strip. A margin must be at least 8 mm wide to detach. If one strip prints badly, you can print that strip again by itself.

Turn on <Ui k="baseplate.detachMarginConnector" /> to join each strip to the plate with the seam connector. This needs the Dovetail, Puzzle or Puzzle key style. Without it, the strips stay in place by friction. A plate with a custom drawer shape cannot detach its margins.

## Export a split plate

Click <Ui k="common.export" /> in the header. The export dialog shows that the plate exceeds the bed, with the <Ui k="baseplate.export.enableSplit" /> box selected. Click the download button to get a ZIP with these files:

- One file for each piece, named by its label, such as A1. Print each file once.
- `print-guide.txt`, with the piece sizes, the connector notes and a map of the assembly.
- `assembly-map.png`, a top view that shows where each piece goes.

The guide groups pieces with the same shape, so that you can print any copy again. To get one file of the whole plate, clear <Ui k="baseplate.export.enableSplit" />.

## Next steps

- [Eco plates and stack printing](./eco-and-stack-printing): stack the pieces into towers and print them in fewer jobs.
- [Drawers that are not rectangles](./odd-shaped-drawers): see how a custom shape changes the split.
- [Fitting the print bed](../concepts/print-bed-fit): learn how bins split for the same bed.
- [Fit and tolerances](../printing/fit-and-tolerances): find the other fit tests in the Layout Tool.
