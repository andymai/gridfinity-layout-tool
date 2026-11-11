---
title: What the Layout Tool does
description: 'See the three tools, how they share one drawer, and which print files and lists you get.'
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

The Gridfinity Layout Tool helps you organize a drawer with 3D-printed Gridfinity bins. You plan the drawer, design the bins and the baseplate, and download the files for your slicer. This page shows the three tools, how they work together, and what you get at the end.

## Three tools for one drawer

The tool switcher at the top left of each page has three tabs. Each tab opens one tool, and all three tools work on the same drawer.

| Tab                                        | Tool                | What you do there                                                                                                      |
| ------------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| <Ui k="toolSwitcher.layout" />             | Layout editor       | Set the drawer size, draw bins on a grid, stack bins in layers, and read the print list.                               |
| <Ui k="toolSwitcher.binDesigner" />        | Bin designer        | Design one bin: its size, compartments, label tabs, scoops, lid and cutouts. Export it as a print file.                |
| <Ui k="toolSwitcher.baseplateGenerator" /> | Baseplate generator | Make the plate that sits in the drawer and holds the bins. Add magnets or screws, and split a large plate into pieces. |

<Screenshot id="introduction-what-it-does-tool-switcher" alt="The tool switcher with its three tabs at the top left of the layout editor header." spec="Layout editor on desktop at 1440 px wide, default empty layout, first tab active. Crop the left part of the header so that the three tool switcher tabs and the layout name show." />

Each tool also has its own address:

- Layout editor: [gridfinitylayouttool.com](https://gridfinitylayouttool.com/)
- Bin designer: [gridfinitylayouttool.com/designer](https://gridfinitylayouttool.com/designer)
- Baseplate generator: [gridfinitylayouttool.com/baseplate](https://gridfinitylayouttool.com/baseplate)

To go between the layout editor and the bin designer from the keyboard, press <kbd>Shift</kbd>+<kbd>D</kbd>.

## How the tools work together

The three tools share data, so you do not type the same size twice.

**Linked bins.** A bin that you draw in the layout editor has a size, a height, a label and a category. It has no print file yet. To get one, you link the bin to a saved design from the bin designer. Select the bin, then click <Ui k="designLinking.inspector.createDesign" /> in the <Ui k="designLinking.inspector.linkedDesign" /> section of the right panel. The bin designer opens with a new design at the size of the bin, and the bin links to it. More than one bin can link to the same design.

**The baseplate follows the drawer.** The baseplate generator reads the drawer size from your active layout. When you change the drawer in the layout editor, the plate changes too. To give the plate its own size, turn off <Ui k="baseplate.syncWithLayout" />.

**One export for the whole drawer.** <Ui k="header.export" /> in the layout editor header downloads one ZIP file. The ZIP holds each linked bin and the baseplate. The export skips bins that have no linked design, and the dialog tells you how many it skipped.

## What you get at the end

| Output              | Where you get it                                                      | What it holds                                                                                  |
| ------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| One print file      | <Ui k="common.export" /> in the bin designer or baseplate generator   | One bin or one baseplate as a 3MF, STL or STEP file.                                           |
| A ZIP of the drawer | <Ui k="header.export" /> in the layout editor                         | The files for each linked bin and for the baseplate.                                           |
| Baseplate pieces    | <Ui k="common.export" /> in the baseplate generator                   | For a plate larger than your print bed: one file for each piece and a print guide, in one ZIP. |
| The print list      | <Ui k="rightPanel.binList" /> in the right panel of the layout editor | Each bin size, how many you need, and estimates of filament, print time and cost.              |
| A paper plan        | <Ui k="header.print" /> in the layout editor header                   | A drawing of the drawer with labels, a legend and the bin list, to print on paper.             |

To paste the print list into a spreadsheet, click <Ui k="rightPanel.copyBinListAsTsv" /> (the copy icon in the list header).

## Free, in your browser, and offline

The Layout Tool is free and open source. You do not need an account to use it.

All three tools run in your web browser, and the 3D engine runs on your own computer. You do not install anything. Use a recent version of Chrome, Edge, Firefox or Safari.

Your browser keeps a copy of each tool that you open. After the first visit, the tool works without an internet connection. Some features need a connection: share links, sign-in and sync, and the [community gallery](https://gridfinitylayouttool.com/community).

The Layout Tool saves your work in your browser as you go. To use the same layouts and designs on more than one device, sign in. [Your data and privacy](./your-data) tells you what stays on your device and what goes to the server.

## Next steps

- [Gridfinity in five minutes](./gridfinity-basics): the grid, the height units and the parts, if you are new to Gridfinity
- [Plan your first drawer](../getting-started/first-drawer): a step-by-step tutorial in the layout editor
- [A tour of the workspace](../getting-started/workspace-tour): where each panel and control is
- [Install and work offline](../settings/offline): how the offline copy works
