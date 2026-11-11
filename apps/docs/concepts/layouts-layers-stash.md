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
  - src/features/staging/components/Staging/Staging.tsx
---

# Layouts, layers and the stash

A layout is one drawer. Layers decide which bins stack on which, and the stash is a shelf beside the drawer for bins you don't need right now. Once you see how the three fit together, you can tell where a bin goes when you delete a layer or make the drawer smaller.

## A layout is one drawer

Each layout holds everything about one drawer:

- the drawer size: width and depth in grid units, and the height
- the grid unit, the height unit and the print bed size
- the categories that color the bins
- the layers and the bins on them, and the bins in the stash
- the baseplate settings for that drawer

The drawer can be from 0.5 to 50 grid units on each side. A layout has 1 to 10 layers and 1 to 20 categories. Your library can hold up to 500 layouts, and the Layout Tool saves each one separately.

The drawer height can't go below the tallest stack of bins. To make the drawer lower, make the bins lower first.

## Layers are the order of the stack

Think of layers as the order in which you'd stack things, not as shelves at a fixed height. Each bin rests on the tallest bin from a lower layer under it. When nothing is under it, it rests on the floor of the drawer.

A few rules follow from that idea:

- Bins on the same layer can't overlap.
- Bins on different layers can overlap. The upper bin rests on the lower bin.
- A layer's height is only the start height for bins that you add to it.
- A bin that rests above the floor shows a badge with its height above the plate.
- When a stack gets taller than the drawer, the Layout Tool warns you.

Layer 1 is the bottom layer. The layer list puts the top layer first and Layer 1 last, as in a real stack.

Some items stick up above their bin, like a tall screwdriver. Set <Ui k="inspector.clearanceMmLabel" /> on that bin to keep space free above it. The grid shows the space above as a striped area, and a bin on a higher layer can't rest in it.

<Screenshot id="concepts-layouts-layer-stack" alt="A layout with two layers in the 3D preview, with a small bin that rests on a larger bin below it." spec="Layout editor, desktop. Drawer 6 × 4. Layer 1: one 3 × 2 bin, 3u. Layer 2: one 2 × 1 bin placed over the Layer 1 bin. 3D preview open in All mode. Crop to the layer list and the 3D preview so the rests-on badge and both layers are visible." />

## The stash holds bins that are off the grid

The <Ui k="staging.stash" /> is the panel under the grid. A bin in the stash belongs to the layout but sits on no layer. It keeps its size and height, so you can put it back on the grid later.

Bins go into the stash in these ways:

| What you do                                                         | What happens                                      |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| Drag a bin onto the stash                                           | The bin moves to the stash                        |
| Select bins and click <Ui k="inspector.toStash" /> in the inspector | The selected bins move to the stash               |
| <kbd>Shift</kbd>+click a size in <Ui k="layers.sizeSelector" />     | A new bin of that size goes to the stash          |
| Delete a layer                                                      | All bins on that layer move to the stash          |
| Make the drawer smaller                                             | Bins that no longer fit move to the stash         |
| Turn off half-grid mode and accept the move                         | Bins with half-unit sizes or positions move there |
| Place a saved design when the layout has no free space              | The linked bin goes to the stash                  |

To use a stashed bin, drag it from the stash onto the grid. Press <kbd>R</kbd> to turn a stashed bin before you place it. [Put bins in the stash](../layouts/placing-bins#put-bins-in-the-stash) shows the other ways to move bins in and out of the stash.

::: warning
Clear a layer only when you want to delete its bins. The clear button in the active layer panel shows how many bins the layer holds, and it deletes all of them. It doesn't move them to the stash. If you clear a layer by mistake, press <kbd>Ctrl</kbd>+<kbd>Z</kbd> (<kbd>Cmd</kbd>+<kbd>Z</kbd> on a Mac) to get the bins back.
:::

::: warning
Use <Ui k="staging.clearAll" /> only when you want to delete every bin in the stash. If you clear it by mistake, press <kbd>Ctrl</kbd>+<kbd>Z</kbd> (<kbd>Cmd</kbd>+<kbd>Z</kbd> on a Mac) to get the bins back.
:::

## See the layers in 3D

The 3D preview of the layout can show only the active layer, the layers up to the active layer, or all layers. <Ui k="grid.explodedView.label" /> pulls the layers apart vertically, so you can see each layer with the bins on it. [See the layers](../layouts/layers#see-the-layers) shows the buttons and the keys.

<Screenshot id="concepts-layouts-exploded" alt="The expanded 3D layout preview of a drawer with three layers of bins. A click on Explode pulls the layers apart. Layer 2, the active layer, stays highlighted." spec="Clip. Layout editor, drawer 6 × 4 with three layers of two or three bins each, Layer 2 active. 3D preview expanded in All mode. The stacked drawer, a close-up click on Explode, then the layers apart." />

## Next steps

- [Work in layers](../layouts/layers): add, rename and reorder layers, and move bins between them
- [Place and edit bins](../layouts/placing-bins): draw, move and resize bins on the grid
- [Set up the drawer](../layouts/drawer-setup): set the drawer size and shape
- [Saved designs and linked bins](./saved-designs): connect a bin in a layout to a design from the bin designer
