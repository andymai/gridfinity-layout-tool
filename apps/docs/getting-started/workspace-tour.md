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

When a tutorial says "the sidebar" or "the right panel", this is where to look. Here's a quick walk around the Gridfinity Layout Tool on a desktop screen. It starts with the layout editor, then visits the other two tools, phones and tablets.

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
| <Ui k="header.docs" />              | Opens these docs in a new tab. On most screens it shows as a book icon.                               |
| <Ui k="header.help" />              | Opens help and the list of keyboard shortcuts.                                                        |
| <Ui k="sidebar.settings" />         | Opens the settings window (the gear icon).                                                            |
| <Ui k="header.moreLinks" />         | Links to these docs, the source code and the Gridfinity community.                                    |
| <Ui k="header.supportOnKofi" />     | Opens the page to support the project.                                                                |

On narrow screens, some buttons show only an icon. Hover over an icon to see its name.

## The left sidebar

The left sidebar has the title <Ui k="sidebar.tools" />. From top to bottom, it holds:

- **Layers and categories.** The active layer, the list of <Ui k="common.layers" />, and the list of <Ui k="common.categories" />.
- **<Ui k="sidebar.inspirationGallery" />.** Ideas for your drawer.
- **<Ui k="sidebar.gridSize" />.** The drawer size in grid units, the measured size in millimeters, and <Ui k="sidebar.halfBinMode" />.
- **<Ui k="common.physicalUnits" />.** The grid unit, the height unit and the print bed size.
- **<Ui k="baseplate.title" />.** The baseplate for this layout.
- **<Ui k="sidebar.learn" />.** Links to the guides on the website.
- **Account.** At the bottom, <Ui k="dock.workingLocally" /> tells you that you work without an account. Click it to sign in.

Need more room for the grid? Click <Ui k="sidebar.collapseLeftPanel" /> (the double arrow at the top of the sidebar) to hide it.

## The grid and the stash

The grid in the middle is your drawer. Drag across empty cells to draw a bin.

The toolbar above the grid has the zoom buttons and <Ui k="toolbar.fit" />. It also has <Ui k="toolbar.findBins" /> and <Ui k="toolbar.3dView" />. With more than one layer, you also get <Ui k="toolbar.showLayersBelow" />.

Below the grid is the <Ui k="staging.stash" />, a holding area beside the drawer. Drag a bin there to keep it off the grid without deleting it. When you make the drawer smaller, bins that no longer fit go to the stash, so you don't lose them.

## The 3D preview

Click <Ui k="toolbar.3dView" /> or press <kbd>V</kbd> to open the 3D preview. On a desktop screen, it takes the right half of the grid area and shows each bin at its real height.

## The right panel

The right panel has two tabs.

- **<Ui k="rightPanel.inspector" />** shows the properties of the selected bin. Select more than one bin, and it shows <Ui k="rightPanel.multiSelection" />. Below the properties is the <Ui k="rightPanel.binList" />, which is your print list.
- **<Ui k="rightPanel.historyTab" />** lists snapshots of the layout. The Layout Tool saves a snapshot every 2 minutes. You can restore a snapshot, or open it as a new layout. It's a safety net if you change your mind about a big edit.

To hide the right panel, click <Ui k="rightPanel.collapseRightPanel" />.

## The command palette

Prefer the keyboard? The command palette finds and runs any command in the layout editor. Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>Cmd</kbd>+<kbd>K</kbd> on a Mac), then type a part of the command name. The palette works in the layout editor on desktop and tablet screens. [Keyboard and command palette](../settings/keyboard-and-command-palette) explains what it finds.

<Screenshot id="getting-started-workspace-tour-command-palette" alt="Ctrl+K opens the command palette over the layout editor. Typing layer lists the matching commands." spec="Layout editor. Press Ctrl+K, then type layer. Crop to the palette." />

## Help and search

Click <Ui k="header.help" /> in the header, or press <kbd>?</kbd> or <kbd>/</kbd>. The help window has two tabs: <Ui k="help.shortcuts" /> and <Ui k="help.tipsInfo" />. <Ui k="help.readDocs" />, at the right of the search field, opens these docs in a new tab.

Can't find a control? Type in the search field at the top of the window. The search finds shortcuts and features for the tool that you have open. A result for a control has a <Ui k="help.goTo" /> button, which takes you straight to it. In the layout editor, if no result matches, click <Ui k="help.openCommandPaletteWithQuery" />.

## The bin designer and the baseplate generator

The other two tools follow the same plan: a header, a settings panel on the left, and a 3D preview on the right.

The bin designer header starts with the tool switcher and the design name. Then come these controls:

| Control                              | What it does                                   |
| ------------------------------------ | ---------------------------------------------- |
| <Ui k="binDesigner.designs" />       | Opens your library of saved designs.           |
| <Ui k="common.export" />             | Downloads a print file of the bin.             |
| <Ui k="community.publishButton" />   | Publishes the design to the community gallery. |
| Undo and redo                        | Undo or redo your last change.                 |
| <Ui k="binDesigner.versions.open" /> | Shows the saved versions of the design.        |

The bin designer panel puts its settings in five groups. Click a group to open it or close it.

| Group                                  | What you set there                                                        |
| -------------------------------------- | ------------------------------------------------------------------------- |
| <Ui k="binDesigner.group.shape" />     | Size, footprint, slant, walls, wall cutouts, and the fit on the print bed |
| <Ui k="binDesigner.group.lid" />       | Lid, pull tab and handles                                                 |
| <Ui k="binDesigner.group.interior" />  | Compartments, dividers, label tabs, finger scoop and more                 |
| <Ui k="binDesigner.group.base" />      | Feet, stacking lip, magnets and screws                                    |
| <Ui k="binDesigner.group.finishing" /> | Text, colors, wall and floor patterns, and physical units                 |

This is the <Ui k="binDesigner.panel.viewAsScroll" /> view, the default, and every bin designer page in these docs uses it. A switch next to the search field at the top of the panel also offers <Ui k="binDesigner.panel.viewAsRail" />, a more compact view of the same settings.

The baseplate generator header has the tool switcher, the baseplate name, and <Ui k="common.export" />. Its panel starts with the <Ui k="baseplate.sectionDimensions" /> and <Ui k="baseplate.sectionBase" /> groups. Below them come <Ui k="common.physicalUnits" /> and, for a split plate, the map of pieces.

## Phones and tablets

The Layout Tool changes its layout to suit smaller screens.

| Screen width     | Layout                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 900 px and wider | The desktop layout on this page.                                                                                                                            |
| 768 to 899 px    | Tablet layout. The tool switcher shows icons only. The sidebar and the right panel slide in from the sides. Open them with the round buttons on the screen. |
| Below 768 px     | Phone layout, with a bar of four tabs at the bottom. Each tab opens a panel from the bottom.                                                                |

The four phone tabs are:

- <Ui k="common.layers" />: the layers of the layout
- <Ui k="mobile.nav.bin" />: the properties of the selected bin
- <Ui k="common.categories" />: the categories and their colors
- <Ui k="mobile.nav.list" />: the bin list

On a phone, the grid has no edge handles. To set the drawer size, tap <Ui k="mobile.settings" /> in the header. The command palette and the cutout editor need a larger screen.

## Next steps

- [Plan your first drawer](./first-drawer): use the sidebar, the grid and the right panel in a real task
- [Keyboard and command palette](../settings/keyboard-and-command-palette): all the ways to work from the keyboard
- [Keyboard shortcuts](../reference/shortcuts): the full list of shortcuts
