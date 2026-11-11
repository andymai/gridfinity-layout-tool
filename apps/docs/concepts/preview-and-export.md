---
title: Preview and export
description: 'See why the 3D preview shows a quick draft before the exact model, and why an export takes longer.'
sources:
  - src/features/bin-designer/hooks/useGeneration.ts
  - src/features/generation/README.md
  - src/features/generation/worker/generators/pipeline/stages/shellStage.ts
  - src/features/generation/worker/generators/utils/tolerances.ts
  - src/shared/generation/meshPersistence.ts
  - src/features/bin-designer/components/preview/BinMesh/BinMesh.tsx
  - src/features/grid-editor/components/Grid/IsometricPreview/
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

<Screenshot id="concepts-preview-draft-exact" alt="The same bin as a one-color draft and as the exact model with its color zones." spec="Bin designer, desktop. Bin 2 × 2 × 3u, standard base, stacking lip on, Multi-color on with body grey and stacking lip orange. Capture two frames: one right after a height change while the draft shows, one after the exact model arrives. Place them side by side and crop to the bin." />

## What the export does differently

An export doesn't use the draft. It builds the exact model again, with three differences:

- **The feet join the body.** The preview keeps the feet as a separate piece to save time, and the joint is out of sight. The export joins them into one closed solid, so the slicer reads one sound part.
- **The mesh is finer.** The export uses more and smaller triangles, so curves and chamfers come out smoother.
- **The time limit is longer.** A complex bin can take much longer to export than to preview.

That's why an export takes longer than the preview. The bin designer gets a head start, though. When you stop editing for about two seconds after the exact model arrives, it starts the export build in the background. An export that you start after that pause can finish sooner.

<Ui k="common.export" /> becomes active when the preview has a model.

## The 3D preview of a layout

The layout editor draws its 3D preview from the layout itself, not from the geometry engine. A plain bin shows as a simple shape with its size and category color. A bin linked to a saved design shows the model of that design. <Ui k="layoutExport.button" /> builds the exact model of each linked bin, the same way the bin designer does.

## Next steps

- [File formats](../printing/file-formats): pick STL, 3MF or STEP for your export
- [The print list and ZIP export](../printing/print-list-and-zip): export every bin in a layout at once
- [Multi-color printing](./multi-color): see what the 3MF file carries for each color zone
- [Saved designs and linked bins](./saved-designs): see how a layout shows the model of a saved design
- [SpaceMouse](../settings/spacemouse): move the 3D preview with a 3Dconnexion SpaceMouse
