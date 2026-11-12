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
  - src/features/bin-designer/components/DesignImportView/
  - src/features/bin-designer/storage/DesignVersionService.ts
---

# Save and reuse designs

Every bin you design goes into your design library, and it saves as you go. Come back to it later, copy it, make it in other sizes, or drop it into a drawer layout. This page shows how to find a design, keep checkpoints, and move design files in and out.

## Save to the library

You never need to press save. The bin designer keeps the open design in your library, and it saves a change about one second after you stop. To name the design, click its name in the header and type a new one.

To open the library, click the button next to the design name. Its tooltip reads <Ui k="binDesigner.openDesignList" />, and on a wide screen the button reads <Ui k="binDesigner.designs" />. On a phone, tap the design name. The <Ui k="binDesigner.savedDesigns" /> list opens. Click a design to open it, or click <Ui k="binDesigner.newDesign" /> to start a new bin. The current design stays in the library.

Each design has a menu with these actions:

| Action                                                                          | What it does                                                                                      |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.load" />                                                     | Opens the design.                                                                                 |
| <Ui k="binDesigner.placeInLayout.action" />                                     | Adds the design to a layout. See [Place a design in a layout](#place-a-design-in-a-layout).       |
| <Ui k="binDesigner.downloadJSON" />                                             | Saves a design file. See [Download and import a design file](#download-and-import-a-design-file). |
| <Ui k="common.rename" />, <Ui k="common.duplicate" />, <Ui k="common.delete" /> | Rename, copy or delete the design.                                                                |
| <Ui k="binDesigner.tags.editAction" />                                          | See [Organize with tags](#organize-with-tags).                                                    |
| <Ui k="binDesigner.variants.create" />                                          | See [Make one design in several sizes](#make-one-design-in-several-sizes).                        |

The library lives in your browser. Sign in to keep the same designs on every device. See [Accounts and sync](../sharing/accounts-and-sync) and [Saved designs](../concepts/saved-designs).

<Screenshot id="designer-save-and-reuse-library" alt="The Saved designs list with design thumbnails, the tag filter bar and the menu of one design open." spec="Bin designer, Saved designs dialog open with 5 or more designs, two of them tagged. Open the three-dot menu of one design so its actions show. Crop to the dialog." />

## Keep named versions

A **version** is a named checkpoint of one design. Undo history ends when you reload the page, but a version stays until you delete it. Save one before you try a risky change.

1. Click <Ui k="binDesigner.versions.open" /> in the header.
2. Click <Ui k="binDesigner.versions.save" />.
3. Type a name, for example the clearance that you test, and click <Ui k="binDesigner.versions.confirmSave" />.

<Screenshot id="designer-save-and-reuse-versions" alt="Clicking Version history in the header opens the Versions list with two versions, one of them pinned. Save version, the name 0.2 mm clearance and Save add a third version at the top of the list." spec="Bin designer, Battery caddy with two saved versions, First print pinned. Click Version history in the header. In the Versions dialog, click Save version, type a name and click Save." />

To go back to a version, click <Ui k="binDesigner.versions.restore" /> on it. Nothing gets lost: the Layout Tool first saves your current state as an automatic version, and one undo reverses the restore.

Each design holds up to 25 versions. When a design is full, a new version removes the oldest one. Pinned versions stay, so click <Ui k="binDesigner.versions.pin" /> on any version you want to keep for good.

### Branch from a version

<Ui k="binDesigner.versions.branch" /> on a version makes a new, separate design from that checkpoint. Changes to the branch don't change the original. In the library, branches show under the design they came from. If you delete that design, its branches stay.

## Make one design in several sizes

A **variant** is a copy of a design that follows its parent, except for the values that you claim. Say you make one bin for a set of drill bits. A variant can then change the width or the cutout size. When you improve the parent, each variant gets the change.

1. In the library, open the menu of the parent design and click <Ui k="binDesigner.variants.create" />.
2. In the variant, click <Ui k="binDesigner.variants.claim" /> next to each value that must differ, and set it.

<Screenshot id="designer-save-and-reuse-create-variant" alt="In the Saved designs list, the menu of Drill bit holder opens and Create variant makes a variant. The variant opens with the Variant section at the top of the panel, and each bin dimension shows its value from the parent and a Claim button." spec="Bin designer, Saved designs dialog with Drill bit holder and four other designs. Open the menu of Drill bit holder and click Create variant. Then show the Variant section at the top of the panel." />

| Part        | Values a variant can claim                                                                                                                                                                  |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The bin     | <Ui k="binDesigner.variants.field.width" />, <Ui k="binDesigner.variants.field.depth" />, <Ui k="binDesigner.variants.field.height" />, <Ui k="binDesigner.variants.field.wallThickness" /> |
| Each cutout | The size, <Ui k="binDesigner.variants.field.cutDepth" />, <Ui k="binDesigner.variants.field.clearance" />, <Ui k="binDesigner.variants.field.chamferWidth" />                               |

A cutout keeps the position that the parent gives it. A variant locks all other controls. <Ui k="binDesigner.variants.release" /> gives a value back to the parent. <Ui k="binDesigner.variants.detach" /> makes the variant a normal design that you can edit freely. A variant can't have variants of its own.

<Screenshot id="designer-save-and-reuse-variant" alt="The variant panel with the bin width claimed and the other dimensions shown as values from the parent." spec="Bin designer, open a variant of a cutout bin with Width claimed. Crop to the variant section at the top of the panel, with the Claim buttons, the inherited values and Detach from parent." />

## Organize with tags

**Tags** group designs in the library, for example by drawer or by room. Tags sync with your account.

- Click <Ui k="binDesigner.tags.editAction" /> in the menu of a design. A design holds up to 12 tags of up to 32 characters.
- Click a tag in the filter bar to show only the designs that carry it.
- To tag many designs at once, click <Ui k="binDesigner.select" />, pick the designs, and click <Ui k="binDesigner.bulk.tag" />.
- <Ui k="binDesigner.tagManager.menuItem" />, in the <Ui k="binDesigner.moreOptions" /> menu, gives each tag an icon and a color.

## Start from an example

Don't want to start from a blank bin? At the top of the bin designer panel, click <Ui k="binExamples.sidebarEntry" />. The gallery has two tabs:

- <Ui k="binExamples.gallery.tabs.examples" /> holds ready-made designs that show what the bin designer can do, such as lids, scoops and a knife block.
- <Ui k="binExamples.gallery.tabs.community" /> holds bins that other makers share. See [Community designs](../sharing/community).

To use an example:

1. In the <Ui k="binExamples.gallery.tabs.examples" /> tab, filter by technique or search by name.
2. Click an example to turn it around in a 3D view.
3. Click <Ui k="binExamples.useAsNewDesign" />. The example becomes a new saved design that you can edit.

<Screenshot id="designer-save-and-reuse-examples" alt="Clicking Community designs opens the gallery on its Community tab, and Examples changes to the examples. A search for honeycomb finds the Honeycomb Caddy example. Its card opens a 3D view that turns with a drag, and Use as new design opens the caddy in the bin designer." spec="Bin designer, community API left unanswered so its tab shows the loading state. Click Community designs at the top of the panel, then the Examples tab. Search for honeycomb and click the Honeycomb Caddy. Turn the 3D view, click Use as new design, then show the new bin." />

## Download and import a design file

A **design file** is a small JSON file that holds every setting of a design. It isn't a printable model. Use it to keep a backup, to edit a design by hand, or to give a design to someone else.

- In the export dialog, click <Ui k="binDesigner.downloadDesignJson" />.
- In the library, click <Ui k="binDesigner.downloadJSON" /> in the menu of a design. To download many designs, click <Ui k="binDesigner.select" />, pick the designs, and click <Ui k="binDesigner.bulk.export" />.

To import a design file:

1. In the library, click <Ui k="common.import" />.
2. Drop the file on the drop zone, or paste the JSON text in the box.
3. Look at the preview, then click <Ui k="binDesigner.importAndLoad" />.

The same drop zone takes an STL file and imports it as a bin. See [Special bins](./special-bins#other-bin-types). For every field in the file, see [Design file](../reference/design-file).

## Place a design in a layout

In the library, open the menu of the design and click <Ui k="binDesigner.placeInLayout.action" />.

The layout editor opens and adds the bin as a linked bin. The bin goes to the first free spot on the active layer, turned if it fits only that way. If the layer has no room, the bin goes to the stash (the holding area off the grid). Drag it to the place you want.

<Screenshot id="designer-save-and-reuse-place-in-layout" alt="In the Saved designs list, the menu of Battery caddy opens and Place in layout is clicked. The layout editor opens with Battery caddy placed and selected in the first free spot of the drawer." spec="Bin designer, a layout named Desk drawer with free space, and a library with Battery caddy. Open the menu of Battery caddy and click Place in layout. Then show the drawer grid with the placed bin." />

From then on, the bin follows the design. When you change the design, the linked bin in the layout changes too. To give a design to a bin that is already on the grid, see [Place and edit bins](../layouts/placing-bins#drop-a-saved-design-into-the-drawer).

## When it goes wrong

### An old version is gone

Click <Ui k="binDesigner.versions.pin" /> on each version that you want to keep for good. A pinned version stays when the design is full.

Each design holds up to 25 versions. When you save one more, the Layout Tool removes an automatic version first, then the oldest version without a pin. A message names the version that it removes.

### You can't change a value in a variant

Click <Ui k="binDesigner.variants.claim" /> next to the value, then change it. To edit everything, click <Ui k="binDesigner.variants.detach" />.

A variant takes all its other values from its parent. It can claim only the values in [the table above](#make-one-design-in-several-sizes).

### A design file won't import

Read the error under the box. Is the file a layout file? Import it in the layout manager instead: see [Import a layout file](../reference/layout-file#import-a-layout-file).

The import checks the file type and the main fields before it shows a preview. For a file that you edited by hand, see [Avoid the traps](../reference/design-file#avoid-the-traps).

## Next steps

- [Saved designs and linked bins](../concepts/saved-designs): learn how designs and linked bins work together.
- [Place and edit bins](../layouts/placing-bins): arrange linked bins in a drawer.
- [Accounts and sync](../sharing/accounts-and-sync): keep your library on every device.
- [Bin design file format](../reference/design-file): read and edit the JSON design format.
