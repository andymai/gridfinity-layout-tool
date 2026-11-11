---
title: Save and reuse designs
description: 'Keep designs in your library, save versions, make variants in other sizes, and place a design in a layout.'
sources:
  - src/features/bin-designer/types/savedDesign.ts
  - src/features/bin-designer/types/designVersion.ts
  - src/features/bin-designer/types/designVariant.ts
  - src/features/bin-designer/hooks/useAutoSave.ts
  - src/features/bin-designer/components/DesignListDialog/
  - src/features/bin-designer/components/VersionHistory/
  - src/features/bin-designer/components/panel/VariantSection/
  - src/features/bin-designer/hooks/usePlaceBinInLayout.ts
---

# Save and reuse designs

Each bin you design goes into your design library, and you can come back to it, copy it, or place it in a drawer. The Gridfinity Layout Tool saves your work as you go. This page shows how to find a design, keep checkpoints, make it in several sizes, and move design files in and out.

## Save to the library

The bin designer always keeps the open design in your library. It saves a change about one second after you stop. To name the design, click its name in the header and type a new one.

To open the library, click <Ui k="binDesigner.designs" /> next to the design name. On a phone, tap the design name. The <Ui k="binDesigner.savedDesigns" /> list opens. From there:

- <Ui k="binDesigner.newDesign" /> starts a new bin. The current design stays in the library.
- Click a design to open it.
- The menu of each design has <Ui k="binDesigner.load" />, <Ui k="binDesigner.placeInLayout.action" />, <Ui k="binDesigner.downloadJSON" />, <Ui k="common.rename" />, <Ui k="binDesigner.tags.editAction" />, <Ui k="common.duplicate" />, <Ui k="binDesigner.variants.create" /> and <Ui k="common.delete" />.

The library lives in your browser. Sign in to keep the same designs on every device. See [Accounts and sync](../sharing/accounts-and-sync) and [Saved designs](../concepts/saved-designs).

<Screenshot id="designer-save-and-reuse-library" alt="The Saved designs list with design thumbnails, the tag filter bar and the menu of one design open." spec="Bin designer, Saved designs dialog open with 5 or more designs, two of them tagged. Open the three-dot menu of one design so its actions show. Crop to the dialog." />

## Keep named versions

A version is a named checkpoint of one design. Undo history ends when you reload the page, but a version stays until you delete it.

1. Click <Ui k="binDesigner.versions.open" /> in the header.
2. Click <Ui k="binDesigner.versions.save" />.
3. Type a name, for example the clearance that you test, and click <Ui k="binDesigner.versions.confirmSave" />.

To go back to a version, click <Ui k="binDesigner.versions.restore" /> on it. The Layout Tool first saves your current state as an automatic version, and one undo reverses the restore.

Each design holds up to 25 versions. When a design is full, a new version removes the oldest version. Pinned versions stay: click <Ui k="binDesigner.versions.pin" /> to keep one.

### Branch from a version

<Ui k="binDesigner.versions.branch" /> on a version makes a new, separate design from that checkpoint. Changes to the branch do not change the original. In the library, branches show under the design they came from. If you delete that design, its branches stay.

## Make one design in several sizes

A variant is a copy of a design that follows its parent, except for the values that you claim. For example, make one bin for a set of drill bits, then a variant with a different width or cutout size. When you improve the parent, each variant gets the change.

1. In the library, open the menu of the parent design.
2. Click <Ui k="binDesigner.variants.create" />.
3. In the variant, click <Ui k="binDesigner.variants.claim" /> next to each value that must differ, and set it.

A variant can claim the bin's <Ui k="binDesigner.variants.field.width" />, <Ui k="binDesigner.variants.field.depth" />, <Ui k="binDesigner.variants.field.height" /> and <Ui k="binDesigner.variants.field.wallThickness" />. For each cutout, it can claim the size, <Ui k="binDesigner.variants.field.cutDepth" />, <Ui k="binDesigner.variants.field.clearance" /> and <Ui k="binDesigner.variants.field.chamferWidth" />. A cutout keeps the position that the parent gives it.

A variant locks all other controls. <Ui k="binDesigner.variants.release" /> gives a value back to the parent. <Ui k="binDesigner.variants.detach" /> makes the variant a normal design that you can edit freely. A variant cannot have variants of its own.

<Screenshot id="designer-save-and-reuse-variant" alt="The variant panel with the bin width claimed and the other dimensions shown as values from the parent." spec="Bin designer, open a variant of a cutout bin with Width claimed. Crop to the variant section at the top of the panel, with the Claim buttons, the inherited values and Detach from parent." />

## Organize with tags

Tags group designs in the library, for example by drawer or by room.

- Click <Ui k="binDesigner.tags.editAction" /> in the menu of a design. A design holds up to 12 tags of up to 32 characters.
- Click a tag in the filter bar to show only the designs that carry it.
- To tag many designs at once, click <Ui k="binDesigner.select" />, pick the designs, and click <Ui k="binDesigner.bulk.tag" />.
- <Ui k="binDesigner.tagManager.menuItem" />, in the <Ui k="binDesigner.moreOptions" /> menu, gives each tag an icon and a color.

Tags sync with your account.

## Start from an example

At the top of the bin designer panel, click <Ui k="binExamples.sidebarEntry" />. The gallery has two tabs. <Ui k="binExamples.gallery.tabs.examples" /> holds ready-made designs that show what the bin designer can do, such as lids, scoops and a knife block. <Ui k="binExamples.gallery.tabs.community" /> holds bins that other makers share.

1. In the <Ui k="binExamples.gallery.tabs.examples" /> tab, filter by technique or search by name.
2. Click an example to turn it in a 3D view.
3. Click <Ui k="binExamples.useAsNewDesign" />. The example becomes a new saved design that you can edit.

See [Community designs](../sharing/community) for the Community tab.

## Download and import a design file

A design file is a small JSON file that holds every setting of a design. It is not a printable model. Use it to keep a backup, to edit a design by hand, or to give a design to someone else.

- In the export dialog, click <Ui k="binDesigner.downloadDesignJson" />.
- In the library, click <Ui k="binDesigner.downloadJSON" /> in the menu of a design. To download many designs, click <Ui k="binDesigner.select" />, pick the designs, and click <Ui k="binDesigner.bulk.export" />.

To import a design file:

1. In the library, click <Ui k="common.import" />.
2. Drop the file on the drop zone, or paste the JSON text in the box.
3. Look at the preview, then click <Ui k="binDesigner.importAndLoad" />.

The same drop zone takes an STL file and imports it as a bin. See [Special bins](./special-bins#other-bin-types). For every field in the file, see [Design file](../reference/design-file).

## Place a design in a layout

1. In the library, open the menu of the design.
2. Click <Ui k="binDesigner.placeInLayout.action" />.

The layout editor opens and adds the bin as a linked bin. The bin goes to the first free spot on the active layer, turned if it fits only that way. If the layer has no room, the bin goes to the stash. Drag it to the place you want. When you change the design later, the linked bin in the layout changes too. To give a design to a bin that is already on the grid, see [Place and edit bins](../layouts/placing-bins#drop-a-saved-design-into-the-drawer).

## Next steps

- [Saved designs and linked bins](../concepts/saved-designs): learn how designs and linked bins work together.
- [Place and edit bins](../layouts/placing-bins): arrange linked bins in a drawer.
- [Accounts and sync](../sharing/accounts-and-sync): keep your library on every device.
- [Bin design file format](../reference/design-file): read and edit the JSON design format.
