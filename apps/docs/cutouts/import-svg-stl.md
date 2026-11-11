---
title: Import SVG and STL shapes
description: 'Make cutouts from an SVG or STL file, and save cutouts as an SVG at real size.'
sources:
  - src/features/bin-designer/components/panel/CutoutsSection/svgImport/
  - src/features/bin-designer/components/panel/CutoutsSection/stlImport/
  - src/features/bin-designer/components/panel/CutoutsSection/svgExport/
  - src/features/bin-designer/components/panel/CutoutsSection/ToolThicknessPrompt.tsx
  - src/shared/utils/svg/svgViewBox.ts
  - src/features/generation/worker/generators/meshImport.ts
  - src/shared/generation/meshAsset.ts
---

# Import SVG and STL shapes

The Gridfinity Layout Tool can make cutouts from files that you already have. An SVG gives flat outlines, and an STL model gives a cutout with the 3D shape of the part. You can also save cutouts as an SVG, change them in a vector app, and bring them back at the same size.

## Import an SVG as cutouts

1. Open the cutout editor. See [Cutout basics](./basics#open-the-cutout-editor).
2. Click <Ui k="binDesigner.cutouts.importSvg" />, or press <kbd>I</kbd>.
3. Select the SVG file.

Each shape in the file becomes its own cutout, with the largest shape at the bottom. The Layout Tool reads rectangles, circles, ellipses, polygons, polylines and paths. It ignores text and images. A file can have up to 500 shapes and be up to 5 MB.

### Get the size right

When the SVG gives its width and height in mm, cm, inches, points or picas, the shapes keep that real size. When the file gives no unit, the Layout Tool reads one SVG unit as 1 mm.

::: tip
Set the document units to millimeters in your vector app before you save the SVG. Then the cutouts come in at the size that you drew.
:::

### Shapes with holes

A path with an inner ring, such as the letter O or the ring of a spanner, comes in as one cutout with an island. The island is plastic that stays at full height inside the cutout. See [Trace a photo](./photo-trace#keep-holes-as-islands) for more about islands.

### Set the tool thickness

After an SVG import, the editor asks how thick the tool is. An outline has no thickness, so this step sets the cutout depth.

1. Measure the thickest part of the tool.
2. Type it in <Ui k="binDesigner.cutouts.depthPrompt.thickness" />.
3. If the tool must stand above the top, type that height in <Ui k="binDesigner.cutouts.depthPrompt.proud" />.
4. Click <Ui k="binDesigner.cutouts.depthPrompt.apply" />.

The Layout Tool cuts the cutout so the tool sits flush with the top. Click <Ui k="binDesigner.cutouts.depthPrompt.skip" /> to keep the 5 mm start depth. If the bin is too short, the prompt offers to make it taller.

## Cut an STL shape into a bin

An STL imprint is a cutout with the full 3D shape of a model, such as a model of the tool itself.

1. Open the cutout editor.
2. Click <Ui k="binDesigner.cutouts.importStl" />, or press <kbd>J</kbd>.
3. Select the STL file.
4. In <Ui k="binDesigner.cutouts.stlImport.title" />, check the position of the model. Change the rotation if necessary.
5. Click <Ui k="binDesigner.cutouts.stlImport.place" />.

<Screenshot id="cutouts-import-stl-dialog" alt="The Place STL imprint dialog shows a wrench model with rotation controls and its size." spec="Cut editor on a 4x2 bin. Import STL of a 150 mm wrench. Show the Place STL imprint dialog with the 3D view, the X, Y and Z rotation fields, the footprint size and the triangle meter. Crop to the dialog." />

### Rotation

The Layout Tool lays the model flat on one of its faces. Each axis has a rotation field that steps 15° at a time, or you can type an angle. The button beside each axis turns the model 90°. The dialog shows the footprint size, and a warning when the model is larger than the inside of the bin.

The model keeps its real size. The Layout Tool never scales it.

### What you get

The imprint lands in the middle of the bin. Its depth is the height of the model, and it starts with 0.4 mm of clearance and an entry chamfer. In the board, the imprint shows as its outline seen from above. You can move it and turn it, but you cannot change its width or height.

### Clearance

<Ui k="binDesigner.cutouts.clearance" /> makes the cutout larger than the model on every side, so the real part drops in. For an imprint, it goes up to 5 mm. Use a high value for a model from a 3D scan, because its surface can be rough.

### Limits

- The STL file can be up to 50 MB.
- The model must be watertight. If the import fails, repair the model in your slicer and export it again.
- The Layout Tool reduces each model to 50,000 triangles or fewer.
- A design holds up to 400,000 triangles of imprints. The dialog shows how many the new model uses.
- An imprint cannot lean, and it has no depth mode.

## Export a cutout as SVG

1. Select one or more cutouts.
2. Right-click the selection.
3. Click <Ui k="binDesigner.cutouts.exportSvg" />.

The file uses millimeters, so it opens at real size in a vector app. Rectangles and circles stay rectangles and circles. Paths keep their curves, and islands come with them. The outline is the size that you drew, with no clearance.

Use this to clean up a traced tool in a vector app. Then import the file again with <Ui k="binDesigner.cutouts.importSvg" />. It comes back at the same size.

## Next steps

- [Arrange cutouts](./arranging): line up and pack the imported shapes.
- [Trace a photo](./photo-trace): make an outline from a photo of the tool.
- [Check before you print](./print-checks): print a fit test of the new cutouts.
- [Workshop](./workshop#export-a-shadow-board): save the whole bin top as SVG or DXF.
