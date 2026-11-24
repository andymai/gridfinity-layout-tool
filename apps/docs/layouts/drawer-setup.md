---
title: Set up the drawer
description: 'Set the drawer size, fit a measured drawer, shape the drawer and check the height of your stacks.'
questions:
  - 'How do I set my drawer size?'
  - 'How do I plan a drawer that is not a rectangle?'
  - 'How do I check that my bins fit the drawer height?'
sources:
  - src/shell/Sidebar/Sidebar.tsx
  - src/shared/hooks/useDrawerSettings.ts
  - src/shared/hooks/useDrawerFitSuggestion.ts
  - src/shared/utils/drawerLink.ts
  - src/features/layout-library/hooks/useDrawerLinkImport.ts
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

<Screenshot id="layouts-drawer-setup-drag-edge" alt="The right edge of the grid is dragged out, and two columns appear. Then the bottom-right corner is dragged out for one more column and one more row." spec="Clip. Layout editor on desktop. Layout with a 5 by 3 drawer and four bins. Drag the handle on the right edge of the grid out by two columns. Then drag the corner handle out by one column and one row. Crop to the canvas between the side panels." />

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

The line under the steppers then shows the grid size and the free space around it. If the grid is larger than the drawer, the line turns into a warning that shows the overlap.

Your measurement doesn't resize the grid on its own. Instead, when a different grid fits better, a card suggests the largest grid that fits and shows the room that it leaves. Click <Ui k="drawerDims.suggestionUse" /> to apply it. If the better fit needs a half unit, the card tells you that it also turns on half-grid mode.

<Screenshot id="layouts-drawer-setup-measured" alt="Add your drawer's measured size is clicked, and 430, 310 and 80 are typed. The line under the steppers warns that the 11 by 8 grid is larger than the drawer. A card suggests 10 by 7 units, and Fit grid applies it." spec="Clip. Layout editor on desktop, left panel open. Layout with an 11 by 8 grid and no measured size. In the Grid size group, click Add your drawer's measured size, type 430, 310 and 80 with Tab between them, and press Enter. Hold on the warning and the card, then click Fit grid. Crop to the Grid size group." />

Happy with your own grid? Close the card with its X button. It stays closed until you enter a different measurement. To remove the measurement, click <Ui k="drawerDims.clear" />, the small X next to the size.

## Open a layout from a drawer link

A drawer link opens the layout editor with a new layout at the size of a drawer. To make one, type the size of your drawer here, then click **Plan this drawer**:

<DrawerCalculator />

When you open a drawer link, the Layout Tool does these things:

- It makes a new layout and opens it. Your other layouts don't change. On your first visit, it resizes the empty layout instead.
- It fits the largest grid of whole grid units into the drawer, and keeps the measurement under the steppers.
- It puts half of the free space on each side of the baseplate.
- When half units fit tighter, it shows the card from [Fit the grid to a measured drawer](#fit-the-grid-to-a-measured-drawer). <Ui k="drawerDims.suggestionUse" /> applies the half-unit grid and makes the baseplate padding smaller, so the plate still fits the drawer.
- It names the layout from the link. A link without a name gives a name such as "Drawer 345 × 260 mm".

**Make its baseplate** opens the same drawer in the baseplate generator.

To send a drawer size to a friend, give them a link in this form. The height and the name are optional:

```text
https://gridfinitylayouttool.com/?drawer=345x260x40&name=Screw%20drawer
```

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

<Screenshot id="layouts-drawer-setup-shape" alt="Custom drawer shape is turned on, and the Drawer shape editor opens. A drag across the back right corner takes six cells out. After Apply shape, the grid has a notch in that corner." spec="Clip. Layout editor on desktop with the Workbench sample, which leaves the back right corner empty. Close-up: turn on Custom drawer shape. Cut to the editor: drag across the six empty cells at the back right, then click Apply shape. Cut to the grid with its new shape." />

Bins outside the new shape move to the stash. For more shape tools, open the <Ui k="drawerShape.actions" /> menu next to the toggle:

- <Ui k="drawerShape.corners.open" /> cuts, rounds or notches each corner.
- <Ui k="drawerShape.penOpen" /> lets you drag corners, curve edges and import an SVG or DXF outline. See [Draw the outline](#draw-the-outline).

Changed your mind? Turn the toggle off, then click <Ui k="drawerShape.resetConfirm" /> to go back to a rectangle. Your bins stay where they are. For all the shape tools, see [Drawers that are not rectangles](../baseplates/odd-shaped-drawers).

### Draw the outline

The cell editor follows the grid lines only. For a curved front, a slanted wall or an outline from a CAD file, draw the outline instead.

1. Open the <Ui k="drawerShape.actions" /> menu next to <Ui k="drawerShape.toggle" />.
2. Choose <Ui k="drawerShape.penOpen" />. The <Ui k="drawerShape.penTitle" /> editor opens.
3. Change the outline with the tools below.
4. Click <Ui k="drawerShape.editor.apply" />.

<Screenshot id="layouts-drawer-setup-pen" alt="The Drawer shape options menu opens, and Draw shape is chosen. In the Draw drawer shape editor, the front-right corner is dragged in, and the handle in the middle of the front edge is dragged out to curve it. Apply shape saves the outline, and the grid takes the new shape." spec="Clip. Layout editor on desktop, left panel open. Layout with a 6 by 4 drawer, no drawer shape and no bins at the front right. Click the Drawer shape options button next to Custom drawer shape, then Draw shape. In the editor, drag the front-right corner in by one grid unit, then drag the handle in the middle of the front edge out to curve it. Click Apply shape. Cut to the grid with its new shape." />

The editor starts from the shape that the drawer has. With no shape, it starts from a rectangle at the measured size of the drawer, or at the grid size.

To change the corners:

- Drag a corner to move it. Hold <kbd>Shift</kbd> to move it in a straight line along one axis.
- Double-click an edge to add a corner at its middle.
- To delete corners, select them and click <Ui k="drawerShape.penDeletePoint" />, or press <kbd>Delete</kbd>. The outline keeps at least three corners.
- To select more than one corner, <kbd>Shift</kbd>-click them. You can also drag a box around them from an empty area. <kbd>Ctrl</kbd>+<kbd>A</kbd> (<kbd>Cmd</kbd>+<kbd>A</kbd> on a Mac) selects all corners.
- Drag one of the selected corners to move all of them. An arrow key moves them one snap step, and <kbd>Shift</kbd> with an arrow key moves them ten steps.
- Select one corner to type its position, in millimeters, in **X** and **Y**.

Corners snap to the grid. Pick the step under <Ui k="drawerShape.penSnap" />: 1u, 0.5u or 0.25u of a grid unit. The default is 0.5u. With <Ui k="drawerShape.penSnapOff" />, a corner can go to any position, and an arrow key moves it 1 mm.

To curve an edge, drag the handle in the middle of the edge. An arc can be half a circle at most. To round corners, set <Ui k="drawerShape.penFillet" />. It changes the selected corners, or all the corners when you select none.

Scroll to zoom. To pan, hold <kbd>Space</kbd> or <kbd>Alt</kbd> and drag. <Ui k="drawerShape.penResetView" /> shows the full drawer again. <Ui k="common.undo" /> undoes your last change in the editor. <Ui k="drawerShape.penReset" /> starts again from a rectangle.

When you click <Ui k="drawerShape.editor.apply" />, the Layout Tool saves the outline. If the outline goes past the grid, the drawer grows to the smallest grid that holds it. Bins outside the new shape move to the stash. <Ui k="common.cancel" /> closes the editor and keeps the shape that the drawer had.

### Import an outline from an SVG or DXF file

Do you have the drawer outline in a CAD file? Import it into the <Ui k="drawerShape.penTitle" /> editor.

1. In the editor, click <Ui k="drawerShape.penImport" />.
2. Choose an SVG file or an ASCII DXF file, 5 MB or smaller.
3. Look at the outline, and change it if necessary.
4. Click <Ui k="drawerShape.editor.apply" />.

The file needs a closed outline. If it has more than one, the Layout Tool keeps the largest and tells you how many it ignored. The outline keeps its real size. When it is larger than the drawer, a notice gives you a choice:

- The grow button makes the drawer larger, in grid units, so that the outline fits. The drawer grows when you apply the shape. The button shows only when the drawer can grow to 50 grid units or less.
- <Ui k="drawerShape.penImportScale" /> makes the outline smaller, so that it fits the drawer.
- <Ui k="common.cancel" /> stops the import.

The import replaces the outline in the editor. To get the previous outline back, click <Ui k="common.undo" />.

## Check the drawer height

A drawer that won't close is no fun. <Ui k="sidebar.drawerHeight" /> is the height that every stack of bins must stay under. Each step is one **height unit**, 7 mm by default. The Layout Tool doesn't let you place a bin that makes a stack taller than this height.

A printed bin stands a little taller than its height units. Its stacking lip rises above the body, and a baseplate can add material under it. For a check against the real drawer, enter a measured height. The Layout Tool then measures the real height of the tallest stack, with the lip, the baseplate and any clearance above the bins. It also sets <Ui k="sidebar.drawerHeight" /> from your measurement.

The result shows under the measured size:

- If the tallest stack fits, the line shows how much height is free.
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

<Screenshot id="layouts-drawer-setup-height-check" alt="The Grid size group of a drawer with a measured height of 50 mm. Under the measured size, a warning says how far the tallest stack stands above the drawer." spec="Layout editor on desktop, left panel open. Layout with a 4 by 3 drawer, a measured size of 180 x 140 x 50 mm, and a 6u bin stacked on a 3u bin. Crop to the Grid size group, from its title to the line above Half-grid mode." />

The Layout Tool lets you place a bin when its height units fit under <Ui k="sidebar.drawerHeight" />. But each printed bin also has a 4.4 mm stacking lip, and a plate with magnet holes lifts every bin. Only the check against your measured height counts those millimeters. See [How heights add up](../concepts/units#how-heights-add-up).

### The drawer height won't go any lower

Make the tallest stack lower first, then lower <Ui k="sidebar.drawerHeight" />. The <Ui k="layers.tallestStack" /> bar in the <Ui k="common.layers" /> panel shows how tall that stack is.

The drawer height stops at the top of the tallest stack, so no bin can end up above the drawer.

### You can't extend a bin into the margin

The toggle shows only when the layout has a margin and the bin touches a padded edge. Set <Ui k="baseplate.padding" /> in the baseplate generator first. Then move the bin against that edge.

Is the toggle there but gray? Read the line under it. A bin needs a saved design before it can extend, and imported bins and Workshop designs can't extend at all.

### Apply shape stays gray in the Draw drawer shape editor

Read the red line under the controls. It tells you what to fix:

| The line says                                      | What to do                                               |
| -------------------------------------------------- | -------------------------------------------------------- |
| <Ui k="drawerShape.penError.self_intersecting" />  | Move the corners until no edge crosses another edge.     |
| <Ui k="drawerShape.penError.degenerate_segment" /> | Move one of the two corners, or delete it.               |
| <Ui k="drawerShape.penError.bad_bulge" />          | Drag the handle of the curved edge back toward the edge. |
| <Ui k="drawerShape.penError.too_small" />          | Make the outline larger.                                 |
| <Ui k="drawerShape.penError.too_many_vertices" />  | Delete corners. An outline can have 256 corners at most. |

### The outline import fails

Read the message that shows:

| The message says                            | What to do                                                        |
| ------------------------------------------- | ----------------------------------------------------------------- |
| <Ui k="toast.outlineImport.noClosedLoop" /> | Join the ends of the outline in your CAD file, then export again. |
| <Ui k="toast.outlineImport.binaryDxf" />    | Export the file again as an ASCII DXF.                            |
| <Ui k="toast.outlineImport.fileTooLarge" /> | Remove the parts of the file that are not the outline.            |
| <Ui k="toast.outlineImport.tooComplex" />   | Use fewer points or simpler curves in the outline.                |

## Next steps

- [Place and edit bins](./placing-bins): fill the drawer with bins.
- [Work in layers](./layers): stack bins and keep the tallest stack under the drawer top.
- [Units and sizes](../concepts/units): change the grid unit and the height unit.
- [Baseplate basics](../baseplates/basics): make a plate that fills the margin.
- [Split for your print bed](../baseplates/splitting): print a baseplate for a drawer that is larger than your printer.
- [Plan your first drawer](../getting-started/first-drawer): set up a drawer and fill it, step by step.
