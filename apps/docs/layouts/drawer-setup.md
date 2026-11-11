---
title: Set up the drawer
description: 'Set the drawer size, fit a measured drawer, shape the drawer and check the height of your stacks.'
sources:
  - src/shell/Sidebar/Sidebar.tsx
  - src/shared/hooks/useDrawerSettings.ts
  - src/shared/hooks/useDrawerFitSuggestion.ts
  - src/shared/components/DrawerDimensionsSummary/DrawerDimensionsSummary.tsx
  - src/shared/utils/drawerCeiling.ts
  - src/features/drawer-shape/
  - src/features/grid-editor/components/Grid/DrawerMargin/DrawerMargin.tsx
  - src/features/bin-inspector/components/Inspector/ExtendToMarginToggle/ExtendToMarginToggle.tsx
---

# Set up the drawer

The drawer is the space that your layout fills. In the Gridfinity Layout Tool, you set the drawer size first and then place bins in it. This page shows how to size the grid, shape the drawer, and check that your bins fit under the drawer top.

## Find the drawer settings

On a computer, the drawer settings are in the <Ui k="sidebar.gridSize" /> group of the left panel.

On a phone, tap <Ui k="mobile.settings" /> in the header. The same controls are in the <Ui k="settings.drawerDimensions" /> section.

<Screenshot id="layouts-drawer-setup-grid-size" alt="The Grid size group in the left panel with the width, depth and height steppers and the measured drawer line." spec="Layout editor on desktop, left panel open. Layout with a 6 by 4 drawer and a measured size of 260 x 180 x 60 mm entered. Expand the Grid size group. Crop to the Grid size group, from its title to the Custom drawer shape toggle." />

## Set the size in grid units

The <Ui k="common.widthUnits" /> and <Ui k="common.depthUnits" /> steppers set the drawer size in grid units. One grid unit is 42 mm by default. Width goes from left to right. Depth goes from the front of the drawer to the back.

- Each step adds or removes one grid unit. With <Ui k="sidebar.halfBinMode" /> on, each step is half a unit.
- You can type a value. A value that ends in .5 turns on half-grid mode.
- The largest drawer is 50 by 50 grid units.

You can also resize the drawer on the canvas. Drag the right edge of the grid to add or remove columns. Drag the bottom edge for rows, and the bottom-right corner for both.

When the drawer gets smaller, the bins that no longer fit move to the stash. See [Place and edit bins](./placing-bins#put-bins-in-the-stash).

When the width or the depth ends in .5, <Ui k="sidebar.halfUnitEdgePosition" /> shows. Use it to put the half-unit column on the <Ui k="sidebar.left" /> or <Ui k="sidebar.right" />, and the half-unit row at the <Ui k="sidebar.bottom" /> or <Ui k="sidebar.top" />.

## Fit the grid to a measured drawer

A real drawer is almost never an exact number of grid units. Enter its inside size, and the Layout Tool shows how well the grid fits.

1. Under the steppers, click <Ui k="drawerDims.addMeasured" />.
2. Type the <Ui k="drawerDims.widthLabel" /> and the <Ui k="drawerDims.depthLabel" />.
3. If you know it, type the <Ui k="drawerDims.heightLabel" />.
4. Press <kbd>Enter</kbd>.

The line under the steppers then shows the grid size in millimeters and the free space around it. If the grid is larger than the drawer, the line turns into a warning that shows the overlap.

The Layout Tool does not resize the grid by itself. When the largest grid that fits the drawer is different from your grid, a card shows that size and the free space that it leaves. Click <Ui k="drawerDims.suggestionUse" /> to apply it. If the better fit uses a half unit, the card tells you that it also turns on half-grid mode. To keep your grid, close the card with its X button. The card then stays closed until you enter a different measurement.

To remove the measurement, click <Ui k="drawerDims.clear" />, the small X next to the size.

## Use the margin around the grid

The space between the grid and the drawer walls is the margin. A baseplate fills it with padding. You set the padding in the baseplate generator, under <Ui k="baseplate.padding" />. See [Baseplate basics](../baseplates/basics#add-margins-around-the-grid).

When the layout has padding, a dashed band around the grid shows the margin to scale. You cannot place bins in the band.

### Extend edge bins into the margin

A bin that touches a padded edge can grow its walls into the margin.

1. Select a bin that touches an edge of the grid.
2. In the inspector, turn on <Ui k="inspector.extendToMargin" />.

The bin must use a saved design. A bin without one shows <Ui k="inspector.extendToMargin.needsLink" /> under the toggle. Imported bins and Workshop designs keep their saved shape, so they cannot extend.

When the toggle is on, <Ui k="inspector.taper" /> angles the walls out from the base to the rim. This helps in a drawer with curved sides. Choose <Ui k="inspector.taper.chamfer" /> or <Ui k="inspector.taper.fillet" />, then set the <Ui k="inspector.taper.height" /> and the <Ui k="inspector.taper.flare" />.

## Shape a drawer that is not a rectangle

1. Under the steppers, turn on <Ui k="drawerShape.toggle" />. The <Ui k="drawerShape.editor.title" /> editor opens.
2. Click or drag on cells to remove them from the drawer.
3. Click <Ui k="drawerShape.editor.apply" />.

Bins outside the new shape move to the stash. The <Ui k="drawerShape.actions" /> menu next to the toggle has two more ways to make a shape:

- <Ui k="drawerShape.corners.open" /> cuts, rounds or notches each corner.
- <Ui k="drawerShape.penOpen" /> lets you drag corners, curve edges and import an SVG or DXF outline.

To go back to a rectangle, turn the toggle off, then click <Ui k="drawerShape.resetConfirm" />. Your bins stay where they are. For all the shape tools, see [Drawers that are not rectangles](../baseplates/odd-shaped-drawers).

## Check the drawer height

<Ui k="sidebar.drawerHeight" /> is the height, in millimeters, that every stack of bins must stay under. Each step is one height unit, 7 mm by default. The Layout Tool does not let you place a bin that makes a stack taller than this height.

A printed bin is a little taller than its height units. Its stacking lip stands above the body, and a baseplate can add material under it. For a check against the real drawer, enter a measured height. The Layout Tool then measures the tallest stack in millimeters, with the lip, the baseplate and any clearance above the bins. It also sets <Ui k="sidebar.drawerHeight" /> from your measurement.

The result shows under the measured size:

- If the tallest stack fits, the line shows how many millimeters are free.
- If it does not fit, a warning shows how far the stack stands above the drawer. The <Ui k="common.layers" /> panel and the inspector of each tall bin show the same warning.
- Without a measured height, the line asks for one: <Ui k="drawerCeiling.measurePrompt" />.

The 3D preview draws a flat plane at the <Ui k="drawerCeiling.planeLabel" />. A bin that goes through the plane is too tall for the drawer.

<Screenshot id="layouts-drawer-setup-ceiling" alt="The 3D preview with a plane at the measured drawer height and one stack that goes through it." spec="Layout editor on desktop with the 3D preview open. Layout with a 4 by 3 drawer, measured height 50 mm, and a 6u bin stacked on a 3u bin so the stack is too tall. Show the preview at an isometric angle with the plane label visible. Crop to the preview." />

## Next steps

- [Place and edit bins](./placing-bins): fill the drawer with bins.
- [Work in layers](./layers): stack bins and keep the tallest stack under the drawer top.
- [Units and sizes](../concepts/units): change the grid unit and the height unit.
- [Baseplate basics](../baseplates/basics): make a plate that fills the margin.
- [Split for your print bed](../baseplates/splitting): print a baseplate for a drawer that is larger than your printer.
- [Plan your first drawer](../getting-started/first-drawer): set up a drawer and fill it, step by step.
