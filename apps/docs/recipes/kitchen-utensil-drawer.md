---
title: A kitchen utensil drawer
description: 'Fill an odd-sized kitchen drawer with long utensil bins, half-grid cells and a baseplate for a 220 mm bed.'
sources:
  - src/shared/utils/drawerFit.ts
  - src/shared/hooks/useDrawerFitSuggestion.ts
  - src/shared/utils/binSplitFit.ts
  - src/shared/utils/splitPositions.ts
  - src/features/bin-designer/components/panel/SplitOptionsSection/
  - src/features/baseplate/components/BaseplatePanel/DimensionsSection.tsx
  - src/features/baseplate/utils/splitPlanner.ts
  - src/features/bin-inspector/components/Inspector/ExtendToMarginToggle/
---

# A kitchen utensil drawer

Kitchen drawers almost never come in steps of 42 mm, and a spatula can be longer than your print bed. This recipe deals with both. You fill the odd width with half-grid cells, print long bins in two pieces, and split the baseplate for a 220 mm bed.

<Screenshot id="recipes-kitchen-utensil-drawer-hero" alt="A kitchen drawer layout in 3D with four long utensil bins, a half-wide column of bins at the right and three gadget bins along the back." spec="Layout editor, desktop 1440 px, 3D preview expanded with Space, isometric view from the front right. Layout with a 9.5 x 11 grid, half column on the right, measured size 405 x 480 x 75 mm, print bed 220 x 220 mm, one layer, all bins 6u. Front 8 rows: four linked 2 x 8 bins labeled Spatulas, Ladles, Spoons, Whisks, and two 1.5 x 4 bins labeled Peelers and Scissors in the half-wide column. Back 3 rows: 3 x 3 Measuring, 3 x 3 Gadgets, 3.5 x 3 Clips. The split lines on the long bins must be visible. Crop to the preview." />

## What you need

- The inside size of your drawer. This recipe uses an example drawer of 405 × 480 mm, 75 mm high. Measure where the drawer is narrowest.
- A print bed of 220 × 220 mm. With a larger bed, you get fewer pieces.
- About 603 m of PLA, or 1.8 spools of 1 kg. That's the bin list estimate for this plan, with the default settings.
- Glue for the long bins, which print in two pieces.

## The plan

The grid for this drawer is 9.5 × 11 grid units. Utensils lie front to back.

| Bins | Size    | Height | Holds                            |
| ---- | ------- | ------ | -------------------------------- |
| 4    | 2 × 8   | 6u     | Spatulas, ladles, spoons         |
| 2    | 1.5 × 4 | 6u     | Peelers, scissors, thin tools    |
| 2    | 3 × 3   | 6u     | Measuring cups, gadgets          |
| 1    | 3.5 × 3 | 6u     | Clips, ties and other small bits |

A 2 × 8 bin has 81.1 × 333.1 mm of room inside: 8 × 42 mm, less 0.5 mm of fit gap and two 1.2 mm walls. A 6u bin stands 46.4 mm tall, so it leaves 28.6 mm free under a 75 mm drawer top.

## Step 1: Fit a half-grid to the drawer

1. In the [layout editor](https://gridfinitylayouttool.com/), click <Ui k="drawerDims.addMeasured" /> in the <Ui k="sidebar.gridSize" /> group.
2. Type 405, 480 and 75, and press <kbd>Enter</kbd>.
3. Click <Ui k="drawerDims.suggestionUse" /> on the card. It also turns on <Ui k="sidebar.halfBinMode" />.

<Screenshot id="recipes-kitchen-utensil-drawer-fit-card" alt="The Grid size group with a measured drawer of 405 by 480 mm and a card that suggests a 9.5 by 11 grid in half units." spec="Layout editor, desktop 1440 px, left panel. New layout at the default 10 x 8 grid. Click Add your drawer's measured size, type 405 x 480 x 75 and press Enter, so the suggestion card shows the half-unit fit. Crop to the Grid size group with the card." />

Here's why the half unit helps. Across the drawer, 405 ÷ 42 = 9.6. Whole units give 9 (378 mm) and waste 27 mm. A half unit is 21 mm, so 9.5 units (399 mm) fit and waste only 6 mm. Front to back, 11 units (462 mm) fit and leave 18 mm.

<Ui k="sidebar.halfUnitEdgePosition" /> shows which side gets the half-wide column. The right side is the default. [Units and sizes](../concepts/units#half-grid-mode) explains half-grid mode in full.

## Step 2: Set the print bed

Open <Ui k="common.physicalUnits" /> in the left panel, and set <Ui k="sidebar.printBed" /> to 220. The bed size belongs to the layout, so the bin designer and the baseplate generator use it too.

A 220 mm bed takes 5 grid units in a straight line (5 × 42 = 210 mm). Anything longer prints in pieces.

## Step 3: Draw and design the bins

Bins on the first layer start at 3u. In the <Ui k="common.layers" /> panel, set the height stepper of the layer to 6, and then draw the plan above. Start the 2 × 8 bins at the front edge, which is the bottom of the grid.

The long bins get a <Ui k="grid.split" /> tag or a warning mark on the grid, because 336 mm doesn't fit the bed. Select one, and the inspector shows <Ui k="inspector.split.title" />: it needs 2 pieces. The Gridfinity Layout Tool cuts a long bin into equal pieces, so each piece is a 2 × 4 part of 168 mm. The bin list counts both pieces.

Link each bin to a design, as in [Plan your first drawer](../getting-started/first-drawer#step-7-get-the-print-files). For the four long bins, one design is enough. Link the first, then use <Ui k="designLinking.inspector.linkExisting" /> on the others.

In the design of the long bin, the <Ui k="binDesigner.group.shape" /> group shows the split. Keep <Ui k="binDesigner.splitConnectors" /> on. It adds a sloped joint in the floor, so the two halves line up, with a small gap for glue.

## Step 4: Fill the leftover millimeters

The half-grid used most of the spare width. Now 6 mm stays free across, and 18 mm front to back. The baseplate can fill that space with solid padding.

1. Open the baseplate generator with <Ui k="toolSwitcher.baseplateGenerator" />.
2. Click the millimeter size under the steppers in <Ui k="baseplate.sectionDimensions" />, and type 405 and 480.

The plate keeps the 9.5 × 11 grid. It adds <Ui k="baseplate.padding" /> of 3 mm at each side and 9 mm at the front and the back. The plate is now 405 × 480 mm, and <Ui k="baseplate.syncWithLayout" /> turns off.

Want the bins to fill the gap too? Back in the layout editor, select a bin that touches the edge. Turn on <Ui k="inspector.extendToMargin" /> in the inspector, and its walls grow into the padding. A long bin with 9 mm more at the front still prints in two pieces. Its front piece is 4 × 42 + 9 = 177 mm long, which fits the bed.

## Step 5: Split the plate and export

The plate splits for the 220 mm bed by itself. The map at the bottom of the panel shows 6 pieces in 6 build-plate loads. There are two columns, 5 and 4.5 units wide, and three rows, 4, 4 and 3 units deep from the front. The biggest piece, with its padding, is 213 × 177 mm.

<Screenshot id="recipes-kitchen-utensil-drawer-plate-split" alt="The split map of a 9.5 by 11 baseplate in six labeled pieces for a 220 mm bed, next to the plate in the preview." spec="Baseplate generator, desktop 1440 px. Layout with a 9.5 x 11 grid, half column on the right, print bed 220 x 220 mm. Plate padding 3 mm left and right, 9 mm front and back, connectors None. Scroll the panel to the split map. Show the map with labels A1 to B3 and the preview side by side. Crop to panel plus preview." />

To lock the pieces together, pick a style under <Ui k="baseplate.connectors.label" /> in <Ui k="baseplate.sectionBase" />. Then export the layout from the layout editor with <Ui k="header.export" /> and <Ui k="layoutExport.download" />. The ZIP holds the long bin as two pieces, and the plate as six. `manifest.txt` tells you how many of each to print.

## When it goes wrong

### The plate doesn't go into the drawer

A drawer can be a little narrower at the back than at the front, and a few millimeters is enough to jam a plate. Measure the width at the front, the middle and the back, and type the smallest value as the measured size in the layout editor. The baseplate panel then warns that the plate is too big. Click <Ui k="baseplate.fitPaddingToDrawer" /> to shrink the padding until the plate fits.

### A long bin doesn't line up at the joint

Keep <Ui k="binDesigner.splitConnectors" /> on, and glue the joint. The connector needs a solid floor, so it isn't available with a lightweight floor. A split bin also prints each piece in one color. See [Fitting the print bed](../concepts/print-bed-fit#when-a-bin-is-too-large).

### A ladle catches on the counter

Long handles can stand above the rim. Select that bin and type how far they stand up in <Ui k="inspector.clearanceMmLabel" />. The drawer check then counts that height, and the line under the measured size tells you if the drawer still closes.

## Next steps

- [Split for your print bed](../baseplates/splitting): connector styles and your own split lines
- [Units and sizes](../concepts/units): half units and how heights add up
- [Compartments and dividers](../designer/compartments#tilt-and-lean-dividers): angled dividers for a cutlery bin
- [Kitchen drawer organizer](https://gridfinitylayouttool.com/gridfinity-kitchen-drawer): ideas for cutlery, spice and junk drawers
