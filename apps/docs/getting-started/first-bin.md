---
title: Design your first bin
description: 'Set the size of a bin, add compartments and a label tab, and export a print file.'
sources:
  - src/features/bin-designer/hooks/useDesignerFirstRun.ts
  - src/features/bin-designer/hooks/useDesignerInit.ts
  - src/features/bin-designer/components/DesignerPage/
  - src/features/bin-designer/components/panel/DimensionsSection/
  - src/features/bin-designer/components/CompartmentEditor/CompartmentEditor.tsx
  - src/features/bin-designer/components/panel/LabelTabsSection/
  - src/features/bin-designer/components/ExportDialog/
---

# Design your first bin

Let's make a bin for screws, from a blank design to a file in your slicer. You'll set its size, split it into compartments, add a label tab so you know what's inside, and export it.

You can follow along with a new design, or with the design that you made from a bin in the layout editor.

## Step 1: Open the bin designer

Click <Ui k="toolSwitcher.binDesigner" /> in the tool switcher at the top left. You can also open the [bin designer](https://gridfinitylayouttool.com/designer) directly, or press <kbd>Shift</kbd>+<kbd>D</kbd> in the layout editor.

On your first visit, a card titled <Ui k="binDesigner.quickstart.title" /> explains how the bin designer works. Click <Ui k="binDesigner.quickstart.dismiss" /> to close it, or make a change and it closes by itself. On a phone, the card does not show.

A new design starts as a bin that is 2 grid units wide, 2 grid units deep and 3 height units tall. The settings panel is on the left, and the 3D preview is on the right. The preview updates after each change, so you see what you get as you go.

<Screenshot id="getting-started-first-bin-designer" alt="The bin designer with the settings panel on the left and a 2 by 2 bin in the 3D preview on the right." spec="Bin designer, desktop 1440 px, new design with default values, quickstart card closed. Show the full window with the header, the settings panel and the preview." />

## Step 2: Name the design

The bin designer saves the design in your library, and it saves each change automatically. A name helps you find it later.

1. Click the design name in the header.
2. Type a new name, for example "Screw bin", and press <kbd>Enter</kbd>.

## Step 3: Set the size

The size controls are at the top of the <Ui k="binDesigner.group.shape" /> group, under <Ui k="binDesigner.dimensions" />.

1. Set <Ui k="common.width" /> and <Ui k="common.depth" /> in grid units.
2. Set <Ui k="common.height" /> in height units.

Below the steppers, you see the outside size of the bin in millimeters. The <Ui k="binDesigner.interiorDimensions" /> line shows the room inside. To swap the width and the depth, click the arrow button between the two steppers.

::: tip
A 1 × 1 bin is 42 × 42 mm, and each height unit adds 7 mm. [Gridfinity in five minutes](../introduction/gridfinity-basics) explains the units.
:::

## Step 4: Add compartments

Open the <Ui k="binDesigner.group.interior" /> group. A new design already uses the <Ui k="binDesigner.interior.standard.title" /> card, so you can go straight to the steppers. On another design, click that card first.

1. Set <Ui k="binDesigner.columns" /> to the number of compartments from left to right.
2. Set <Ui k="binDesigner.rows" /> to the number of compartments from front to back.

The bin designer adds walls between the compartments, and a line below the steppers shows the size of each compartment in millimeters. You can use up to 12 columns and 12 rows.

<Screenshot id="getting-started-first-bin-compartments" alt="The interior group with three columns and two rows, and the bin with six compartments in the preview." spec="Bin designer, desktop 1440 px, 3 x 2 bin, 4 height units. In the interior group, set columns to 3 and rows to 2. Show the panel and the preview side by side." />

## Step 5: Add a label tab

A label tab is a small shelf at the back of each compartment. It holds the name of what's inside, so you can read it at a glance.

1. In the <Ui k="binDesigner.group.interior" /> group, turn on <Ui k="binDesigner.labelTabs" />.
2. Under <Ui k="binDesigner.labelText" />, type a name in the field for each compartment, for example "M3" or "M4".

The tab uses the <Ui k="binDesigner.tabMode.text" /> style by default, so the text prints as part of the tab. Want one label across a full row of compartments? Click <Ui k="binDesigner.labelTextPerRow" />.

## Step 6: Export the print file

1. Click <Ui k="common.export" /> (the download icon) in the header.
2. Under <Ui k="export.format" />, pick 3MF, STL or STEP.
3. Look at the name under <Ui k="export.fileName" />, and change it if you like.
4. Click the download button at the bottom of the window.

The window also shows <Ui k="binDesigner.printEstimatesPla" />: the filament, the weight, the print time and the cost of the bin.

| Format | Pick it when                                                  |
| ------ | ------------------------------------------------------------- |
| STL    | Your slicer needs a plain mesh file. This is the default.     |
| 3MF    | You print in more than one color, or your slicer prefers 3MF. |
| STEP   | You want to change the bin in a CAD program.                  |

Not sure? Keep STL.

::: tip
Print this one bin before you print a drawer full. It tells you if the fit and your print settings are right, and a test print costs little.
:::

After your first export, a message says <Ui k="binDesigner.plannerBridge.message" />. Click <Ui k="binDesigner.plannerBridge.action" /> to plan a full drawer with your bins.

## Next steps

- [Plan your first drawer](./first-drawer): place this bin in a drawer layout
- [Compartments and dividers](../designer/compartments): bento layouts, removable dividers and compartments of different sizes
- [Labels and text](../designer/labels-and-text): text styles, swappable label plates and text on the floor
- [File formats](../printing/file-formats): more about STL, 3MF and STEP
