---
title: Drawers that are not rectangles
description: 'Make a baseplate for a drawer with cut corners, curves or a notch, and move its grid.'
sources:
  - src/features/baseplate/utils/buildFullParams.ts
  - src/features/baseplate/components/BaseplatePanel/DimensionsSection.tsx
  - src/features/baseplate/components/BaseplatePanel/panelState.ts
  - src/shared/components/GridAlignmentControls/
  - src/features/drawer-shape/
  - src/features/baseplate/utils/printGuide.ts
---

# Drawers that are not rectangles

Some drawers have round corners, a cut corner, or a notch for a rail. When your layout has a custom drawer shape, the baseplate generator cuts the plate to that shape. This page shows how the plate follows the shape and which settings change.

## Give the drawer a shape

You draw the shape in the layout editor, not in the baseplate generator.

1. In the layout editor, turn on <Ui k="drawerShape.toggle" />. This opens a grid where you remove cells from the drawer.
2. For other ways to make the shape, open the <Ui k="drawerShape.actions" /> menu next to the toggle. It has <Ui k="drawerShape.corners.open" /> and <Ui k="drawerShape.penOpen" />. When the drawer has a shape, it also has <Ui k="drawerShape.edit" />.

With <Ui k="drawerShape.penOpen" /> you can drag corners, curve edges, and import an outline from an SVG or DXF file. See [Set up the drawer](../layouts/drawer-setup) for the full steps.

## How the plate follows the shape

The plate uses the drawer shape only when <Ui k="baseplate.syncWithLayout" /> is on. A plate with a custom size has no link to the drawer, so it stays a rectangle.

The shape cuts through some grid cells. A cut cell keeps a sliced pocket when at least a quarter of the cell stays inside the shape. A sliced pocket holds nothing, and it leaves broken wall pieces along the edge.

To get a clean edge, turn on <Ui k="baseplate.wholeCellsOnly" /> under <Ui k="baseplate.padding" />. The plate then drops each pocket that the shape cuts, and solid plastic fills the edge. This option shows for every shaped plate, and for a plate with a large corner radius. It is off by default.

When the shape makes the plate larger than the grid cells, the size under the steppers shows <Ui k="baseplate.inclShape" />.

<Screenshot id="baseplates-shaped-plate" alt="A baseplate cut to a drawer shape with two rounded corners and a notch." spec="Baseplate generator. Layout with an 8 by 6 drawer, a custom shape from Draw shape with two rounded back corners and a front-right notch. Sync with layout on. Preview in iso view. Show the panel with Grid position and Fit whole cells only visible. Crop to the app window." />

## Move the grid inside the shape

On a shaped plate, the outer size comes from the drawer. The only free choice is where the cells sit inside the shape.

1. In <Ui k="baseplate.sectionDimensions" />, find <Ui k="baseplate.gridPosition" />.
2. Change the X and Y values of <Ui k="drawerShape.gridAlignment.title" />. For example, move the grid against the front-left corner.
3. To go back, click <Ui k="drawerShape.gridAlignment.reset" />.

The plate keeps the outer size of the shape. Only the position of the cells changes. The layout editor shows the same control under the shape toggle, and both places change the same value.

## Margins around a shape

<Ui k="baseplate.padding" /> still works on a shaped plate:

- For a shape from <Ui k="drawerShape.corners.open" />, the margin grows the plate, and the Layout Tool cuts the same corners on the larger plate.
- For any other shape, the margin moves each edge of the shape outward.

If the margin is too large for such a shape, the panel shows a warning and ignores the margin. Make the margin smaller until the warning goes away.

## Settings that a shape turns off

The shape carries its own corners and edges, so two settings do not show on a shaped plate:

- <Ui k="baseplate.cornerRadius" />
- <Ui k="baseplate.detachMargins" />

On a rectangular plate, a large <Ui k="baseplate.cornerRadius" /> acts like a shape. It cuts or removes the corner pockets that it passes through.

## Split a shaped plate

A shaped plate splits like any other plate. See [Split for your print bed](./splitting). The shape changes the result in three ways:

- Each piece follows the part of the outline that it holds.
- The Layout Tool does not print the grid positions outside the shape. The print guide skips their labels.
- A seam that the shape crosses gets no connector. Line up those pieces by their outline.

With <Ui k="baseplate.stackPrint.enable" /> on, pieces with the same shape stack together. A piece with a unique edge prints as its own stack. With <Ui k="baseplate.stackPrint.mixedSizes.label" />, a shaped piece stacks only with pieces like it.

::: info
The quick preview does not draw shaped plates. After a change, the preview shows the plate only when the full build is ready, so a change can take longer to show.
:::

## Next steps

- [Set up the drawer](../layouts/drawer-setup): draw, edit or import the drawer shape.
- [Baseplate basics](./basics): set the margins and the grid pitch.
- [Split for your print bed](./splitting): control where a large plate breaks.
- [Eco plates and stack printing](./eco-and-stack-printing): print the pieces in stacks.
