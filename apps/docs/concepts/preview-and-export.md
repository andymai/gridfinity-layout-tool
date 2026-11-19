---
title: Preview and export
description: 'Use the 3D preview toolbar to turn, see through and measure a model, and see why the preview shows a quick draft and an export takes longer.'
sources:
  - src/features/bin-designer/components/preview/PreviewControls/PreviewControls.tsx
  - src/features/baseplate/components/BaseplatePreview/BaseplatePreviewControls.tsx
  - src/features/baseplate/components/BaseplatePreview/BaseplatePreview.tsx
  - src/features/bin-designer/components/PreviewCanvas/PreviewCanvas.tsx
  - src/features/bin-designer/components/PreviewCanvas/MeasureOverlay.tsx
  - src/features/bin-designer/components/preview/MeasureTool/MeasureTool.tsx
  - src/features/bin-designer/utils/measure3d.ts
  - src/features/bin-designer/store/slices/uiSlice.ts
  - src/features/bin-designer/hooks/useZoneColoredMesh.ts
  - src/features/bin-designer/hooks/useDesignerKeyboard.ts
  - src/features/baseplate/hooks/useBaseplateKeyboard.ts
  - src/features/bin-designer/hooks/useGeneration.ts
  - src/features/generation/README.md
  - src/features/generation/worker/generators/pipeline/stages/shellStage.ts
  - src/features/generation/worker/generators/utils/tolerances.ts
  - src/shared/generation/meshPersistence.ts
  - src/features/bin-designer/components/preview/BinMesh/BinMesh.tsx
  - src/features/grid-editor/components/Grid/IsometricPreview/
  - src/features/bin-designer/components/preview/PreviewSkeleton/PreviewSkeleton.tsx
  - src/features/bin-designer/hooks/useExport.ts
---

# Preview and export

Change a bin or a baseplate, and the Gridfinity Layout Tool shows you a quick draft first, then the exact model. It works like a sketch before the final drawing: you see the shape right away, and the details follow a moment later. An export always builds the exact model again, at full quality. Here's what happens at each step, so a preview that changes for a moment, or an export that takes a while, won't surprise you.

## From an edit to the exact model

The bin designer and the baseplate generator build the model in your browser. Each edit goes through up to three steps:

1. **Instant draft.** For a simple bin, the Layout Tool draws a quick shape at once, before the geometry engine starts. A simple bin has a rectangular footprint and a standard base, with or without magnet or screw holes.
2. **Fast draft.** For other bins, a second, faster engine builds a coarse model while the exact model computes. The Layout Tool skips this step when it expects the exact model to arrive quickly.
3. **Exact model.** The main geometry engine builds the exact model. It replaces the draft when it's ready.

A bin gets one draft at most. When the instant draft appears, the fast draft does not run.

Curious about a different engine? Labs has a second geometry engine that you can try in place of the main one. See [Alternative 3D engine](../settings/labs#alternative-3d-engine).

In the baseplate generator, <Ui k="baseplate.computingGeometry" /> shows while the exact plate replaces the quick draft.

## Why the draft can look different

A draft is an approximation. These differences are normal, and they go away when the exact model arrives:

| On the draft you see                                                       | Why                                                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| The bin in one color                                                       | The instant draft carries no color zones. The exact model adds them.     |
| Solid feet on a magnet or screw base                                       | The holes are on the underside. The exact model cuts them.               |
| Flat panels for a <Ui k="binDesigner.walls.pattern.groupKumiko" /> pattern | The fast draft cannot make the lattice. The exact model draws it.        |
| Edges that fade in                                                         | The edge lines appear gradually when the exact model replaces the draft. |

On a slow device, a large design can take longer than the preview allows. The draft then stays as the preview. Don't worry: the export still builds the exact model, because an export gets more time.

::: tip
When you open a saved design again, the preview shows the exact model from your last session at once. The Layout Tool keeps it in this browser and rebuilds the model in the background.
:::

<Screenshot id="concepts-preview-draft-exact" alt="A click makes the bin one height unit taller. The preview shows a one-color draft first, then the exact model with its orange stacking lip." spec="Clip. Bin designer, bin 2 × 2, standard base, stacking lip on, Multi-color on with body grey and stacking lip orange. Close-up: the height stepper goes from 3 to 4. Cut to the preview: the one-color draft, then the exact model with its color zones." />

## Look at the 3D preview

The bin designer and the baseplate generator have a toolbar at the top of the 3D preview. Use it to turn the camera, to see through the model and to measure it.

| Tool                                                                                                                            | What it does                                                                                                           | Key in the bin designer      |
| ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| <Ui k="workshop.view.front" />, <Ui k="workshop.view.side" />, <Ui k="workshop.view.top" />, <Ui k="workshop.view.isometric" /> | Turns the camera to the front, the side or the top of the model, or to a corner view from above.                       | <kbd>1</kbd> to <kbd>4</kbd> |
| <Ui k="common.reset" />                                                                                                         | Turns the camera back to the <Ui k="workshop.view.isometric" /> view. On a phone or tablet, tap the preview two times. | <kbd>R</kbd>                 |
| <Ui k="binDesigner.wire" />                                                                                                     | Shows the model as a mesh of triangles.                                                                                | <kbd>W</kbd>                 |
| <Ui k="binDesigner.xray" />                                                                                                     | Makes the faces of the model see-through, so you can see the holes and pockets behind them.                            | <kbd>X</kbd>                 |
| <Ui k="binDesigner.measure.short" />                                                                                            | Measures the model. See [Measure the model](#measure-the-model).                                                       | None                         |
| <Ui k="binDesigner.projectionPerspective" /> or <Ui k="binDesigner.projectionOrthographic" />                                   | Changes between a perspective view and an orthographic view. The button shows the current view.                        | <kbd>P</kbd>                 |
| <Ui k="common.color" />                                                                                                         | Changes the color of the preview. The bin designer hides it while <Ui k="binDesigner.group.colors" /> is on.           | None                         |
| <Ui k="binDesigner.splitAssembled" />, <Ui k="binDesigner.splitExploded" />                                                     | Shows the pieces of a split bin or plate together, or apart. These buttons show only for a model in pieces.            | None                         |

On a narrow preview, the toolbar shows icons only. Put the pointer on an icon to see its name and its key.

The baseplate generator has the same toolbar without <Ui k="binDesigner.wire" /> and <Ui k="binDesigner.measure.short" />. There, <Ui k="common.reset" /> turns the camera to the <Ui k="baseplate.topView" /> view. Only two keys work: <kbd>X</kbd> for <Ui k="baseplate.xray" />, and <kbd>P</kbd> for perspective or orthographic.

### Measure the model

<Ui k="binDesigner.measure.short" /> gives the size of a part of the 3D model in the bin designer. It has two modes:

- <Ui k="binDesigner.measure.modePoints" /> gives the distance between two points that you click.
- <Ui k="binDesigner.measure.modeThickness" /> gives the thickness of the material where you click, for example a wall or the floor.

To measure:

1. Click <Ui k="binDesigner.measure.short" /> in the toolbar. A bar opens at the top of the preview.
2. In the bar, click <Ui k="binDesigner.measure.modePoints" /> or <Ui k="binDesigner.measure.modeThickness" />.
3. Click a point on the model. For <Ui k="binDesigner.measure.modePoints" />, click a second point. You can drag to turn the model between the two clicks.
4. Read the result in the bar, in millimeters.

In <Ui k="binDesigner.measure.modePoints" />, a point that you click snaps to a nearby corner or edge of the model. <Ui k="binDesigner.measure.modeThickness" /> measures from the exact spot that you click. For two points, the preview also shows the distance along X, Y and Z. A third click starts a new measurement.

To remove the measurement, click <Ui k="binDesigner.measure.clear" /> or press <kbd>Escape</kbd>. To close the tool, press <kbd>Escape</kbd> again, or click the X at the end of the bar.

With a mouse, you can also measure while the tool is closed. Hold <kbd>Shift</kbd> and drag from one point on the model to another. Press <kbd>Escape</kbd> to remove that measurement.

<Ui k="binDesigner.measure.short" /> and the color tools of [Colors](../designer/colors) both use clicks on the model. When you open one, the other closes.

<Screenshot id="concepts-preview-measure" alt="A click on Measure in the preview toolbar opens a bar with Two points and Thickness. Two clicks on the rim of the bin show the distance between them. Then Thickness and a click on the front wall show how thick the wall is." spec="Clip. Bin designer, desktop, bin 2 × 2 × 3 with two compartments. Click Measure in the preview toolbar. Click the top of the front wall, then the top of the back wall, so the distance shows. Click Thickness in the bar, then click the front wall. End on the thickness value." />

## What the export does differently

An export doesn't use the draft. It builds the exact model again, with three differences:

- **The feet join the body.** The preview keeps the feet as a separate piece to save time, and the joint is out of sight. The export joins them into one closed solid, so the slicer reads one sound part.
- **The mesh is finer.** The export uses more and smaller triangles, so curves and chamfers come out smoother.
- **The time limit is longer.** A complex bin can take much longer to export than to preview.

That's why an export takes longer than the preview. The bin designer gets a head start, though. When you stop editing for about two seconds after the exact model arrives, it starts the export build in the background. An export that you start after that pause can finish sooner.

<Ui k="common.export" /> becomes active when the preview has a model.

## The 3D preview of a layout

The layout editor draws its 3D preview from the layout itself, not from the geometry engine. A plain bin shows as a simple shape with its size and category color. A bin linked to a saved design shows the model of that design. <Ui k="layoutExport.button" /> builds the exact model of each linked bin, the same way the bin designer does.

<Screenshot id="concepts-preview-layout-models" alt="The 3D preview of a layout. The linked Small parts bin shows the model of its design, with four compartments and label tabs. The other bins show as plain boxes in their category colors." spec="Layout editor, drawer 6 × 3 with four bins. One bin is linked to a saved 2 × 2 design with four compartments, label tabs and a scoop. Expanded 3D preview. Crop to the bins." />

## When it goes wrong

### The preview shows a message about the 3D engine

Update your browser, or open the Layout Tool in a recent Chrome, Edge, Firefox or Safari. If the message says that the engine failed to load, check your connection. Then click <Ui k="binDesigner.retry" />, or reload the page.

The bin designer and the baseplate generator build each model in your browser, with WebAssembly. An old browser, or a security setting that turns WebAssembly off, stops the engine.

### The preview says the model failed

Click <Ui k="binDesigner.revertToWorking" /> to undo your last change, or click <Ui k="binDesigner.retry" />. Then change one value at a time, to find the one that breaks the model. <Ui k="common.export" /> stays gray until the preview has a model.

### The export stops with an error

Read the message. For a timeout or a memory error, make the bin lower, or make the wall pattern bolder or turn it off. Then export again. See [The export stops with an error](../printing/troubleshooting#the-export-stops-with-an-error).

The export builds the finest model of the three steps, so a very complex design can run out of time or memory in the browser.

## Next steps

- [File formats](../printing/file-formats): pick STL, 3MF or STEP for your export
- [The print list and ZIP export](../printing/print-list-and-zip): export every bin in a layout at once
- [Multi-color printing](./multi-color): see what the 3MF file carries for each color zone
- [Saved designs and linked bins](./saved-designs): see how a layout shows the model of a saved design
- [SpaceMouse](../settings/spacemouse): move the 3D preview with a 3Dconnexion SpaceMouse
- [Keyboard shortcuts](../reference/shortcuts): see every key of the 3D preview
