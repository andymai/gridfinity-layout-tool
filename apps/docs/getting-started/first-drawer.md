---
title: Plan your first drawer
description: 'Set the drawer size, draw bins on the grid, and read the print list in the layout editor.'
sources:
  - src/features/onboarding/hooks/useOnboarding.ts
  - src/shell/Sidebar/Sidebar.tsx
  - src/shared/components/DrawerDimensionsSummary/
  - src/shared/hooks/useDrawerFitSuggestion.ts
  - src/shared/hooks/interactions/useDrawInteraction.ts
  - src/features/bin-inspector/components/Inspector/SingleBinInspector/
  - src/shell/RightPanel/RightPanel.tsx
  - src/features/design-linking/components/LinkedDesignSection/
---

# Plan your first drawer

In this tutorial, you enter the size of a real drawer, draw bins on the grid, and get a list of the bins to print. At the end, you link one bin to a design and download the print files. This page teaches the clicks in the layout editor. For advice on which bin sizes to choose, read the [planning guide](https://gridfinitylayouttool.com/guide).

## Before you start

Measure the inside of your drawer in millimeters: the width, the depth, and the height under the closed drawer. Use the smallest value on each side.

## Step 1: Open the layout editor

1. Open the [layout editor](https://gridfinitylayouttool.com/) in your browser.

On your first visit, the layout editor opens an empty layout. On a desktop screen, the grid is 10 grid units wide and 8 grid units deep. An animated hint on the grid shows <Ui k="onboarding.drawTutorial.hint" />. The hint stays until you draw your first bin.

## Step 2: Set the drawer size

1. In the left sidebar, find the <Ui k="sidebar.gridSize" /> group.
2. Under the steppers, click <Ui k="drawerDims.addMeasured" />.
3. Type your measured width in <Ui k="drawerDims.widthLabel" />.
4. Type your measured depth in <Ui k="drawerDims.depthLabel" />.
5. Type your measured height in <Ui k="drawerDims.heightLabel" />.
6. Press <kbd>Enter</kbd>.

<Screenshot id="getting-started-first-drawer-measured-size" alt="The grid size group in the left sidebar, with the measured drawer size and a suggestion card that offers a grid fit." spec="Layout editor, desktop 1440 px, default empty layout. Add a measured size of 400 x 300 x 80 mm and press Enter. Crop to the grid size group with the suggestion card." />

The Layout Tool keeps your measurement, but it does not change the grid by itself. A card shows the largest grid that fits your drawer and the free space that it leaves.

7. On the card, click <Ui k="drawerDims.suggestionUse" />.

The grid changes to the new size. The line under the steppers shows the grid size in millimeters and the free space. If the fit needs half units, the Layout Tool also turns on <Ui k="sidebar.halfBinMode" />.

::: tip
If no card shows, the grid already fits your drawer. You can also set the size with the <Ui k="common.widthUnits" /> and <Ui k="common.depthUnits" /> steppers, or drag the edges of the grid.
:::

The measured height also sets <Ui k="sidebar.drawerHeight" />. After you place bins, a line below the size tells you if the tallest stack fits under the closed drawer.

## Step 3: Draw your first bin

1. Point at an empty cell on the grid.
2. Push the mouse button down and drag across the cells that the bin covers.
3. Release the mouse button.

The new bin covers the cells that you dragged across. It gets the height of the active layer, and the Layout Tool selects it. The right panel shows <Ui k="rightPanel.binProperties" />.

<Screenshot id="getting-started-first-drawer-draw-bin" alt="A new 2 by 3 bin on the grid, selected, with its properties in the right panel." spec="Layout editor, desktop 1440 px, grid 9 x 7. Draw one 2 x 3 bin at the bottom left and keep it selected. Show the full window." />

## Step 4: Edit the bin

Use the fields in the right panel to change the selected bin.

1. Set <Ui k="common.width" /> and <Ui k="common.depth" /> in grid units.
2. Set <Ui k="common.heightMm" />. The Layout Tool shows the same height in height units below the field.
3. Type a name in <Ui k="common.label" />, for example "Screws".
4. Pick a <Ui k="common.category" />. The category gives the bin its color on the grid.

You can also change a bin on the grid:

| To do this            | Do this                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| Move a bin            | Drag the bin to a new position.                                            |
| Resize a bin          | Drag a handle on the edge or corner of the selected bin.                   |
| Turn a bin 90 degrees | Press <kbd>R</kbd>.                                                        |
| Copy a bin            | Press <kbd>Ctrl</kbd>+<kbd>D</kbd> (<kbd>Cmd</kbd>+<kbd>D</kbd> on a Mac). |
| Delete a bin          | Press <kbd>Delete</kbd>.                                                   |

Draw more bins until the drawer looks right.

## Step 5: Look at the drawer in 3D

1. In the toolbar above the grid, click <Ui k="toolbar.3dView" />. You can also press <kbd>V</kbd>.

The 3D preview opens next to the grid and shows your bins at their real heights.

## Step 6: Read the print list

The <Ui k="rightPanel.binList" /> section in the right panel is your print list. It groups the bins that print the same, and it shows how many of each you need. Below the list, a summary estimates the filament, the print time and the cost.

<Screenshot id="getting-started-first-drawer-bin-list" alt="The bin list in the right panel, with rows for each bin size and the summary of filament, time and cost." spec="Layout editor, desktop 1440 px, about six bins in three sizes, no selection. Crop to the bin list and its summary in the right panel." />

- To paste the list into a spreadsheet, click <Ui k="rightPanel.copyBinListAsTsv" /> (the copy icon in the list header).
- To print a paper plan of the drawer, click <Ui k="header.print" /> in the header.

## Step 7: Get the print files

A bin on the grid has no print file until you link it to a saved design.

1. Select a bin on the grid.
2. In the right panel, find <Ui k="designLinking.inspector.linkedDesign" />.
3. Click <Ui k="designLinking.inspector.createDesign" />.
4. In the <Ui k="designLinking.createDialog.title" /> window, type a name, or click <Ui k="designLinking.createDialog.useLabel" />.
5. Click <Ui k="designLinking.createDialog.create" />.

The bin designer opens with a new design at the size of the bin. The Layout Tool saves the design and links it to the bin. [Design your first bin](./first-bin) shows what you can change there.

6. Click <Ui k="toolSwitcher.layout" /> in the tool switcher to go back to the layout editor.
7. In the header, click <Ui k="header.export" />.
8. Click <Ui k="layoutExport.download" />.

The ZIP file holds each linked bin and the baseplate for the drawer. The export skips bins without a linked design and tells you how many it skipped.

::: tip
To see the draw hint again, click <Ui k="sidebar.settings" /> in the header, then click <Ui k="settings.resetOnboarding" /> at the bottom of the window.
:::

## Next steps

- [Design your first bin](./first-bin): add compartments and a label tab to the design that you linked
- [Make your first baseplate](./first-baseplate): make the plate for this drawer
- [Place and edit bins](../layouts/placing-bins): all the ways to draw, move and resize bins
- [The print list and ZIP export](../printing/print-list-and-zip): what each column and file in the export means
