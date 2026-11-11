---
title: Layouts, layers and the stash
description: 'See how a layout holds one drawer, how layers stack bins, and what the stash keeps.'
sources:
  - src/core/types/layout.ts
  - src/core/constants.ts
  - src/shared/utils/restingStack.ts
  - src/core/store/layout/drawerActions.ts
  - src/features/staging/
  - src/features/layers/
  - src/shared/hooks/useExplodedLayerView.ts
  - src/features/grid-editor/components/Grid/IsometricPreview/IsometricPreviewControls.tsx
---

# Layouts, layers and the stash

In the Gridfinity Layout Tool, a layout is the plan for one drawer. It holds the bins in layers, and it has a stash for bins that are not on the grid. This page explains how they work together. Use it to predict where a bin goes when you delete a layer or make the drawer smaller.

## A layout is one drawer

Each layout holds everything about one drawer:

- the drawer size: width and depth in grid units, and the height
- the grid unit, the height unit and the print bed size
- the categories that color the bins
- the layers and the bins on them, and the bins in the stash
- the baseplate settings for that drawer

The drawer can be from 0.5 to 50 grid units on each side. A layout has 1 to 10 layers and 1 to 20 categories. Your library can hold up to 500 layouts, and the Layout Tool saves each one separately.

The drawer height cannot go below the tallest stack of bins. To make the drawer lower, make the bins lower first.

## Layers are the order of the stack

Layers set the order in which bins stack. They do not set a fixed height. Each bin rests on the tallest bin from a lower layer under it, or on the floor of the drawer when nothing is under it.

The rules that follow come from that idea:

- Bins on the same layer cannot overlap.
- Bins on different layers can overlap. The upper bin rests on the lower bin.
- A layer's height is only the start height for bins that you add to it.
- A bin that rests above the floor shows a badge with its height above the plate.
- When a stack becomes taller than the drawer, the Layout Tool shows a warning.

Layer 1 is the bottom layer. The layer list shows the top layer first and Layer 1 last.

Some items stick up above their bin. Set <Ui k="inspector.clearanceMmLabel" /> on that bin to keep space free above it. The grid shows the space above as a striped area, and a bin on a higher layer cannot rest in it.

<Screenshot id="concepts-layouts-layer-stack" alt="A layout with two layers in the 3D preview, with a small bin that rests on a larger bin below it." spec="Layout editor, desktop. Drawer 6 × 4. Layer 1: one 3 × 2 bin, 3u. Layer 2: one 2 × 1 bin placed over the Layer 1 bin. 3D preview open in All mode. Crop to the layer list and the 3D preview so the rests-on badge and both layers are visible." />

## The stash holds bins that are off the grid

The <Ui k="staging.stash" /> is the panel under the grid. A bin in the stash belongs to the layout but is not on any layer. It keeps its size and height, so you can put it back on the grid later.

Bins go into the stash in these ways:

| What you do                                            | What happens                                      |
| ------------------------------------------------------ | ------------------------------------------------- |
| Drag a bin onto the stash                              | The bin moves to the stash                        |
| Shift+click a size in <Ui k="layers.sizeSelector" />   | A bin of that size goes to the stash              |
| Delete a layer                                         | All bins on that layer move to the stash          |
| Use <Ui k="layers.clearLayerLabel" />                  | All bins on the layer move to the stash           |
| Make the drawer smaller                                | Bins that no longer fit move to the stash         |
| Turn off half-grid mode and accept the move            | Bins with half-unit sizes or positions move there |
| Place a saved design when the layout has no free space | The linked bin goes to the stash                  |

To use a stashed bin, drag it from the stash onto the grid. Press <kbd>R</kbd> to turn a stashed bin before you place it.

::: warning
Use <Ui k="staging.clearAll" /> only when you want to delete every bin in the stash. You cannot undo it.
:::

## See the layers in 3D

The 3D preview of the layout has three layer modes:

| Mode                  | What the preview shows                   |
| --------------------- | ---------------------------------------- |
| <Ui k="grid.focus" /> | Only the active layer                    |
| <Ui k="grid.stack" /> | The active layer and the layers below it |
| <Ui k="grid.all" />   | All layers                               |

<Ui k="grid.explodedView.label" /> pulls the layers apart vertically, so you can see each layer with the bins on it. The other layers dim so the active layer stands out. Exploded view needs more than one layer and shows all layers. Press <kbd>E</kbd> to turn it on or off while the preview is open.

<Screenshot id="concepts-layouts-exploded" alt="The 3D layout preview in exploded view, with three layers apart from each other." spec="Layout editor, desktop. Drawer 6 × 4 with three layers, each with two or three bins. 3D preview expanded, Explode on, Layer 2 active. Crop to the preview and its mode buttons." />

## Next steps

- [Work in layers](../layouts/layers): add, rename and reorder layers, and move bins between them
- [Place and edit bins](../layouts/placing-bins): draw, move and resize bins on the grid
- [Set up the drawer](../layouts/drawer-setup): set the drawer size and shape
- [Saved designs and linked bins](./saved-designs): connect a bin in a layout to a design from the bin designer
