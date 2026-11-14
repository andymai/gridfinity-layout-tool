---
title: What the Layout Tool does
description: 'Plan Gridfinity drawers, design custom bins and baseplates, and print them with the free Gridfinity Layout Tool.'
sources:
  - src/shared/components/ToolSwitcher/
  - src/features/design-linking/components/LinkedDesignSection/
  - src/shell/layoutExport/
  - src/features/baseplate/utils/buildFullParams.ts
  - src/shell/RightPanel/RightPanel.tsx
  - src/shared/components/ExportDialog/ExportDialog.tsx
  - vite.config.ts
---

# What the Layout Tool does

Got a messy drawer and a 3D printer? The Gridfinity Layout Tool helps you turn one into a neat set of Gridfinity bins. You plan the drawer, design the bins and the plate under them, and download files that are ready for your slicer.

<Screenshot id="introduction-overview" alt="Drawing the last bin into a drawer layout, then a bin designed with compartments, labels and color, then a baseplate split into pieces for the print bed." spec="Three cuts at 16:9. Layout editor, side panels closed: drag the last bin into the empty corner. Bin designer, a 3 x 2 x 6 bin: plain, then with three compartments and a label, then in color. Baseplate generator, exploded view for a 220 mm bed." />

## Three tools for one drawer

The tool switcher at the top left of each page has three tabs. Each tab opens one tool, and all three work on the same drawer.

| Tab                                        | Tool                | What you do there                                                                                                      |
| ------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| <Ui k="toolSwitcher.layout" />             | Layout editor       | Set the drawer size, draw bins on a grid, stack bins in layers, and read the print list.                               |
| <Ui k="toolSwitcher.binDesigner" />        | Bin designer        | Design one bin: its size, compartments, label tabs, scoops, lid and cutouts. Export it as a print file.                |
| <Ui k="toolSwitcher.baseplateGenerator" /> | Baseplate generator | Make the plate that sits in the drawer and holds the bins. Add magnets or screws, and split a large plate into pieces. |

<Screenshot id="introduction-what-it-does-tool-switcher" alt="The tool switcher with its three tabs at the top left of the layout editor header." spec="Layout editor on desktop at 1440 px wide, default empty layout, first tab active. Crop the left part of the header so that the three tool switcher tabs and the layout name show." />

Each tool also has its own address, so you can bookmark the one you use most:

- Layout editor: [gridfinitylayouttool.com](https://gridfinitylayouttool.com/)
- Bin designer: [gridfinitylayouttool.com/designer](https://gridfinitylayouttool.com/designer)
- Baseplate generator: [gridfinitylayouttool.com/baseplate](https://gridfinitylayouttool.com/baseplate)

To jump between the layout editor and the bin designer from the keyboard, press <kbd>Shift</kbd>+<kbd>D</kbd>.

## How the tools work together

The three tools share their data, so you never type the same size twice.

**Linked bins.** A bin that you draw in the layout editor starts as a plain box. It has a size, a height, a label and a category, but no print file yet. To get one, you link the bin to a saved design from the bin designer. Select the bin, then click <Ui k="designLinking.inspector.createDesign" /> in the right panel, under <Ui k="designLinking.inspector.linkedDesign" />. The bin designer opens with a new design at the size of the bin, and the bin links to it. Many bins can link to the same design.

**The baseplate follows the drawer.** The baseplate generator reads the drawer size from your active layout. Change the drawer in the layout editor, and the plate changes too. To give the plate a size of its own, turn off <Ui k="baseplate.syncWithLayout" />.

**One export for the whole drawer.** <Ui k="header.export" /> in the layout editor header downloads one ZIP file with each linked bin and the baseplate. The export skips bins that have no linked design, and the dialog tells you how many it skipped.

## What you get at the end

| Output              | Where you get it                                                      | What it holds                                                                                  |
| ------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| One print file      | <Ui k="common.export" /> in the bin designer or baseplate generator   | One bin or one baseplate as a 3MF, STL or STEP file.                                           |
| A ZIP of the drawer | <Ui k="header.export" /> in the layout editor                         | The files for each linked bin and for the baseplate.                                           |
| Baseplate pieces    | <Ui k="common.export" /> in the baseplate generator                   | For a plate larger than your print bed: one file for each piece and a print guide, in one ZIP. |
| The print list      | <Ui k="rightPanel.binList" /> in the right panel of the layout editor | Each bin size, how many you need, and estimates of filament, print time and cost.              |
| A paper plan        | <Ui k="header.print" /> in the layout editor header                   | A drawing of the drawer with labels, a legend and the bin list, to print on paper.             |

Want the print list in a spreadsheet? Click <Ui k="rightPanel.copyBinListAsTsv" /> (the copy icon in the list header), then paste.

## Free, in your browser, and offline

The Layout Tool is free and open source, and you don't need an account to use it.

All three tools run in your web browser, and the 3D engine runs on your own computer. There's nothing to install. Use a recent version of Chrome, Edge, Firefox or Safari.

Your browser keeps a copy of each tool that you open. After your first visit, the tool works without an internet connection. A few features need a connection: share links, sign-in and sync, and the [community gallery](https://gridfinitylayouttool.com/community).

Your work saves in your browser as you go, so you can close the tab and pick up later. To use the same layouts and designs on more than one device, sign in. [Your data and privacy](/introduction/your-data) tells you what stays on your device and what goes to the server.

## Next steps

- [Gridfinity in five minutes](/introduction/gridfinity-basics): the grid, the height units and the parts, if you are new to Gridfinity
- [Plan your first drawer](/getting-started/first-drawer): a step-by-step tutorial in the layout editor
- [A tour of the workspace](/getting-started/workspace-tour): where each panel and control is
- [Install and work offline](/settings/offline): how the offline copy works
