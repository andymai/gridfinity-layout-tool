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

Let's take one real drawer from a tape measure to a ZIP of print files. You'll enter the drawer size, draw a few bins, check them in 3D, and get a list of what to print. Along the way, you'll link a bin to a design so it has a file to print.

This page teaches the clicks in the layout editor. For advice on which bin sizes to pick, read the [planning guide](https://gridfinitylayouttool.com/guide).

## Before you start

Grab a tape measure and measure the inside of your drawer in millimeters: the width, the depth, and the height under the closed drawer. Use the smallest value on each side.

## Step 1: Open the layout editor

Open the [layout editor](https://gridfinitylayouttool.com/) in your browser.

On your first visit, you get an empty layout. On a desktop screen, the grid is 10 grid units wide and 8 grid units deep. An animated hint on the grid says <Ui k="onboarding.drawTutorial.hint" />, and it stays until you draw your first bin.

## Step 2: Set the drawer size

1. In the left sidebar, find the <Ui k="sidebar.gridSize" /> group, and click <Ui k="drawerDims.addMeasured" /> under the steppers.
2. Type the sizes that you measured, then press <kbd>Enter</kbd>:
   - <Ui k="drawerDims.widthLabel" />
   - <Ui k="drawerDims.depthLabel" />
   - <Ui k="drawerDims.heightLabel" />

<Screenshot id="getting-started-first-drawer-measured-size" alt="Typing a measured drawer size of 400 by 300 by 80 mm into the Grid size group. A card then suggests a grid that fits." spec="Layout editor, desktop 1440 px, default empty layout. Add a measured size of 400 x 300 x 80 mm and press Enter. Crop to the grid size group with the suggestion card." />

Your measurement doesn't resize the grid on its own. Instead, a card suggests the largest grid that fits, and shows how much spare room it leaves.

3. Click <Ui k="drawerDims.suggestionUse" /> on the card. The grid snaps to the new size.

The line under the steppers shows the grid size in millimeters and the free space. If the fit needs half units, the Layout Tool also turns on <Ui k="sidebar.halfBinMode" /> for you.

::: tip
No card? Then the grid already fits your drawer. You can also set the size with the <Ui k="common.widthUnits" /> and <Ui k="common.depthUnits" /> steppers, or drag the edges of the grid.
:::

The measured height also sets <Ui k="sidebar.drawerHeight" />. Once you place bins, a line below the size tells you if the tallest stack fits under the closed drawer.

## Step 3: Draw your first bin

Drag across the empty cells you want the bin to cover. The bin appears and stays selected, so you can edit it right away. It gets the height of the active layer, and the right panel shows <Ui k="rightPanel.binProperties" />.

<Screenshot id="getting-started-first-drawer-draw-bin" alt="Dragging across the grid from the bottom-left cell draws a new 2 by 3 bin, which stays selected." spec="Layout editor, grid 9 x 7. Drag from the bottom-left cell to draw a 2 x 3 bin. Crop to the grid." />

## Step 4: Edit the bin

With the bin selected, change it in the right panel:

- <Ui k="common.width" /> and <Ui k="common.depth" />: the size in grid units.
- <Ui k="common.heightMm" />: the height in millimeters. The same height shows in height units below the field.
- <Ui k="common.label" />: a name, for example "Screws".
- <Ui k="common.category" />: a group for the bin. The category gives the bin its color on the grid.

<Screenshot id="getting-started-first-drawer-edit-bin" alt="A selected 2 by 3 bin next to its properties in the right panel. The height goes up to 42 mm, the label Drill bits goes in, and the category changes to Green." spec="Layout editor, desktop 1440 px, empty 9 x 7 grid with one new 2 x 3 bin at the right edge, selected. Click the plus of Height (mm) three times, type Drill bits in Label, pick Green in Category. Frame the bin and the right panel." />

You can also change a bin right on the grid:

| To do this            | Do this                                                                    |
| --------------------- | -------------------------------------------------------------------------- |
| Move a bin            | Drag the bin to a new position.                                            |
| Resize a bin          | Drag a handle on the edge or corner of the selected bin.                   |
| Turn a bin 90 degrees | Press <kbd>R</kbd>.                                                        |
| Copy a bin            | Press <kbd>Ctrl</kbd>+<kbd>D</kbd> (<kbd>Cmd</kbd>+<kbd>D</kbd> on a Mac). |
| Delete a bin          | Press <kbd>Delete</kbd>.                                                   |

<Screenshot id="getting-started-first-drawer-grid-edits" alt="On the grid, the Drill bits bin moves up three rows and its right edge drags one cell wider. R turns it, Ctrl D copies it, and Delete removes the copy." spec="Layout editor, desktop 1440 px, 9 x 7 grid with six bins. Drag Drill bits up to rows 4 and 5, drag its right edge one column, press R, Ctrl+D, then Delete. Crop to the grid." />

Keep drawing until the drawer looks right. Made a mistake? Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> (<kbd>Cmd</kbd>+<kbd>Z</kbd> on a Mac) to undo it.

## Step 5: Look at the drawer in 3D

Click <Ui k="toolbar.3dView" /> in the toolbar above the grid, or press <kbd>V</kbd>. The 3D preview opens next to the grid and shows your bins at their real heights. It's a quick way to spot a bin that is too tall.

<Screenshot id="getting-started-first-drawer-3d-view" alt="Clicking 3D View in the toolbar opens the 3D preview beside the grid. A close-up shows each bin at its real height." spec="Layout editor, desktop 1440 px, 9 x 7 grid with six bins of 3u and 6u. Click 3D View, then cut to the preview, zoomed on the bins." />

## Step 6: Read the print list

The <Ui k="rightPanel.binList" /> section in the right panel is your print list. It groups the bins that print the same, and it shows how many of each you need. Below the list, a summary estimates the filament, the print time and the cost.

<Screenshot id="getting-started-first-drawer-bin-list" alt="The bin list in the right panel, with rows for each bin size and the summary of filament, time and cost." spec="Layout editor, desktop 1440 px, about six bins in three sizes, no selection. Crop to the bin list and its summary in the right panel." />

- To paste the list into a spreadsheet, click <Ui k="rightPanel.copyBinListAsTsv" /> (the copy icon in the list header).
- To print a paper plan of the drawer, click <Ui k="header.print" /> in the header.

## Step 7: Get the print files

A bin on the grid has no print file until you link it to a saved design. Here's how to make one:

1. Select a bin on the grid. In the right panel, under <Ui k="designLinking.inspector.linkedDesign" />, click <Ui k="designLinking.inspector.createDesign" />.
2. A window titled <Ui k="designLinking.createDialog.title" /> opens. Type a name, or click <Ui k="designLinking.createDialog.useLabel" />.
3. Click <Ui k="designLinking.createDialog.create" />. The bin designer opens with a new design at the size of the bin. The Layout Tool saves the design and links it to the bin for you.

<Screenshot id="getting-started-first-drawer-create-design" alt="Selecting the Drill bits bin and clicking Create under Linked design. In the Create design from bin window, Use bin label fills in the name, and Create & open designer opens the bin designer with the new design." spec="Layout editor, desktop 1440 px, 9 x 7 grid with six bins. Click Drill bits, then Create in the right panel. In the window, click Use bin label, then Create & open designer. Cut to the bin designer with the 3 x 2 bin." />

4. Click <Ui k="toolSwitcher.layout" /> in the tool switcher to go back to the layout editor.
5. Click <Ui k="header.export" /> in the header, then click <Ui k="layoutExport.download" />.

<Screenshot id="getting-started-first-drawer-export" alt="The Export window of the layout editor, with the format, the file name, a note that 5 of the 6 bins have no linked design and are skipped, and Download ZIP." spec="Layout editor, desktop 1440 px, 9 x 7 grid with six bins, Drill bits linked to a design made with Create. Click Export in the header. Crop to the window." />

The ZIP file holds each linked bin and the baseplate for the drawer. The export skips bins without a linked design and tells you how many it skipped. [Design your first bin](./first-bin) shows what you can change in the design.

::: tip
Print one bin before you print twenty. A single test bin tells you if the fit and your print settings are right.
:::

Want the draw hint back? Click <Ui k="sidebar.settings" /> in the header, then click <Ui k="settings.resetOnboarding" /> at the bottom of the window.

## Next steps

- [Design your first bin](./first-bin): add compartments and a label tab to the design that you linked
- [Make your first baseplate](./first-baseplate): make the plate for this drawer
- [Place and edit bins](../layouts/placing-bins): all the ways to draw, move and resize bins
- [The print list and ZIP export](../printing/print-list-and-zip): what each column and file in the export means
- [A screw and small-parts drawer](../recipes/screw-drawer): a full drawer of labeled bins, from tape measure to print
