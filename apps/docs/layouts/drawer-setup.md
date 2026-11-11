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
  - src/core/cqrs/v2/domain/drawer/updateDrawer.ts
---

# Set up the drawer

Every layout starts with the drawer. Get its size right in the Gridfinity Layout Tool, and the bins you plan will fit the real thing. Here's how to size the grid, match it to a measured drawer, shape an odd drawer, and check that your stacks clear the drawer top.

## Find the drawer settings

On a computer, open the <Ui k="sidebar.gridSize" /> group in the left panel.

On a phone, tap <Ui k="mobile.settings" /> in the header. The same controls are in the <Ui k="settings.drawerDimensions" /> section.

<Screenshot id="layouts-drawer-setup-grid-size" alt="The Grid size group in the left panel with the width, depth and height steppers and the measured drawer line." spec="Layout editor on desktop, left panel open. Layout with a 6 by 4 drawer and a measured size of 260 x 180 x 60 mm entered. Expand the Grid size group. Crop to the Grid size group, from its title to the Custom drawer shape toggle." />

## Set the size in grid units

Use the <Ui k="common.widthUnits" /> and <Ui k="common.depthUnits" /> steppers. They count in grid units, and one **grid unit** (one Gridfinity cell) is 42 mm by default. Width runs from left to right. Depth runs from the front of the drawer to the back.

- Each step adds or removes one grid unit. With <Ui k="sidebar.halfBinMode" /> on, each step is half a unit.
- You can also type a value. A value that ends in .5 turns on half-grid mode.
- The largest drawer is 50 by 50 grid units.

Prefer to drag? Pull the right edge of the grid to add or remove columns. Pull the bottom edge for rows, or the bottom-right corner for both.

If the drawer gets smaller, you don't lose anything. Bins that no longer fit move to the **stash**, the holding area below the grid. See [Place and edit bins](./placing-bins#put-bins-in-the-stash).

When the width or the depth ends in .5, <Ui k="sidebar.halfUnitEdgePosition" /> appears. It picks where the half unit goes:

- The half-unit column goes on the <Ui k="sidebar.left" /> or the <Ui k="sidebar.right" />.
- The half-unit row goes at the <Ui k="sidebar.bottom" /> or the <Ui k="sidebar.top" />.

## Fit the grid to a measured drawer

A real drawer is almost never an exact number of grid units. Measure the inside of yours, and the Layout Tool shows you how well the grid fits.

1. Under the steppers, click <Ui k="drawerDims.addMeasured" />.
2. Type the <Ui k="drawerDims.widthLabel" /> and the <Ui k="drawerDims.depthLabel" />.
3. Type the <Ui k="drawerDims.heightLabel" /> too, if you know it. The height check at the end of this page needs it.
4. Press <kbd>Enter</kbd>.

The line under the steppers then shows the grid size in millimeters and the free space around it. If the grid is larger than the drawer, the line turns into a warning that shows the overlap.

Your measurement doesn't resize the grid on its own. Instead, when a different grid fits better, a card suggests the largest grid that fits and shows the room that it leaves. Click <Ui k="drawerDims.suggestionUse" /> to apply it. If the better fit needs a half unit, the card tells you that it also turns on half-grid mode.

Happy with your own grid? Close the card with its X button. It stays closed until you enter a different measurement. To remove the measurement, click <Ui k="drawerDims.clear" />, the small X next to the size.

## Use the margin around the grid

The gap between the grid and the drawer walls is the **margin**. A baseplate can fill it with padding, which you set under <Ui k="baseplate.padding" /> in the baseplate generator. See [Baseplate basics](../baseplates/basics#add-margins-around-the-grid).

When the layout has padding, a dashed band around the grid shows the margin to scale. You can't place bins in the band.

### Extend edge bins into the margin

Want to use that space? A bin that touches a padded edge can grow its walls out into the margin.

1. Select a bin that touches an edge of the grid.
2. In the inspector, turn on <Ui k="inspector.extendToMargin" />.

This works only for a bin that uses a saved design. A bin without one shows <Ui k="inspector.extendToMargin.needsLink" /> under the toggle. Imported bins and Workshop designs keep their saved shape, so they can't extend.

With the toggle on, <Ui k="inspector.taper" /> angles the walls out from the base to the rim. Use it in a drawer with curved sides. Pick <Ui k="inspector.taper.chamfer" /> or <Ui k="inspector.taper.fillet" /> for the profile. Then set the <Ui k="inspector.taper.height" /> and the <Ui k="inspector.taper.flare" />.

## Shape a drawer that is not a rectangle

Does your drawer have a notch, a post or a cut corner? Remove the cells that it doesn't have.

1. Under the steppers, turn on <Ui k="drawerShape.toggle" />. The <Ui k="drawerShape.editor.title" /> editor opens.
2. Click or drag across cells to remove them from the drawer.
3. Click <Ui k="drawerShape.editor.apply" />.

Bins outside the new shape move to the stash. For more shape tools, open the <Ui k="drawerShape.actions" /> menu next to the toggle:

- <Ui k="drawerShape.corners.open" /> cuts, rounds or notches each corner.
- <Ui k="drawerShape.penOpen" /> lets you drag corners, curve edges and import an SVG or DXF outline.

Changed your mind? Turn the toggle off, then click <Ui k="drawerShape.resetConfirm" /> to go back to a rectangle. Your bins stay where they are. For all the shape tools, see [Drawers that are not rectangles](../baseplates/odd-shaped-drawers).

## Check the drawer height

A drawer that won't close is no fun. <Ui k="sidebar.drawerHeight" /> is the height, in millimeters, that every stack of bins must stay under. Each step is one **height unit**, 7 mm by default. The Layout Tool doesn't let you place a bin that makes a stack taller than this height.

A printed bin stands a little taller than its height units. Its stacking lip rises above the body, and a baseplate can add material under it. For a check against the real drawer, enter a measured height. The Layout Tool then measures the tallest stack in millimeters, with the lip, the baseplate and any clearance above the bins. It also sets <Ui k="sidebar.drawerHeight" /> from your measurement.

The result shows under the measured size:

- If the tallest stack fits, the line shows how many millimeters are free.
- If it doesn't fit, a warning shows how far the stack stands above the drawer. The <Ui k="common.layers" /> panel and the inspector of each tall bin show the same warning.
- With no measured height, the line asks for one: <Ui k="drawerCeiling.measurePrompt" />.

The 3D preview also draws a flat plane at the <Ui k="drawerCeiling.planeLabel" />. Any bin that goes through the plane is too tall for the drawer.

<Screenshot id="layouts-drawer-setup-ceiling" alt="The 3D preview with a plane at the measured drawer height and one stack that goes through it." spec="Layout editor on desktop with the 3D preview open. Layout with a 4 by 3 drawer, measured height 50 mm, and a 6u bin stacked on a 3u bin so the stack is too tall. Show the preview at an isometric angle with the plane label visible. Crop to the preview." />

## When it goes wrong

### The grid is bigger than your drawer

Lower the <Ui k="common.widthUnits" /> or the <Ui k="common.depthUnits" /> stepper one step at a time, until the line under the size shows free space again. Until then, that line warns how far the grid is too wide and too deep.

Your measurement never resizes the grid on its own. So the grid can stay too large after you measure, or after you change the grid unit.

### The height check says your stack stands above the drawer

Make the tallest stack lower. Select a bin in that stack and make it one height unit shorter. To see which bin heights fit, open <Ui k="stackSolver.title" /> in the <Ui k="common.physicalUnits" /> group.

The Layout Tool lets you place a bin when its height units fit under <Ui k="sidebar.drawerHeight" />. But each printed bin also has a 4.4 mm stacking lip, and a plate with magnet holes lifts every bin. Only the check against your measured height counts those millimeters. See [How heights add up](../concepts/units#how-heights-add-up).

### The drawer height won't go any lower

Make the tallest stack lower first, then lower <Ui k="sidebar.drawerHeight" />. The <Ui k="layers.tallestStack" /> bar in the <Ui k="common.layers" /> panel shows how tall that stack is.

The drawer height stops at the top of the tallest stack, so no bin can end up above the drawer.

### You can't extend a bin into the margin

The toggle shows only when the layout has a margin and the bin touches a padded edge. Set <Ui k="baseplate.padding" /> in the baseplate generator first. Then move the bin against that edge.

Is the toggle there but gray? Read the line under it. A bin needs a saved design before it can extend, and imported bins and Workshop designs can't extend at all.

## Next steps

- [Place and edit bins](./placing-bins): fill the drawer with bins.
- [Work in layers](./layers): stack bins and keep the tallest stack under the drawer top.
- [Units and sizes](../concepts/units): change the grid unit and the height unit.
- [Baseplate basics](../baseplates/basics): make a plate that fills the margin.
- [Split for your print bed](../baseplates/splitting): print a baseplate for a drawer that is larger than your printer.
- [Plan your first drawer](../getting-started/first-drawer): set up a drawer and fill it, step by step.
