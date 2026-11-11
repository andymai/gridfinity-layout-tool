---
title: Keyboard and command palette
description: 'Run any layout command from the command palette, and move through menus, tabs and dialogs with the keyboard.'
sources:
  - src/features/command-palette/
  - src/shell/Modals/HelpModal/HelpModal.tsx
  - src/design-system/Menu/Menu.tsx
  - src/design-system/Tabs/Tabs.tsx
  - src/shell/Modals/SettingsModal/TabNavigation/TabNavigation.tsx
  - src/features/bin-designer/components/ParameterPanel/DesignerSearchBar/DesignerSearchBar.tsx
---

# Keyboard and command palette

Do you know what you want to do, but not where the button is? Press <kbd>Ctrl</kbd>+<kbd>K</kbd> and type it. The command palette of the Gridfinity Layout Tool finds any layout command from part of its name. With the palette and the keyboard controls on this page, you can plan a drawer with very few mouse clicks. For every shortcut, see [Keyboard shortcuts](../reference/shortcuts).

## Open the command palette

1. Open the layout editor.
2. Click the grid or an empty part of the page, so that no text field has the focus.
3. Press <kbd>Ctrl</kbd>+<kbd>K</kbd>, or <kbd>Cmd</kbd>+<kbd>K</kbd> on a Mac.

The palette works in the layout editor on a computer or a tablet. It doesn't open in the bin designer, in the baseplate generator, or on a phone.

<Screenshot id="settings-keyboard-palette" alt="The command palette open over the layout editor, with the search box, the Recent group and the command groups below it." spec="Layout editor, desktop, a sample layout with two bins selected. Press Ctrl+K. Do not type a query. Show the whole palette with the Recent group, the first command groups and the footer with the key hints." />

## Find and run a command

Type part of a command name in <Ui k="commandPalette.placeholder" />. The list gets shorter as you type.

| Key                           | Action                               |
| ----------------------------- | ------------------------------------ |
| <kbd>↑</kbd> and <kbd>↓</kbd> | Move to the previous or next command |
| <kbd>Enter</kbd>              | Run the selected command             |
| <kbd>Esc</kbd>                | Close the palette                    |

A command that has a shortcut shows its keys on the right. Look there to learn the shortcuts of the commands that you use often.

## What the palette finds

The palette sorts the commands into groups:

| Group                                         | Examples                                                                                                                    |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="commandPalette.category.navigation" /> | <Ui k="commandPalette.openLayoutManager" />, <Ui k="commandPalette.openSettings" />, <Ui k="commandPalette.openWhatsNew" /> |
| <Ui k="commandPalette.category.edit" />       | <Ui k="commandPalette.duplicateSelected" />, <Ui k="commandPalette.alignLeft" />, <Ui k="commandPalette.matchHeight" />     |
| <Ui k="commandPalette.category.layers" />     | <Ui k="commandPalette.addLayer" />, <Ui k="commandPalette.layerUp" />, <Ui k="commandPalette.clearLayer" />                 |
| <Ui k="commandPalette.category.view" />       | <Ui k="commandPalette.zoomIn" />, <Ui k="commandPalette.fitToScreen" />, <Ui k="commandPalette.toggleOtherLayers" />        |
| <Ui k="commandPalette.category.preview" />    | <Ui k="commandPalette.togglePreview" />, <Ui k="commandPalette.expandPreview" />                                            |
| <Ui k="commandPalette.category.bins" />       | <Ui k="commandPalette.nextBin" />, <Ui k="commandPalette.moveToStash" />, <Ui k="commandPalette.restoreFromStaging" />      |
| <Ui k="commandPalette.category.tools" />      | <Ui k="commandPalette.fillGaps" />, <Ui k="commandPalette.togglePaintMode" />, <Ui k="commandPalette.toggleHalfBin" />      |
| <Ui k="commandPalette.category.export" />     | <Ui k="commandPalette.exportLayout3D" />, <Ui k="commandPalette.downloadLayout" />, <Ui k="commandPalette.copyShareLink" /> |

The <Ui k="commandPalette.recent" /> group at the top shows up to five commands. It picks them from how often and how recently you used each command, and from what you do at the moment. For example, select some bins, and the align and delete commands move up. A command that can't run at the moment stays in its group, but you can't select it.

With the Places feature from [Labs](./labs) turned on, the palette also finds bins by what they hold, in all your layouts. These results show above the commands. Select one to open its layout and select the bin.

## Search from the help dialog

Press <kbd>?</kbd> or <kbd>/</kbd> to open <Ui k="help.title" />. Type in <Ui k="help.searchPlaceholder" /> to find a shortcut or a feature. No match? Click <Ui k="help.openCommandPaletteWithQuery" />, and the command palette opens with the same words.

## Move through menus and panels

Most controls in the Layout Tool work from the keyboard. Press <kbd>Tab</kbd> to go to the next control, and <kbd>Shift</kbd>+<kbd>Tab</kbd> to go back.

| Control                    | Keys                                                                                                                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Menus                      | The first item gets the focus. <kbd>↑</kbd> and <kbd>↓</kbd> move through the items and wrap at the ends. <kbd>Home</kbd> and <kbd>End</kbd> go to the first and last item. <kbd>Esc</kbd> or <kbd>Tab</kbd> closes the menu. |
| Tabs and segmented buttons | The arrow keys move to the next or previous option. <kbd>Home</kbd> and <kbd>End</kbd> go to the first and last option.                                                                                                       |
| The tab list in Settings   | <kbd>↑</kbd> and <kbd>↓</kbd> move through all the tabs, across the groups.                                                                                                                                                   |
| Dialogs                    | The focus stays in the dialog. <kbd>Esc</kbd> closes it.                                                                                                                                                                      |

In the layout editor, a <Ui k="app.skipToGridEditor" /> link shows when it gets the keyboard focus. Press <kbd>Enter</kbd> on it to jump to the grid. On the grid, the arrow keys move the selected bins. See [Keyboard shortcuts](../reference/shortcuts) for all grid keys.

In the bin designer, the search box at the top of the panel finds a setting by name. Type a word, pick a match with <kbd>↑</kbd> and <kbd>↓</kbd>, and press <kbd>Enter</kbd> to jump to that setting. <kbd>Esc</kbd> clears the search.

## Next steps

- [Keyboard shortcuts](../reference/shortcuts): the full table of shortcuts in each tool.
- [Settings and accessibility](./settings): reduce motion, high contrast and patterns for categories.
- [Work with several bins](../layouts/multi-select): select many bins, then align or move them with commands.
