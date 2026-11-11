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

A bin in a layout is a box with a size. A saved design is the full model of a bin from the bin designer, with its walls, compartments, labels and colors. A link connects the two, so one design can fill many places in your drawers. This page explains what a link keeps in step and how versions and variants of one design work.

## The design library

When you save a bin in the bin designer, it goes into your library as a saved design. After that first save, the bin designer saves your changes as you work. Open <Ui k="binDesigner.savedDesigns" /> in the bin designer to see your library.

Your library lives in this browser. Sign in to sync it to your other devices.

## Two ways to link a bin

There are two directions:

- **From the design.** In <Ui k="binDesigner.savedDesigns" />, use <Ui k="binDesigner.placeInLayout.action" />. The layout editor opens and puts a linked bin in the first free space. When there is no free space, the bin goes to the stash.
- **From the layout.** Select a bin and look at <Ui k="designLinking.inspector.linkedDesign" /> in the inspector. <Ui k="designLinking.inspector.createDesign" /> makes a design from the bin and opens it in the bin designer. <Ui k="designLinking.inspector.linkExisting" /> lists the saved designs with the same footprint.

A design also matches a bin that has its width and depth swapped. The layout then shows the design turned 90°.

Many bins can link to one design.

## What a link keeps in step

A link keeps only the size in step: width, depth and height. Everything else belongs to the design, so all linked bins share it.

| You change                                               | What the Layout Tool does                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------- |
| The size of a design, in the bin designer                | The linked bins take the new size                                          |
| The size of a linked bin, in the layout                  | The design takes the new size, and the other linked bins follow            |
| Walls, compartments, labels or colors                    | Every linked bin shows the change, because the model belongs to the design |
| The link, with <Ui k="designLinking.inspector.unlink" /> | The bin keeps its size, and the design stays in your library               |

Sometimes a bin cannot take the new size, because it no longer fits the drawer or it hits another bin. Then <Ui k="designLinking.syncDialog.title" /> opens and tells you how many bins it must unlink. Select <Ui k="designLinking.syncDialog.sync" /> to continue.

Some designs cannot follow a resize from the layout, for example a design with cutouts or custom compartments. The Layout Tool then does not change the design, and a dialog tells you why.

::: tip
A bin with <Ui k="inspector.lockSize" /> on keeps its size. The Layout Tool does not resize it when its design changes.
:::

In the layout editor, the 3D preview shows each linked bin with the model of its design. <Ui k="layoutExport.button" /> exports the model of each linked bin.

## Labels for each bin

Each bin in a layout has its own <Ui k="inspector.binLabel" />. A linked bin can print that label on its label tab:

1. In the bin designer, turn on <Ui k="binDesigner.labelTabs" /> with a single label.
2. Leave the label text empty. The empty box shows <Ui k="binDesigner.labelTextLayoutLabelPlaceholder" />.

Each linked bin then prints its own Bin label. You see the labels in the 3D preview of the layout. <Ui k="layoutExport.button" /> writes one file for each label. Swappable label plates use the labels too.

<Screenshot id="concepts-saved-designs-layout-labels" alt="Three bins linked to one design in the 3D layout preview, each with a different label on its tab." spec="Layout editor, desktop. One saved design, 2 × 1 × 3u, label tabs on with one empty label. Three linked bins in a row with Bin labels Screws, Nuts and Washers. 3D preview open. Crop to the preview so all three tab labels are legible." />

## Versions of one design

<Ui k="binDesigner.versions.open" /> keeps named checkpoints of one design, for example a version with a tight fit. Undo is different: it keeps no names, and it ends when you reload the page.

- <Ui k="binDesigner.versions.save" /> stores the design as it is now, with a name.
- A restore replaces the design. The Layout Tool first saves your current state as an automatic version.
- Each design keeps up to 25 versions. When the list is full, the Layout Tool removes the oldest version and tells you. Pin a version to keep it.
- <Ui k="binDesigner.versions.branch" /> makes a separate design from a version. The branch does not follow the original.

## Variants: one design in several sizes

A variant follows another design, its parent, except for the values that the variant claims. Use a variant when you need the same bin in several sizes. Make one with <Ui k="binDesigner.variants.create" />.

A variant can claim these values:

- the bin width, depth, height and wall thickness
- for each cutout: the width, depth, cut depth, clearance and chamfer

All other values come from the parent. When you change the parent, each variant changes with it. To change a value in the variant, claim that value first. <Ui k="binDesigner.variants.detach" /> makes the variant a separate design that no longer follows the parent.

## Next steps

- [Save and reuse designs](../designer/save-and-reuse): save, rename, duplicate and organize your designs
- [Place and edit bins](../layouts/placing-bins): move and resize bins in the layout
- [Swappable label plates](../designer/label-plates): print labels that you can change later
- [Accounts and sync](../sharing/accounts-and-sync): keep your designs on every device
