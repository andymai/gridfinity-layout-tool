---
title: Trace a photo
description: 'Trace tools from a photo on your computer, keep their holes, tidy the outlines, and save them as a file.'
sources:
  - src/features/bin-designer/components/TraceView/
  - src/features/bin-designer/components/OutlineCleanup/
  - src/shared/scanReview/
  - src/shared/outlineCleanup/
  - src/features/bin-designer/components/panel/CutoutsSection/handlers/pathEditHandler.ts
  - src/features/bin-designer/components/panel/CutoutsSection/scanImport/useScanImport.ts
---

# Trace a photo

The Gridfinity Layout Tool can find the outline of each tool in a photo and make a cutout that fits it. Use this page when the photo is already on your computer. To take a new photo with your phone, see [Scan with your phone](./phone-scan). The photo never leaves your computer.

## Open Trace a photo

1. Open the cutout editor. See [Cutout basics](./basics#open-the-cutout-editor).
2. Click <Ui k="binDesigner.cutouts.scanImport.title" /> in the editor header.
3. Click <Ui k="binDesigner.cutouts.traceView.open" />.
4. Drop a photo on the window, or click <Ui k="binDesigner.cutouts.traceView.drop.choose" />.

You can also drop a photo on the board, or paste one with <kbd>Ctrl</kbd>+<kbd>V</kbd>. <Ui k="binDesigner.cutouts.traceView.title" /> then opens with that photo.

## Take a photo that traces well

- Lay the tools on a plain surface, with a gap between each tool.
- Take the photo from straight above.
- Put a size reference in the photo: a bank card, the printed calibration sheet, a Gridfinity baseplate or a measuring strip. [Scan with your phone](./phone-scan#pick-a-size-reference) tells you how to place each one.

## Set the scale

When the photo has a size reference, the Layout Tool finds it and sets the scale. The <Ui k="binDesigner.cutouts.traceView.scale.heading" /> section tells you which reference it used.

When the photo has no reference, set the scale yourself with one of these:

- <Ui k="binDesigner.cutouts.traceView.scale.drawRuler" />: click both ends of something with a known length. Type it in <Ui k="binDesigner.cutouts.traceView.ruler.length" /> and click <Ui k="binDesigner.cutouts.traceView.apply" />.
- <Ui k="binDesigner.cutouts.traceView.scale.markPaper" />: pick <Ui k="binDesigner.cutouts.traceView.paper.a4" /> or <Ui k="binDesigner.cutouts.traceView.paper.letter" />, then click the four corners of the sheet. The Layout Tool then looks for tools only on the sheet.

Drag a ruler end or a corner to move it. While you place a point, a magnifier shows the area under it close up.

::: warning
If the photo shows the sheet at a steep angle, take the photo again from above, or draw a ruler. At a steep angle, the long and short sides of the sheet look alike.
:::

## Pick the tools

The <Ui k="binDesigner.cutouts.traceView.tools.heading" /> section lists each tool that the Layout Tool finds.

- Click a tool in the photo to draw its outline again, or to add a tool that it did not find.
- Remove a tool that you do not want.
- Click <Ui k="binDesigner.cutouts.traceView.region.draw" /> and drag a box around the tools to look only in that area.
- Move <Ui k="binDesigner.cutouts.traceView.sensitivity" /> up to find faint tools, or down to remove shadows and specks. <Ui k="binDesigner.cutouts.traceView.sensitivityAuto" /> lets the Layout Tool choose.

Click the add button to put the tools in the bin. For one tool, it reads <Ui k="binDesigner.cutouts.scanImport.add" />. Several tools come in as one group, so you can move them as a block. The editor then asks how thick each tool is. See [Set the tool thickness](./import-svg-stl#set-the-tool-thickness).

<Screenshot id="cutouts-photo-trace-view" alt="Trace a photo shows three tools on a calibration sheet, each with a traced outline." spec="Bin designer, Cut editor, Scan a tool, From a photo on this computer. Load a photo of a wrench, a screwdriver and pliers on the printed calibration sheet. Show the photo with the three outlines, the Scale section with the sheet message, the Tools list and the footer buttons. Crop to the full Trace a photo window." />

## Keep holes as islands

Some tools have holes, such as the ring of a spanner. Turn on <Ui k="scan.review.keepHoles" /> to keep plastic in each hole. This plastic is an island: it stays at full height inside the cutout, so the tool sits around it. A tool that lies inside a hole comes in as a separate tool.

<Ui k="scan.review.keepHoles" /> is off at the start, because a shiny reflection can look like a hole.

In the bin, the clearance makes each island smaller, and the entry edge runs around it. A cutout keeps up to 64 islands. When an island becomes too thin to print, <Ui k="binDesigner.cutoutEditor.checks.title" /> shows a warning with <Ui k="binDesigner.cutoutEditor.checks.islandFix" />.

## Tidy up an outline

Before you add the tools, <Ui k="binDesigner.cutouts.traceView.cleanup.heading" /> changes every outline in the photo. After you add them, select one traced or drawn outline in the cutout editor and open <Ui k="binDesigner.cutouts.outline.section" />:

| Setting                                            | What it does                                                                                                                                                                   |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| <Ui k="binDesigner.cutouts.outline.simplify" />    | Fits the outline with fewer points. A higher value gives a simpler outline.                                                                                                    |
| <Ui k="binDesigner.cutouts.outline.curves" />      | Changes many short straight steps into smooth curves with handles.                                                                                                             |
| <Ui k="binDesigner.cutouts.outline.straighten" />  | Makes edges that are almost square to the bin fully square.                                                                                                                    |
| <Ui k="binDesigner.cutouts.outline.mirror" />      | Makes the outline the same on both sides of a <Ui k="binDesigner.cutouts.outline.axis" />. <Ui k="binDesigner.cutouts.outline.keep" /> picks one half, or the average of both. |
| <Ui k="binDesigner.cutouts.outline.roundInside" /> | Rounds the inside corners of the outline.                                                                                                                                      |

Each change starts from the outline that you had when you opened the section, so you can move a slider back and forth. <Ui k="binDesigner.cutouts.outline.reset" /> puts the outline back. With several tools in one photo, mirror each tool after you add it.

## Edit points up close

1. Double-click a traced or drawn outline.
2. Drag a point or a curve handle to move it.
3. Click an edge to add a point.
4. To remove a point, select it and press <kbd>Delete</kbd>.
5. Press <kbd>Esc</kbd> when you finish.

The points of the islands are also editable. While you drag a point, a magnifier in the corner shows it close up, so it lands on the edge.

## Save traced tools as a file

In <Ui k="binDesigner.cutouts.traceView.title" />, click <Ui k="scan.export.button.export" />. Pick a <Ui k="scan.export.format" />:

| Format                                                                 | Use it for                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| <Ui k="scan.export.format.svg" /> or <Ui k="scan.export.format.dxf" /> | A laser cutter, a vinyl cutter or a vector app.                                                                    |
| <Ui k="scan.export.format.stl" />                                      | A solid to subtract from a model in your CAD app. Set its <Ui k="scan.export.thickness" />, which starts at 10 mm. |

The outlines are at true size. Tick the clearance box to add 0.4 mm on each side, the same room that a cutout leaves around the tool. On a phone, <Ui k="scan.export.button.download" /> on the review screen does the same.

## Next steps

- [Scan with your phone](./phone-scan): take the photo with your phone and send the outline to the computer.
- [Arrange cutouts](./arranging): pack the traced tools in the bin.
- [Check before you print](./print-checks): print a fit test before the full bin.
