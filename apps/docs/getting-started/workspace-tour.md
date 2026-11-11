---
title: A tour of the workspace
description: 'Find the header, the sidebar, the right panel, the 3D preview, the command palette and help search.'
sources:
  - src/shell/Header/Header.tsx
  - src/shell/Sidebar/Sidebar.tsx
  - src/shell/RightPanel/RightPanel.tsx
  - src/shared/components/HeaderSupportLinks/HeaderSupportLinks.tsx
  - src/features/command-palette/hooks/useCommandPalette.ts
  - src/shell/Modals/HelpModal/
  - src/shell/Mobile/
  - src/shell/Tablet/
---

# A tour of the workspace

This page shows where each part of the Gridfinity Layout Tool is on a desktop screen. It starts with the layout editor, then covers the other two tools, phones and tablets.

<Screenshot id="getting-started-workspace-tour-overview" alt="The layout editor on a desktop screen, with the header, left sidebar, grid, 3D preview and right panel marked." spec="Layout editor, desktop 1440 x 900 px, about eight bins, one selected, 3D preview open. Full window with numbered markers: 1 header, 2 sidebar, 3 grid, 4 preview, 5 right panel, 6 stash." />

## The header

From left to right, the layout editor header has these controls:

| Control                             | What it does                                                                                          |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Tool switcher                       | Opens the layout editor, the bin designer or the baseplate generator.                                 |
| Layout name                         | Click the name to change it.                                                                          |
| Layout menu                         | The button next to the name. It has <Ui k="layouts.newLayout" /> and <Ui k="header.manageLayouts" />. |
| <Ui k="header.print" />             | Opens a paper plan of the drawer to print.                                                            |
| <Ui k="header.export" />            | Downloads a ZIP of each linked bin and the baseplate.                                                 |
| <Ui k="header.saved" />             | Shows that the Layout Tool saved your last change.                                                    |
| Undo and redo                       | Undo or redo your last change.                                                                        |
| <Ui k="share.button.shareLayout" /> | Makes a share link for the layout.                                                                    |
| <Ui k="header.changeLanguage" />    | Sets the language of the Layout Tool.                                                                 |
| <Ui k="header.sendFeedback" />      | Opens the issue tracker to report a problem.                                                          |
| <Ui k="header.help" />              | Opens help and the list of keyboard shortcuts.                                                        |
| <Ui k="sidebar.settings" />         | Opens the settings window (the gear icon).                                                            |
| <Ui k="header.moreLinks" />         | Links to the source code and the Gridfinity community.                                                |
| <Ui k="header.supportOnKofi" />     | Opens the page to support the project.                                                                |

On narrow screens, some buttons show only an icon. Point at an icon to see its name.

## The left sidebar

The left sidebar has the title <Ui k="sidebar.tools" />. From top to bottom, it holds:

- **Layers and categories.** The active layer, the list of <Ui k="common.layers" />, and the list of <Ui k="common.categories" />.
- **<Ui k="sidebar.inspirationGallery" />.** Ideas for your drawer.
- **<Ui k="sidebar.gridSize" />.** The drawer size in grid units, the measured size in millimeters, and <Ui k="sidebar.halfBinMode" />.
- **<Ui k="common.physicalUnits" />.** The grid unit, the height unit and the print bed size.
- **<Ui k="baseplate.title" />.** The baseplate for this layout.
- **<Ui k="sidebar.learn" />.** Links to the guides on the website.
- **Account.** At the bottom, <Ui k="dock.workingLocally" /> shows that you work without an account. Click it to sign in.

To hide the sidebar, click <Ui k="sidebar.collapseLeftPanel" /> (the double arrow at its top).

## The grid and the stash

The grid in the middle is the drawer. Drag across empty cells to draw a bin.

The toolbar above the grid has the zoom buttons, <Ui k="toolbar.fit" />, <Ui k="toolbar.findBins" /> and <Ui k="toolbar.3dView" />. With more than one layer, it also has <Ui k="toolbar.showLayersBelow" />.

Below the grid is the <Ui k="staging.stash" />. Drag a bin there to keep it off the grid without deleting it. When you make the drawer smaller, bins that no longer fit go to the stash.

## The 3D preview

Click <Ui k="toolbar.3dView" /> or press <kbd>V</kbd> to open the 3D preview. On a desktop screen, it takes the right half of the grid area and shows each bin at its real height.

## The right panel

The right panel has two tabs.

- **<Ui k="rightPanel.inspector" />** shows the properties of the selected bin. When you select more than one bin, it shows <Ui k="rightPanel.multiSelection" />. Below the properties is the <Ui k="rightPanel.binList" />, which is your print list.
- **<Ui k="rightPanel.historyTab" />** lists snapshots of the layout. The Layout Tool saves a snapshot every 2 minutes. You can restore a snapshot, or open it as a new layout.

To hide the right panel, click <Ui k="rightPanel.collapseRightPanel" />.

## The command palette

The command palette finds and runs any command in the layout editor from the keyboard.

1. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>Cmd</kbd>+<kbd>K</kbd> on a Mac).
2. Type a part of the command name, for example "layer".
3. Press <kbd>Enter</kbd> to run the selected command.

The command palette works in the layout editor on desktop and tablet screens.

<Screenshot id="getting-started-workspace-tour-command-palette" alt="The command palette open over the layout editor, with a search for layer and the matching commands." spec="Layout editor, desktop 1440 px. Press Ctrl+K and type layer. Crop to the palette." />

## Help and search

Click <Ui k="header.help" /> in the header, or press <kbd>?</kbd> or <kbd>/</kbd>. The help window has two tabs: <Ui k="help.shortcuts" /> and <Ui k="help.tipsInfo" />.

At the top of the window, type in the search field. The search finds shortcuts and features for the tool that you have open. A result for a control has a <Ui k="help.goTo" /> button, which takes you to the control. In the layout editor, if no result matches, click <Ui k="help.openCommandPaletteWithQuery" />.

## The bin designer and the baseplate generator

The other two tools have the same plan. Each has a header, a settings panel on the left, and a 3D preview on the right.

- **Bin designer header:** the tool switcher, the design name, <Ui k="binDesigner.designs" />, <Ui k="common.export" />, <Ui k="community.publishButton" />, undo and redo, and <Ui k="binDesigner.versions.open" />.
- **Bin designer panel:** the groups <Ui k="binDesigner.group.shape" />, <Ui k="binDesigner.group.lid" />, <Ui k="binDesigner.group.interior" />, <Ui k="binDesigner.group.base" /> and <Ui k="binDesigner.group.finishing" />.
- **Baseplate generator header:** the tool switcher, the baseplate name, and <Ui k="common.export" />.
- **Baseplate generator panel:** <Ui k="baseplate.sectionDimensions" />, <Ui k="baseplate.sectionBase" />, <Ui k="common.physicalUnits" />, and the map of pieces for a split plate.

## Phones and tablets

The Layout Tool changes its layout for smaller screens.

| Screen width     | Layout                                                                                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 900 px and wider | The desktop layout on this page.                                                                                                                                                                           |
| 768 to 899 px    | Tablet layout. The tool switcher shows icons only. The sidebar and the right panel slide in from the sides. Open them with the round buttons on the screen.                                                |
| Below 768 px     | Phone layout. A bar at the bottom has four tabs: <Ui k="common.layers" />, <Ui k="mobile.nav.bin" />, <Ui k="common.categories" /> and <Ui k="mobile.nav.list" />. Each tab opens a panel from the bottom. |

On a phone, the grid has no edge handles. To set the drawer size, tap <Ui k="mobile.settings" /> in the header. The command palette and the cutout editor need a larger screen.

## Next steps

- [Plan your first drawer](./first-drawer): use the sidebar, the grid and the right panel in a real task
- [Keyboard and command palette](../settings/keyboard-and-command-palette): all the ways to work from the keyboard
- [Keyboard shortcuts](../reference/shortcuts): the full list of shortcuts
