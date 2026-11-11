---
title: Baseplate basics
description: 'Size a baseplate from your layout, add margins, set the grid pitch, and keep one plate design for each layout.'
sources:
  - src/features/baseplate/components/BaseplatePanel/DimensionsSection.tsx
  - src/features/baseplate/components/BaseplatePanel/PhysicalUnitsSection.tsx
  - src/features/baseplate/components/BaseplatePanel/BaseplatePanel.tsx
  - src/features/baseplate/components/BaseplateLibraryModal/
  - src/features/baseplate/hooks/useBaseplateLibraryInit.ts
  - src/features/baseplate/utils/designOwnership.ts
  - src/core/baseplateDefaults.ts
  - src/features/baseplate/components/BaseplatePanel/MeasuredDrawerOverflow.tsx
  - src/features/baseplate/components/BaseplatePreview/BaseplatePreview.tsx
---

# Baseplate basics

A **baseplate** is the grid that your bins sit in. It holds each bin in its place, so nothing slides around when you open the drawer. The baseplate generator in the Gridfinity Layout Tool reads your drawer size from the layout and builds a plate to fit. Here's how to size it, fill the gap at the edges, and keep a separate plate for each drawer.

## Open the baseplate generator

Open the layout for your drawer, then click <Ui k="toolSwitcher.baseplateGenerator" /> in the tool switcher. You can also go straight to [the baseplate generator](https://gridfinitylayouttool.com/baseplate).

The preview opens in a top view. Its buttons reset the view, turn on X-ray (<kbd>X</kbd>), change the projection (<kbd>P</kbd>), and change the preview color.

The settings panel beside the preview has four sections, from top to bottom:

| Section                                | What you set there                                                             |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| <Ui k="baseplate.sectionDimensions" /> | Plate size, margins and grid position                                          |
| <Ui k="baseplate.stackPrint.enable" /> | Stack printing (see [Eco plates and stack printing](./eco-and-stack-printing)) |
| <Ui k="baseplate.sectionBase" />       | Magnets, screws, floor, connectors and corners                                 |
| <Ui k="common.physicalUnits" />        | Grid unit, print bed, nozzle and build height                                  |

Is the plate bigger than your print bed? Then a map of the pieces appears below these sections. See [Split for your print bed](./splitting).

<Screenshot id="baseplates-basics-panel" alt="The baseplate generator with the settings panel on the left and the preview on the right." spec="Baseplate generator on desktop. Layout with a 6 by 4 drawer, Sync with layout on, no padding. Show the full window with the top-view preview and the panel with all four sections visible. Crop to the app window." />

## Size the plate from your layout

<Ui k="baseplate.syncWithLayout" /> is on by default, so the plate matches the grid width and depth of your drawer. The <Ui k="baseplate.gridWidth" /> and <Ui k="baseplate.gridDepth" /> steppers stay locked. When you resize the drawer, the plate follows.

Need a plate of a different size? Turn off <Ui k="baseplate.syncWithLayout" />. The steppers unlock and start from the drawer size.

Know your drawer in millimeters? Click the millimeter size under the steppers and type the width and depth. The Layout Tool then does three things:

1. It picks the largest grid that fits.
2. It divides the leftover space equally into left and right padding, and into front and back padding.
3. It turns off <Ui k="baseplate.syncWithLayout" />.

If a half grid unit (21 mm) also fits, it turns on <Ui k="sidebar.halfBinMode" /> and uses the half unit. <Ui k="sidebar.halfUnitEdgePosition" /> then sets which side gets the half cell.

## Add margins around the grid

Drawers are almost never an exact number of grid units wide, so you usually get a gap at the edges. <Ui k="baseplate.padding" /> fills that gap with solid plastic, so that the plate fills the drawer. Four steppers set the back, left, right and front margins, from 0 to 100 mm.

The nine buttons in the middle move the grid inside the total margin. <Ui k="baseplate.paddingAnchor.c" /> puts the grid in the center, and <Ui k="baseplate.paddingAnchor.bl" /> pushes it into the front-left corner. Change one stepper by hand, and the anchor shows <Ui k="baseplate.paddingAnchor.custom" />.

Did you enter the drawer size in millimeters in the layout editor? Then the panel compares the plate with that size. If the plate is too big, a warning shows the overlap and a <Ui k="baseplate.fitPaddingToDrawer" /> button. Click it to shrink the margins until the plate fits.

Once at least one edge has a margin, two more options appear:

- <Ui k="baseplate.overTile" /> swaps the solid margin for clipped grid cells, edge by edge. An edge needs at least 8 mm of margin to get a cell. <Ui k="baseplate.preferHalfGrid" /> fills the margin with 21 mm half cells first.
- <Ui k="baseplate.detachMargins" /> prints the margins as separate strips. See [Split for your print bed](./splitting#detach-the-margins).

A bin at the edge of the grid can also grow its walls into the margin, so that it fills the drawer. See [Set up the drawer](../layouts/drawer-setup#extend-edge-bins-into-the-margin).

## Set the X and Y grid pitch

<Ui k="baseplate.gridUnit" />, in <Ui k="common.physicalUnits" />, is the width of one grid cell. The Gridfinity standard is 42 mm, so leave it there unless you know you need a different size. To set a different pitch for X and Y, click the link button next to the value. For example, a drawer can fit 40 mm cells across and 42 mm cells front to back. The bin designer does not copy the Y value, so set it there too. [Fit and tolerances](../printing/fit-and-tolerances#how-a-bin-fits-the-plate) shows where.

::: warning
Change the grid unit only when you know that you need it. The grid unit belongs to the layout, so the change also applies to every bin that you design for this layout.
:::

The same section holds three more settings:

| Setting                             | What it changes                         |
| ----------------------------------- | --------------------------------------- |
| <Ui k="baseplate.printBedSize" />   | How the plate splits into pieces        |
| <Ui k="settings.nozzleSize" />      | The size of connector keys and clips    |
| <Ui k="baseplate.maxPrintHeight" /> | The maximum height of a stack of plates |

## Each layout keeps its own baseplate

Each drawer gets its own plate settings. A change to the plate of one drawer doesn't change the plate of a different drawer.

The header shows the name of the active plate design. Click the name to rename it. Click <Ui k="baseplate.library.baseplates" /> to open the <Ui k="baseplate.library.title" />, where you can:

- Pick a design to make it the active plate for this layout.
- Click <Ui k="baseplate.library.newBaseplate" /> to start a design from the default settings.
- Rename, duplicate or delete a design from its menu.

Each card shows which layouts use the design. Pick a design that a different layout uses, and the Layout Tool makes a copy for this layout. The copy gets the design name and the layout name, for example "Baseplate 2 (Kitchen)". Every change saves automatically, so you won't find a save button.

<Screenshot id="baseplates-basics-library" alt="The baseplate library with two plate designs and the layouts that use them." spec="Baseplate generator, Baseplates button clicked. Library with two designs, one marked Active and used by a layout named Kitchen, one not used by any layout. Crop to the dialog." />

## Reset to defaults

Want a clean start? Click <Ui k="baseplate.reset" /> at the bottom of the panel, then confirm. The plate goes back to the default settings: no magnet holes, no margins, and the size from the layout. Your bins don't change. The grid unit and the print bed size keep their values too, because they belong to the layout.

## When it goes wrong

### The plate is bigger than your drawer

Click <Ui k="baseplate.fitPaddingToDrawer" /> under the warning. It makes the margins smaller until the plate fits. No button? Then the grid alone is too big for the drawer. Make the grid smaller in the layout editor, or turn off <Ui k="baseplate.syncWithLayout" /> and lower the steppers.

The panel compares the plate and its margins with the drawer size that you measured in the layout editor. The warning gives the overlap in millimeters.

### An edge stays solid when you fill the margin with grid cells

Make the margin on that edge 8 mm or wider.

A clipped grid cell needs at least 8 mm of margin. On a narrower edge, the margin stays solid plastic, and the panel lists that edge as too small.

### The preview stays empty or shows an error

Reload the page. Does the message say that the browser can't run the 3D engine? Then update the browser, or open the Layout Tool in a recent Chrome, Edge, Firefox or Safari.

The 3D engine builds the plate inside your browser. An old browser, or a security setting that turns off WebAssembly, stops the engine.

### The bins are too tight in the plate

See [A bin is too tight in the plate](../printing/troubleshooting#a-bin-is-too-tight-in-the-plate). The cause that you can fix is a bin with a different grid unit from the plate.

## Next steps

- [Magnets and screws](./magnets-and-screws): hold the bins in place, or fasten the plate to the drawer.
- [Split for your print bed](./splitting): print a plate that is larger than your printer.
- [Drawers that are not rectangles](./odd-shaped-drawers): make a plate for a drawer with a custom shape.
- [The print list and ZIP export](../printing/print-list-and-zip): export the plate together with all the bins of the layout.
- [Gridfinity dimensions](../reference/dimensions#baseplate-pocket-profile): look up the size of each pocket in the plate.
