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
---

# Baseplate basics

A baseplate is the grid that your bins sit in. The baseplate generator in the Gridfinity Layout Tool reads the drawer size from your layout and builds a plate that fits it. This page shows how to size the plate, fill the gap around it, and keep a different plate for each drawer.

## Open the baseplate generator

1. Open the layout for the drawer that needs a plate.
2. In the tool switcher, select <Ui k="toolSwitcher.baseplateGenerator" />.

You can also go to [the baseplate generator](https://gridfinitylayouttool.com/baseplate) directly. The preview opens in a top view. The buttons on the preview reset the view, turn on X-ray (<kbd>X</kbd>), change the projection (<kbd>P</kbd>), and change the preview color.

The panel on the right has these sections, from top to bottom:

| Section                                | What it controls                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| <Ui k="baseplate.sectionDimensions" /> | Plate size, margins and grid position                                          |
| <Ui k="baseplate.stackPrint.enable" /> | Stack printing (see [Eco plates and stack printing](./eco-and-stack-printing)) |
| <Ui k="baseplate.sectionBase" />       | Magnets, screws, floor, connectors and corners                                 |
| <Ui k="common.physicalUnits" />        | Grid unit, print bed, nozzle and build height                                  |

When the plate is larger than your print bed, a map of the pieces shows below these sections. See [Split for your print bed](./splitting).

<Screenshot id="baseplates-basics-panel" alt="The baseplate generator with the preview on the left and the settings panel on the right." spec="Baseplate generator on desktop. Layout with a 6 by 4 drawer, Sync with layout on, no padding. Show the full window with the top-view preview and the panel with all four sections visible. Crop to the app window." />

## Size the plate from your layout

<Ui k="baseplate.syncWithLayout" /> is on by default. The plate then uses the grid width and depth of the drawer in the layout editor. You cannot change the <Ui k="baseplate.gridWidth" /> and <Ui k="baseplate.gridDepth" /> steppers. When you resize the drawer, the plate follows.

To make a plate of a different size, turn off <Ui k="baseplate.syncWithLayout" />. The steppers then unlock and start from the drawer size.

You can also type the drawer size in millimeters. Click the millimeter size under the steppers and enter the width and depth. The Layout Tool then does these steps:

1. It sets the largest grid that fits in that size.
2. It divides the rest equally into left and right padding, and into front and back padding.
3. It turns off <Ui k="baseplate.syncWithLayout" />.

If a half grid unit also fits, the Layout Tool turns on <Ui k="sidebar.halfBinMode" /> and uses it. With a half unit on an edge, <Ui k="sidebar.halfUnitEdgePosition" /> sets the side that gets the half cell.

## Add margins around the grid

A drawer is almost never an exact number of grid units wide. <Ui k="baseplate.padding" /> adds solid plastic around the grid so that the plate fills the drawer. Four steppers set the back, left, right and front margins, from 0 to 100 mm.

The nine buttons in the middle move the grid inside the total margin. For example, <Ui k="baseplate.paddingAnchor.c" /> puts the grid in the center, and <Ui k="baseplate.paddingAnchor.bl" /> pushes it to the front-left corner. When you change one stepper by hand, the anchor shows <Ui k="baseplate.paddingAnchor.custom" />.

If you entered the drawer size in millimeters in the layout editor, the panel compares the plate with that size. When the plate is too large, a warning shows the overlap and a <Ui k="baseplate.fitPaddingToDrawer" /> button. This button makes the margins smaller until the plate fits.

With a margin on at least one edge, two more options show:

- <Ui k="baseplate.overTile" /> replaces the solid margin with clipped grid cells, edge by edge. An edge needs at least 8 mm of margin for a cell. <Ui k="baseplate.preferHalfGrid" /> fills the margin with 21 mm half cells first.
- <Ui k="baseplate.detachMargins" /> prints the margins as separate strips. See [Split for your print bed](./splitting#detach-the-margins).

## Set the X and Y grid pitch

The <Ui k="baseplate.gridUnit" /> setting in <Ui k="common.physicalUnits" /> is the width of one grid cell. The Gridfinity standard is 42 mm. Click the link button next to the value to set a different pitch for X and Y. For example, use this for a drawer that fits 40 mm cells across and 42 mm cells front to back.

::: warning
Change the grid unit only when you know that you need it. The grid unit belongs to the layout, so the change also applies to the bins that you design for this layout.
:::

The same section has <Ui k="baseplate.printBedSize" />, <Ui k="settings.nozzleSize" /> and <Ui k="baseplate.maxPrintHeight" />. The print bed size controls how the plate splits. The nozzle size changes the size of connector keys and clips. The build height limits the height of a stack.

## Each layout keeps its own baseplate

The plate settings belong to the layout. A change to the plate of one drawer does not change the plate of a different drawer.

The header shows the name of the active plate design. Click the name to rename it. Click <Ui k="baseplate.library.baseplates" /> to open the <Ui k="baseplate.library.title" />. In the library you can do these things:

- Select a design to make it the active plate for this layout.
- Click <Ui k="baseplate.library.newBaseplate" /> to start a design from the default settings.
- Rename, duplicate or delete a design from its menu.

Each card shows which layouts use the design. If you select a design that a different layout uses, the Layout Tool makes a copy for this layout. The copy has the design name and the layout name, for example "Baseplate 2 (Kitchen)". The Layout Tool saves each change automatically, so there is no save button.

<Screenshot id="baseplates-basics-library" alt="The baseplate library with two plate designs and the layouts that use them." spec="Baseplate generator, Baseplates button clicked. Library with two designs, one marked Active and used by a layout named Kitchen, one not used by any layout. Crop to the dialog." />

## Reset to defaults

To start again, click <Ui k="baseplate.reset" /> at the bottom of the panel, then confirm. The plate goes back to the default settings: no magnet holes, no margins, and the size from the layout. The bins in your layout do not change. The grid unit and the print bed size also keep their values, because they belong to the layout.

## Next steps

- [Magnets and screws](./magnets-and-screws): hold the bins in place, or fasten the plate to the drawer.
- [Split for your print bed](./splitting): print a plate that is larger than your printer.
- [Drawers that are not rectangles](./odd-shaped-drawers): make a plate for a drawer with a custom shape.
- [The print list and ZIP export](../printing/print-list-and-zip): export the plate together with all the bins of the layout.
