---
title: Work in layers
description: 'Add and order layers, stack bins on bins, use spacers, and view the layers in 3D.'
sources:
  - src/features/layers/
  - src/shared/utils/restingStack.ts
  - src/features/bin-inspector/components/Inspector/SingleBinInspector/SingleBinInspector.tsx
  - src/features/grid-editor/components/Grid/IsometricPreview/IsometricPreviewControls.tsx
  - src/features/grid-editor/components/Grid/GridCanvas/GridCanvas.tsx
  - src/shared/hooks/use3DPreviewKeyboard.ts
  - src/features/bin-designer/components/panel/BaseSection/BodyTypeTiles.tsx
  - src/core/cqrs/v2/domain/layer/reorderLayers.ts
  - src/shared/utils/validationPlacement.ts
---

# Work in layers

A deep drawer has room for more than one level of bins. In the Gridfinity Layout Tool, each level is a **layer**. Bins on a higher layer sit on the bins below them, as they do in the real drawer. Here's how to add layers, stack bins, and check your stacks in 3D before you print.

## How layers work

The first layer is the bottom of the drawer. The <Ui k="common.layers" /> panel lists the top layer first.

A layer sets the order of the stack, not a fixed height. Each bin rests on the tallest bin under it on a lower layer. With no bin under it, it rests on the baseplate. So a tall bin lifts the bins above it, and a short bin lets them sit lower.

The height of a layer is only the height that new bins on that layer get. A change to it doesn't move or resize the bins that are already there.

Only the tallest stack must fit in the drawer. The <Ui k="layers.tallestStack" /> bar in the <Ui k="common.layers" /> panel compares it with the drawer height. See [Set up the drawer](./drawer-setup#check-the-drawer-height). For the height of one bin with its lip and lid, see [Read the assembled height](../designer/stacking#read-the-assembled-height).

## Add, rename and order layers

<Screenshot id="layouts-layers-panel" alt="The Layers panel with three layers, the active layer marked, and the Tallest stack bar below the list." spec="Layout editor on desktop, left panel open. Layout with a 5 by 4 drawer, drawer height 84 mm, and three layers that each hold two or three bins. Layer 2 active. Crop to the Layers group, from its title to the fill statistics line." />

- To add a layer, click <Ui k="layers.addNewLayer" /> (the plus button) in the <Ui k="common.layers" /> panel. The new layer goes on top. A layout can have 10 layers.
- To rename a layer, click its name, type a new name and press <kbd>Enter</kbd>.
- To change the height for new bins, use the stepper on the layer row.
- To change the order, drag a layer row up or down. The Layout Tool stops a new order that makes a stack taller than the drawer.
- To delete a layer, click the delete button on its row (<Ui k="layers.deleteTooltip" />). Its bins move to the stash, so you keep them. A layout always keeps one layer.

New layers get their height from <Ui k="settings.defaultLayerHeight" /> in <Ui k="settings.tabs.defaults" />.

::: warning
Do not use the clear button under the size brush to stash bins. It deletes every bin on the active layer, and only undo brings them back. To keep the bins, move them to the stash: see [Delete and undo](./placing-bins#delete-and-undo).
:::

## Change the active layer

You draw and edit bins on the active layer only. To change it, click a layer row, or press <kbd>W</kbd> for the layer above and <kbd>S</kbd> for the layer below. With two or more layers, the toolbar above the grid shows the name and height of the active layer.

When you change the layer, the Layout Tool clears the selection. To move bins to a different layer, select them and use <Ui k="selectionToolbar.moveToLayer" />. See [Work with several bins](./multi-select).

## Stack bins on bins

Draw or drop a bin on an upper layer, over bins on a lower layer. The bin then rests on the tallest bin under it.

A bin that rests on another bin shows a small tag on the grid, for example "on 6u". If part of its base has nothing under it, a warning icon shows next to the tag. The inspector shows the same facts: the height that the bin rests at, and <Ui k="inspector.unevenSupport" />.

### Reserve space above a bin

Some things stand taller than their bin, like scissor handles. Set <Ui k="inspector.clearanceMmLabel" /> in the inspector to keep space free above the bin. The clearance doesn't make the printed bin taller.

On the layers above, striped cells mark the clearance, and no bin can rest there. Click a striped zone to jump to the bin that reserves it.

## Make short bins finish flush with spacers

Want a short bin to sit level with its tall neighbors? Put a spacer under it. A **spacer** is an open frame with feet and no floor.

1. In the bin designer, open the <Ui k="binDesigner.group.base" /> group.
2. Under <Ui k="binDesigner.base.bodyType" />, choose <Ui k="binDesigner.spacer" />.
3. Set the height of the spacer. The bin designer saves the design for you.
4. In the layout editor, put the spacer on the lower layer.
5. Put the short bin on the layer above, over the spacer.

A spacer counts like a bin of the same height. For example, a 2u spacer under a 2u bin reaches the top of a 4u bin. At the standard 7 mm height unit, a spacer can be 1u tall. See [Pick a body type](../designer/size-and-shape#pick-a-body-type).

## See the layers

With two or more layers, these views help you check the stacks.

On the grid, turn on <Ui k="toolbar.showLayersBelow" /> in the toolbar. The bins of the lower layers then show as faint shapes under the active layer.

In the 3D preview (open it with <Ui k="toolbar.3dView" />), three buttons pick the layers to show:

| Button                | What the preview shows                   |
| --------------------- | ---------------------------------------- |
| <Ui k="grid.focus" /> | The active layer only                    |
| <Ui k="grid.stack" /> | The active layer and the layers below it |
| <Ui k="grid.all" />   | All the layers                           |

To look between the layers, turn on <Ui k="grid.explodedView.label" /> or press <kbd>E</kbd>. It lifts each layer apart. The exploded view shows all the layers, and it works on a computer screen only.

<Screenshot id="layouts-layers-exploded" alt="The expanded 3D preview shows three layers of bins stacked in the drawer. A press of E lifts the layers apart, each with its name." spec="Clip. Layout editor on desktop with the 3D preview expanded (Space) and All selected. Same three-layer layout as the Layers panel shot, with the middle layer active. Zoom out so the exploded stack fits, then press E on camera with a keycap. Isometric angle where every layer and its label is visible. Crop to the preview." />

## When it goes wrong

### A layer won't move up or down

Make room in the drawer first, then drag the row again. Lower the tallest bins, or raise <Ui k="sidebar.drawerHeight" /> if your real drawer has the room.

The Layout Tool stops a new order that would push a stack past the drawer top. It also stops an order that would rest a bin in space that another bin reserves. The row goes back to its place, and an error message shows.

### A bin won't go on the upper layer

Read the red tag over the bin while you drag it. <Ui k="grid.exceedsDrawerHeight" /> means the bin would stand above the drawer top. It rests on the tallest bin under any part of it, so one tall bin below is enough. Use a shorter bin, or move it over shorter bins.

A tag that names a bin on a lower layer means the striped cells are clearance. That bin keeps the space free for its items. Click a striped cell to jump to that bin, and lower its <Ui k="inspector.clearanceMmLabel" /> if its items don't need the space.

### A warning icon shows next to the height tag

Move the bin so that its whole base sits on bins of one height. Or fill the gap under it with a [spacer](#make-short-bins-finish-flush-with-spacers).

The bin leans on a taller neighbor, or part of it hangs over an empty cell, so it can rock in the drawer. The inspector shows <Ui k="inspector.unevenSupport" /> for the same bin.

## Next steps

- [Set up the drawer](./drawer-setup): measure the drawer height for an exact check.
- [Layouts, layers and the stash](../concepts/layouts-layers-stash): the ideas behind layers.
- [Stacking](../designer/stacking): the stacking lip and how bins sit on each other.
- [Size and shape](../designer/size-and-shape#pick-a-body-type): spacers and the other body types.
