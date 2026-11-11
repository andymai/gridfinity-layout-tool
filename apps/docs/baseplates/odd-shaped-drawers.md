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

Not every drawer is a neat rectangle. Some have round corners, a cut corner, or a notch for a rail. Give your layout a custom drawer shape, and the baseplate generator cuts the plate to match. Here's how the plate follows the shape, and which settings change.

## Give the drawer a shape

You draw the shape in the layout editor, not in the baseplate generator.

1. In the layout editor, turn on <Ui k="drawerShape.toggle" />. A grid opens where you can remove cells from the drawer.
2. For other ways to make the shape, open the <Ui k="drawerShape.actions" /> menu next to the toggle. It has <Ui k="drawerShape.corners.open" /> for cut corners and <Ui k="drawerShape.penOpen" /> for a free outline. Once the drawer has a shape, it also has <Ui k="drawerShape.edit" />.

With <Ui k="drawerShape.penOpen" /> you can drag corners, curve edges, and import an outline from an SVG or DXF file. See [Set up the drawer](../layouts/drawer-setup) for the full steps.

## How the plate follows the shape

The plate follows the drawer shape only while <Ui k="baseplate.syncWithLayout" /> is on. A plate with a custom size has no link to the drawer, so it stays a rectangle.

The shape cuts through some grid cells. A cut cell keeps a sliced pocket when at least a quarter of the cell stays inside the shape. A sliced pocket can't hold a bin, and it leaves broken bits of wall along the edge.

Want a clean edge? Turn on <Ui k="baseplate.wholeCellsOnly" /> under <Ui k="baseplate.padding" />. The plate then drops each pocket that the shape cuts, and solid plastic fills the edge. This option appears for every shaped plate, and for a plate with a large corner radius. It's off by default.

When the shape makes the plate bigger than the grid cells, the size under the steppers shows <Ui k="baseplate.inclShape" />.

<Screenshot id="baseplates-shaped-plate" alt="A baseplate cut to a drawer shape with two rounded back corners and a notch at the front right. Fit whole cells only is turned on, and solid plastic then fills the cut cells along the edge." spec="Baseplate generator. Layout with a 6 by 5 drawer and a shape from Corner cuts: two rounded back corners and a notch at the front right. Sync with layout on, preview in iso view. The plate with its cut pockets, then a close-up of Grid position and Fit whole cells only as it is turned on, then the plate again." />

## Move the grid inside the shape

On a shaped plate, the drawer sets the outer size. Your only free choice is where the cells sit inside the shape.

1. In <Ui k="baseplate.sectionDimensions" />, find <Ui k="baseplate.gridPosition" />.
2. Change the X and Y values of <Ui k="drawerShape.gridAlignment.title" />. For example, push the grid against the front-left corner.
3. To go back, click <Ui k="drawerShape.gridAlignment.reset" />.

The outer size of the plate stays the same, and only the cells move. The layout editor has the same control under the shape toggle, and both places change the same value.

## Margins around a shape

<Ui k="baseplate.padding" /> still works on a shaped plate:

- For a shape from <Ui k="drawerShape.corners.open" />, the margin grows the plate, and the Layout Tool cuts the same corners on the bigger plate.
- For any other shape, the margin moves each edge of the shape outward.

If the margin is too big for such a shape, the panel shows a warning and ignores the margin. Make the margin smaller until the warning goes away.

## Settings that a shape turns off

The shape brings its own corners and edges, so two settings don't appear on a shaped plate:

- <Ui k="baseplate.cornerRadius" />
- <Ui k="baseplate.detachMargins" />

On a rectangular plate, a large <Ui k="baseplate.cornerRadius" /> acts like a shape. It cuts or removes the corner pockets that it passes through.

## Split a shaped plate

A shaped plate splits like any other plate. See [Split for your print bed](./splitting). The shape changes the result in three ways:

- Each piece follows the part of the outline that it holds.
- The Layout Tool doesn't print the grid positions outside the shape, and the print guide skips their labels.
- A seam that the shape crosses gets no connector. Line up those pieces by their outline.

With <Ui k="baseplate.stackPrint.enable" /> on, pieces with the same shape stack together, and a piece with a unique edge prints as its own stack. With <Ui k="baseplate.stackPrint.mixedSizes.label" />, a shaped piece stacks only with pieces like it.

::: info
Give a shaped plate a moment after each change. The quick preview doesn't draw shaped plates, so the plate appears only when the full build is ready.
:::

## Next steps

- [Set up the drawer](../layouts/drawer-setup): draw, edit or import the drawer shape.
- [Baseplate basics](./basics): set the margins and the grid pitch.
- [Split for your print bed](./splitting): control where a large plate breaks.
- [Eco plates and stack printing](./eco-and-stack-printing): print the pieces in stacks.
