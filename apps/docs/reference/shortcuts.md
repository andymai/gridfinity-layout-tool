---
title: Keyboard shortcuts
description: 'Look up every keyboard shortcut in the layout editor, bin designer and baseplate generator, with the macOS keys.'
sources:
  - src/core/constants.ts
  - src/shell/keyboard/handlers.ts
  - src/shared/hooks/use3DPreviewKeyboard.ts
  - src/features/grid-editor/components/Grid/Bin/useBinPointerInteraction.ts
  - src/features/bin-designer/hooks/useDesignerKeyboard.ts
  - src/features/bin-designer/components/panel/CutoutsSection/handlers/keyboardHandler.ts
  - src/features/bin-designer/components/Workshop/useWorkshopInteraction.ts
  - src/features/baseplate/hooks/useBaseplateKeyboard.ts
---

# Keyboard shortcuts

This page lists the keyboard shortcuts in the Gridfinity Layout Tool, grouped by tool. Use it to find the key for a task that you do often. Each table gives the key for Windows and Linux, and the key for macOS.

::: tip
Shortcuts do not work while the cursor is in a text field. Click an empty part of the canvas, then press the key again.
:::

## Open the shortcut list

Press <kbd>?</kbd> or <kbd>/</kbd> in any tool to open the <Ui k="help.title" /> panel. The <Ui k="help.shortcuts" /> tab lists the main shortcuts, and the search field finds a shortcut by its name.

<Screenshot id="reference-shortcuts-panel" alt="The Keyboard shortcuts panel open on the Shortcuts tab, with the General and Editing groups." spec="Layout editor with any layout open. Press ? to open the Keyboard shortcuts panel on the Shortcuts tab. The General and Editing groups must be visible. Crop to the panel." />

## Shortcuts in more than one tool

| Windows and Linux                                                             | macOS                                                                       | Action                                                 | Where                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------- |
| <kbd>?</kbd> or <kbd>/</kbd>                                                  | Same                                                                        | Open the shortcut list                                 | Every tool                  |
| <kbd>Ctrl</kbd>+<kbd>K</kbd>                                                  | <kbd>Cmd</kbd>+<kbd>K</kbd>                                                 | Open the command palette                               | Layout editor               |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>                                                  | <kbd>Cmd</kbd>+<kbd>Z</kbd>                                                 | Undo                                                   | Layout editor, bin designer |
| <kbd>Ctrl</kbd>+<kbd>Y</kbd> or <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | <kbd>Cmd</kbd>+<kbd>Y</kbd> or <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> | Redo                                                   | Layout editor, bin designer |
| <kbd>Shift</kbd>+<kbd>D</kbd>                                                 | Same                                                                        | Go from the layout editor to the bin designer, or back | Layout editor, bin designer |

## Layout editor

### Edit bins

| Windows and Linux                         | macOS                       | Action                                                                                                        |
| ----------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>D</kbd>              | <kbd>Cmd</kbd>+<kbd>D</kbd> | Duplicate the selected bins                                                                                   |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | Same                        | Delete the selected bins. A bin in a pair takes its partner with it.                                          |
| <kbd>R</kbd>                              | Same                        | Rotate the selected bin. Select one bin only.                                                                 |
| <kbd>L</kbd>                              | Same                        | Edit the label of the selected bin. Select one bin only.                                                      |
| Arrow keys                                | Same                        | Move the selected bins one grid unit. If a selected bin has a half-unit size, they move half a unit.          |
| <kbd>[</kbd> and <kbd>]</kbd>             | Same                        | Give the selected bins the previous or next category. With no bin selected, change the category for new bins. |
| <kbd>H</kbd>                              | Same                        | Turn half-grid mode on or off                                                                                 |
| <kbd>Escape</kbd>                         | Same                        | Stop the current drag or draw, clear the selection and stop paint mode                                        |

### Move around the layout

| Windows and Linux            | macOS                       | Action                                                                                                 |
| ---------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| <kbd>W</kbd>                 | Same                        | Go to the layer above                                                                                  |
| <kbd>S</kbd>                 | Same                        | Go to the layer below                                                                                  |
| <kbd>A</kbd>                 | Same                        | Select the previous bin on the active layer                                                            |
| <kbd>D</kbd>                 | Same                        | Select the next bin on the active layer. The order goes from the front row to the back, left to right. |
| Arrow keys                   | Same                        | With a bin in keyboard focus and no selection, move the focus to the nearest bin in that direction     |
| <kbd>+</kbd> or <kbd>=</kbd> | Same                        | Zoom in                                                                                                |
| <kbd>-</kbd>                 | Same                        | Zoom out                                                                                               |
| <kbd>Ctrl</kbd>+<kbd>O</kbd> | <kbd>Cmd</kbd>+<kbd>O</kbd> | Open the layout manager                                                                                |

### 3D preview

| Windows and Linux | macOS | Action                                                                                      |
| ----------------- | ----- | ------------------------------------------------------------------------------------------- |
| <kbd>V</kbd>      | Same  | Show or hide the 3D preview. The key works after you open the preview once.                 |
| <kbd>Space</kbd>  | Same  | Make the 3D preview larger, or return it to its usual size                                  |
| <kbd>Escape</kbd> | Same  | Close the large preview                                                                     |
| <kbd>E</kbd>      | Same  | Turn the exploded layer view on or off. This needs a desktop screen and two or more layers. |

### Mouse with a modifier key

| Windows and Linux                             | macOS                                          | Action                                                                                                                                       |
| --------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| <kbd>Ctrl</kbd>+click a bin                   | <kbd>Cmd</kbd>+click a bin                     | Add the bin to the selection, or remove it                                                                                                   |
| <kbd>Alt</kbd>+drag a bin                     | <kbd>Option</kbd>+drag a bin                   | Duplicate the bin and move the copy                                                                                                          |
| <kbd>Shift</kbd>+drag a bin                   | Same                                           | Swap the bin with the bin you drop it on, if the two can change places                                                                       |
| Hold <kbd>Ctrl</kbd> while you draw or drag   | Hold <kbd>Control</kbd> while you draw or drag | Stop the automatic fit. Without the key, a moved bin that hits another bin goes to a free spot nearby, and a new bin stops at the other bin. |
| Click a row or column number                  | Same                                           | Select every bin in that row or column of the active layer                                                                                   |
| <kbd>Shift</kbd>+click a row or column number | Same                                           | Add all rows or columns from the last one you clicked                                                                                        |
| <kbd>Ctrl</kbd>+click a row or column number  | <kbd>Cmd</kbd>+click a row or column number    | Add the bins in that row or column, or remove them                                                                                           |

### Drawer shape editor

These keys work in the <Ui k="drawerShape.penTitle" /> dialog, where you draw a drawer that is not a rectangle.

| Windows and Linux                         | macOS                       | Action                                                            |
| ----------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Hold <kbd>Space</kbd> and drag            | Same                        | Pan the view                                                      |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd>              | <kbd>Cmd</kbd>+<kbd>Z</kbd> | Undo the last change to the shape                                 |
| <kbd>Ctrl</kbd>+<kbd>A</kbd>              | <kbd>Cmd</kbd>+<kbd>A</kbd> | Select every corner                                               |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | Same                        | Delete the selected corners                                       |
| Arrow keys                                | Same                        | Move the selected corners one snap step, or 1 mm when snap is off |
| <kbd>Shift</kbd>+arrow key                | Same                        | Move the selected corners ten steps                               |
| <kbd>Escape</kbd>                         | Same                        | Clear the corner selection                                        |

## Bin designer

### 3D preview

| Windows and Linux | macOS | Action                                      |
| ----------------- | ----- | ------------------------------------------- |
| <kbd>1</kbd>      | Same  | Front view                                  |
| <kbd>2</kbd>      | Same  | Side view                                   |
| <kbd>3</kbd>      | Same  | Top view                                    |
| <kbd>4</kbd>      | Same  | Isometric view                              |
| <kbd>R</kbd>      | Same  | Reset the view                              |
| <kbd>W</kbd>      | Same  | Turn the wireframe view on or off           |
| <kbd>X</kbd>      | Same  | Turn the X-ray view on or off               |
| <kbd>P</kbd>      | Same  | Change between perspective and orthographic |

### Cutout editor tools

The <Ui k="binDesigner.cutoutEditor.title" /> has its own keys. Some letters do a different task there than in the 3D preview.

| Windows and Linux | macOS | Action                                                                                                   |
| ----------------- | ----- | -------------------------------------------------------------------------------------------------------- |
| <kbd>V</kbd>      | Same  | <Ui k="binDesigner.cutouts.pointerTool" /> tool                                                          |
| <kbd>R</kbd>      | Same  | <Ui k="binDesigner.cutouts.addRectangle" /> tool. With cutouts selected, turn them 90 degrees clockwise. |
| <kbd>C</kbd>      | Same  | <Ui k="binDesigner.cutouts.addCircle" /> tool                                                            |
| <kbd>G</kbd>      | Same  | <Ui k="binDesigner.cutouts.addPolygon" /> tool                                                           |
| <kbd>P</kbd>      | Same  | <Ui k="binDesigner.cutouts.penTool" /> tool                                                              |
| <kbd>S</kbd>      | Same  | <Ui k="binDesigner.cutouts.addSlot" /> tool                                                              |
| <kbd>K</kbd>      | Same  | <Ui k="binDesigner.cutouts.addKnifeSlot" /> tool                                                         |
| <kbd>T</kbd>      | Same  | <Ui k="binDesigner.cutouts.addText" /> tool                                                              |
| <kbd>M</kbd>      | Same  | <Ui k="binDesigner.cutouts.rulerTool" /> tool                                                            |
| <kbd>I</kbd>      | Same  | <Ui k="binDesigner.cutouts.importSvg" />                                                                 |
| <kbd>J</kbd>      | Same  | <Ui k="binDesigner.cutouts.importStl" />                                                                 |

### Cutout editor edits

| Windows and Linux                                 | macOS                                        | Action                                                                                    |
| ------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>A</kbd>                      | <kbd>Cmd</kbd>+<kbd>A</kbd>                  | Select all cutouts                                                                        |
| <kbd>Ctrl</kbd>+<kbd>C</kbd>                      | <kbd>Cmd</kbd>+<kbd>C</kbd>                  | Copy the selected cutouts                                                                 |
| <kbd>Ctrl</kbd>+<kbd>V</kbd>                      | <kbd>Cmd</kbd>+<kbd>V</kbd>                  | Paste. If you copied no cutout, an image on the clipboard opens as a photo to trace.      |
| <kbd>Ctrl</kbd>+<kbd>D</kbd>                      | <kbd>Cmd</kbd>+<kbd>D</kbd>                  | Duplicate the selected cutouts                                                            |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd>     | <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> | Make a repeat from one selected cutout, or collapse a pattern of copies into one repeat   |
| <kbd>Ctrl</kbd>+<kbd>G</kbd>                      | <kbd>Cmd</kbd>+<kbd>G</kbd>                  | Group the selected cutouts. Select two or more.                                           |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>     | <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd> | Ungroup the selected cutouts                                                              |
| <kbd>Ctrl</kbd>+<kbd>L</kbd>                      | <kbd>Cmd</kbd>+<kbd>L</kbd>                  | Lock or unlock the selected cutouts                                                       |
| <kbd>Shift</kbd>+<kbd>H</kbd>                     | Same                                         | Flip the selection from left to right                                                     |
| <kbd>Shift</kbd>+<kbd>V</kbd>                     | Same                                         | Flip the selection from front to back                                                     |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd>         | Same                                         | Delete the selected cutouts                                                               |
| Arrow keys                                        | Same                                         | Move the selected cutouts 0.5 mm                                                          |
| <kbd>Shift</kbd>+arrow key                        | Same                                         | Move the selected cutouts 5 mm                                                            |
| <kbd>Tab</kbd> or <kbd>Shift</kbd>+<kbd>Tab</kbd> | Same                                         | Select the next or the previous cutout                                                    |
| <kbd>Escape</kbd>                                 | Same                                         | Cancel the current drag. Press again to step out of a group, then to clear the selection. |
| <kbd>Ctrl</kbd>+<kbd>0</kbd>                      | <kbd>Cmd</kbd>+<kbd>0</kbd>                  | Fit the board to the view                                                                 |
| Hold <kbd>Space</kbd> and drag                    | Same                                         | Pan the view                                                                              |

### Cutout editor: paths and the mouse

| Windows and Linux                                   | macOS                                 | Action                                 |
| --------------------------------------------------- | ------------------------------------- | -------------------------------------- |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> while you draw a path  | <kbd>Cmd</kbd>+<kbd>Z</kbd>           | Remove the last point                  |
| <kbd>Escape</kbd> while you draw a path             | Same                                  | Cancel the path                        |
| <kbd>Delete</kbd> while you edit points             | Same                                  | Delete the selected point              |
| <kbd>Escape</kbd> while you edit points             | Same                                  | Stop the point edit                    |
| <kbd>Alt</kbd>+drag a curve handle                  | <kbd>Option</kbd>+drag a curve handle | Move one handle without the other      |
| <kbd>Shift</kbd>+drag on an empty part of the board | Same                                  | Measure a distance                     |
| Hold <kbd>Shift</kbd> while you draw a shape        | Same                                  | Keep the width and the depth equal     |
| Hold <kbd>Alt</kbd> while you draw a shape          | Hold <kbd>Option</kbd>                | Draw out from the center               |
| Hold <kbd>Shift</kbd> while you drag                | Same                                  | Move along one axis only               |
| Hold <kbd>Shift</kbd> while you rotate              | Same                                  | Turn in 15 degree steps                |
| <kbd>Alt</kbd>+drag a cutout                        | <kbd>Option</kbd>+drag a cutout       | Duplicate the cutout and move the copy |

### Bento canvas

These keys work on the <Ui k="binDesigner.interior.bento.title" /> canvas, where you draw compartments of any size.

| Windows and Linux                         | macOS                       | Action                                                                                 |
| ----------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------- |
| Arrow keys                                | Same                        | Move the selected compartment one cell                                                 |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | Same                        | Delete the selected compartment                                                        |
| <kbd>Escape</kbd>                         | Same                        | Cancel the current drag. Press again to clear the selection, then to close the canvas. |
| <kbd>Ctrl</kbd>+<kbd>0</kbd>              | <kbd>Cmd</kbd>+<kbd>0</kbd> | Fit the canvas to the view                                                             |
| Hold <kbd>Space</kbd> and drag            | Same                        | Pan the view                                                                           |

### Workshop builds

These keys work in a build that you start with <Ui k="binDesigner.newWorkshop" /> in <Ui k="binDesigner.savedDesigns" />.

| Windows and Linux                         | macOS                       | Action                                                                      |
| ----------------------------------------- | --------------------------- | --------------------------------------------------------------------------- |
| <kbd>1</kbd> to <kbd>4</kbd>              | Same                        | Front, side, top and isometric views                                        |
| <kbd>P</kbd>                              | Same                        | Change between perspective and orthographic                                 |
| <kbd>R</kbd>                              | Same                        | Turn the selected parts 90 degrees                                          |
| Arrow keys                                | Same                        | Move the selected parts one snap step, in the direction that the view faces |
| <kbd>Alt</kbd>+arrow key                  | <kbd>Option</kbd>+arrow key | Move the selected parts 0.1 mm                                              |
| Hold <kbd>Alt</kbd> while you drag        | Hold <kbd>Option</kbd>      | Use a finer snap                                                            |
| <kbd>Ctrl</kbd>+<kbd>A</kbd>              | <kbd>Cmd</kbd>+<kbd>A</kbd> | Select all parts                                                            |
| <kbd>Ctrl</kbd>+<kbd>C</kbd>              | <kbd>Cmd</kbd>+<kbd>C</kbd> | Copy the selected parts                                                     |
| <kbd>Ctrl</kbd>+<kbd>V</kbd>              | <kbd>Cmd</kbd>+<kbd>V</kbd> | Paste under the pointer, or next to the original part                       |
| <kbd>Ctrl</kbd>+<kbd>D</kbd>              | <kbd>Cmd</kbd>+<kbd>D</kbd> | Duplicate the selected parts                                                |
| <kbd>Delete</kbd> or <kbd>Backspace</kbd> | Same                        | Delete the selected parts                                                   |
| <kbd>Escape</kbd>                         | Same                        | Cancel a part that you are about to place, or clear the selection           |

## Baseplate generator

| Windows and Linux | macOS | Action                                      |
| ----------------- | ----- | ------------------------------------------- |
| <kbd>X</kbd>      | Same  | Turn the X-ray view on or off               |
| <kbd>P</kbd>      | Same  | Change between perspective and orthographic |

## Next steps

- [Keyboard and command palette](../settings/keyboard-and-command-palette): find the commands that have no key of their own.
- [Place and edit bins](../layouts/placing-bins): learn what each bin edit does on the grid.
- [Arrange cutouts](../cutouts/arranging): group, repeat and align cutouts in the cutout editor.
- [Work with several bins](../layouts/multi-select): select many bins and change them at the same time.
