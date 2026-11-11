---
title: Saved designs and linked bins
description: 'Learn how a saved design connects to bins in a layout, and how versions and variants work.'
sources:
  - src/features/design-linking/
  - src/features/bin-designer/hooks/usePlaceBinInLayout.ts
  - src/features/bin-designer/storage/
  - src/features/bin-designer/components/VersionHistory/
  - src/features/bin-designer/components/panel/VariantSection/
  - src/features/bin-designer/components/panel/LabelTabsSection/useLabelTabsSection.ts
  - src/shell/layoutExport/planLayoutBinExport.ts
---

# Saved designs and linked bins

Design a bin once, then use it all over your drawers. A bin in a layout is only a box with a size. A **saved design** is the full model from the bin designer, with its walls, compartments, labels and colors. Link the two, and the bin prints from the design.

Think of the design as a master copy. Every bin linked to it prints from it and changes with it. Here's what a link keeps in step, and how versions and variants of one design work.

## The design library

Each bin that you make in the bin designer goes into your library as a saved design. The bin designer saves your changes as you work. Open <Ui k="binDesigner.savedDesigns" /> in the bin designer to see your library.

Your library lives in this browser. Sign in to sync it to your other devices.

## Two ways to link a bin

You can start from either end:

- **From the design.** In <Ui k="binDesigner.savedDesigns" />, use <Ui k="binDesigner.placeInLayout.action" />. The layout editor opens and puts a linked bin in the first free space. When there's no free space, the bin goes to the stash.
- **From the layout.** Select a bin and look at <Ui k="designLinking.inspector.linkedDesign" /> in the inspector. <Ui k="designLinking.inspector.createDesign" /> makes a design from the bin and opens it in the bin designer. <Ui k="designLinking.inspector.linkExisting" /> lists the saved designs with the same footprint.

A design also matches a bin that has its width and depth swapped. The layout then shows the design turned 90°.

Many bins can link to one design. Ten screw bins, one design.

## What a link keeps in step

A link keeps only the size in step: width, depth and height. Everything else belongs to the design, so all linked bins share it.

| You change                                               | What the Layout Tool does                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| The size of a design, in the bin designer                | The linked bins take the new size                                          |
| The size of a linked bin, in the layout                  | The design takes the new size, and the other linked bins follow            |
| Walls, compartments, labels or colors                    | Every linked bin shows the change, because the model belongs to the design |
| The link, with <Ui k="designLinking.inspector.unlink" /> | The bin keeps its size, and the design stays in your library               |

Sometimes a bin can't take the new size, because it no longer fits the drawer or it hits another bin. Then <Ui k="designLinking.syncDialog.title" /> opens and tells you how many bins it must unlink. Select <Ui k="designLinking.syncDialog.sync" /> to continue.

Some designs can't follow a resize from the layout, for example a design with cutouts or custom compartments. The Layout Tool then leaves the design as it is, and a dialog tells you why.

::: tip
Want one bin to keep its size while its design changes? Turn on <Ui k="inspector.lockSize" /> for that bin. The Layout Tool then doesn't resize it when its design changes.
:::

In the layout editor, the 3D preview shows each linked bin with the model of its design. <Ui k="layoutExport.button" /> exports the model of each linked bin.

## Labels for each bin

One design can carry a different label on every bin. Each bin in a layout has its own <Ui k="inspector.binLabel" />, and a linked bin can print that label on its label tab:

1. In the bin designer, turn on <Ui k="binDesigner.labelTabs" /> with a single label.
2. Leave the label text empty. The empty box shows <Ui k="binDesigner.labelTextLayoutLabelPlaceholder" />.

Each linked bin then prints its own Bin label. You see the labels in the 3D preview of the layout. <Ui k="layoutExport.button" /> writes one file for each label. Swappable label plates use the labels too.

<Screenshot id="concepts-saved-designs-layout-labels" alt="Three bins linked to one design in the 3D layout preview, each with a different label on its tab." spec="Layout editor, desktop. One saved design, 2 × 1 × 3u, label tabs on with one empty label. Three linked bins in a row with Bin labels Screws, Nuts and Washers. 3D preview open. Crop to the preview so all three tab labels are legible." />

## Versions of one design

<Ui k="binDesigner.versions.open" /> keeps named checkpoints of one design, for example a version with a tight fit. Save one before you try something bold. Undo is different: it keeps no names, and it ends when you reload the page.

- <Ui k="binDesigner.versions.save" /> stores the design as it is now, with a name.
- A restore replaces the design. First, though, the Layout Tool saves your current state as an automatic version, so you lose nothing.
- Each design keeps up to 25 versions. When the list is full, the Layout Tool removes the oldest version and tells you. Pin a version to keep it.
- <Ui k="binDesigner.versions.branch" /> makes a separate design from a version. The branch doesn't follow the original.

## Variants: one design in several sizes

Need the same bin in a 1 × 1, a 2 × 1 and a 3 × 1? Make variants. A **variant** follows another design, its parent, except for the values that the variant claims. Make one with <Ui k="binDesigner.variants.create" />.

A variant can claim these values:

- the bin width, depth, height and wall thickness
- for each cutout: the width, depth, cut depth, clearance and chamfer

All other values come from the parent. Change the parent, and each variant changes with it. To change a value in the variant, claim that value first. <Ui k="binDesigner.variants.detach" /> makes the variant a separate design that no longer follows the parent.

## When it goes wrong

### Some linked bins kept their old size

Make room around those bins, then give each one the size of the design in the inspector. A linked bin takes the new size only where it has room, and a message tells you how many bins kept their old size. If <Ui k="designLinking.syncDialog.title" /> opens instead, it tells you how many bins it must unlink, because they can't fit.

A bin with <Ui k="inspector.lockSize" /> on keeps its size too. That's what the lock is for.

### The design didn't change when you resized a bin

<Ui k="designLinking.blockedResize.title" /> means the design has cutouts, floor inserts or a custom compartment layout. A new size could break those parts, so the Layout Tool leaves the design as it is. Open the design in the bin designer, and change its size there. The dialog names the parts that stopped the resize.

### The list of designs to link is empty

<Ui k="designLinking.linkDialog.noCompatible" /> means no saved design has the footprint of this bin. Click <Ui k="designLinking.inspector.createDesign" /> to make a design from the bin, or resize the bin to match a design that you have. The list shows only designs with the same width and depth, or with the two swapped. The height can differ.

## Next steps

- [Save and reuse designs](../designer/save-and-reuse): save, rename, duplicate and organize your designs
- [Place and edit bins](../layouts/placing-bins): move and resize bins in the layout
- [Swappable label plates](../designer/label-plates): print labels that you can change later
- [Accounts and sync](../sharing/accounts-and-sync): keep your designs on every device
