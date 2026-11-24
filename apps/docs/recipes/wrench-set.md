---
title: A wrench set in one bin
description: 'Pick the wrench sizes you have, and get a solid bin with a pocket for each wrench, its size beside it and a finger channel.'
questions:
  - 'How do I make a holder for a set of combination wrenches?'
  - 'Can the bin designer make wrench pockets from a list of sizes?'
  - 'How do I change the sizes in a wrench set later?'
sources:
  - src/shared/toolSets/generateToolSet.ts
  - src/shared/toolSets/nestLayout.ts
  - src/shared/toolSets/wrenchOutline.ts
  - src/shared/toolSets/catalog.ts
  - src/features/bin-designer/components/panel/CutoutsSection/toolSets/ToolSetDialog.tsx
  - src/features/bin-designer/components/panel/CutoutsSection/toolSets/useToolSets.ts
  - src/features/bin-designer/components/panel/CutoutsSection/toolSets/planToolSetPlacement.ts
  - src/features/bin-designer/components/CutoutWorkspace/ToolSetEditButton.tsx
---

# A wrench set in one bin

A shadow board for wrenches shows at a glance which size is out of the drawer. In this recipe, you pick the sizes of your combination wrenches, and the bin designer cuts a pocket for each one. The pockets nest head to tail, the size of each wrench sits engraved beside its box end, and one finger channel runs across the handles.

::: warning Experimental
Tool sets are new. The pockets use typical wrench sizes, not your brand's sizes, so print a fit test before the full bin.
:::

## What you need

- Your combination wrenches, metric or SAE. A wrench lies flat in its pocket, so the bin is as long as your longest wrench plus a few millimeters.
- A print bed large enough for that length, or a printer that prints the bin in pieces.

## Step 1: Start a solid bin

1. Open the [bin designer](https://gridfinitylayouttool.com/designer).
2. In the <Ui k="binDesigner.group.interior" /> group, pick <Ui k="binDesigner.interior.solid.title" />.
3. Click <Ui k="binDesigner.editCutouts" />.

You don't need to set the bin size. The set makes the bin grow to fit it.

## Step 2: Pick your sizes

1. In the toolbar on the left of the board, click <Ui k="binDesigner.toolSets.addTitle" /> (the wrench).
2. Pick <Ui k="binDesigner.toolSets.unitsMetric" /> or <Ui k="binDesigner.toolSets.unitsSae" />.
3. Click a set under <Ui k="binDesigner.toolSets.presets" />, or click single sizes to add or remove them.
4. Click <Ui k="binDesigner.toolSets.add" />.

The preview in the window shows the pockets, the sizes and the channel before you add them. The set lands in the bin as one group, and the bin grows to the smallest size that holds it. If the deepest pocket needs a taller bin, the bin grows taller too.

Each pocket has two depths. The box end is thicker than the handle, so its well is deeper. The wrench lies level, with its top flush with the bin's top.

## Step 3: Check the fit

Wrench brands differ. At 13 mm, one brand's wrench is more than 30 mm longer than another's. Each pocket holds the longest wrench in the published sizes of several brands. A shorter wrench can have room at its ends.

1. Click the set to select it, and click <Ui k="binDesigner.cutouts.fitTest.button" />.
2. Print the test, and put your wrench in it.

If a wrench is too tight, open the set again and raise <Ui k="binDesigner.toolSets.clearance" />.

## Change the set later

Click any pocket of the set to select the whole set, then click <Ui k="binDesigner.toolSets.edit" />. Change the sizes or the options, and click <Ui k="binDesigner.toolSets.update" />. The bin designer builds the set again in the same place.

::: tip
An update replaces the changes you made by hand to the set's pockets. To keep a hand-made change, update the set first, then make the change.
:::

You can add a second set to the same bin, for example metric and SAE wrenches side by side. Each set has its own <Ui k="binDesigner.toolSets.edit" />.
