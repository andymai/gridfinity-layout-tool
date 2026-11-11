---
title: Special bins
description: 'Make a knife block, a slanted bin, a bin with a sliding tray, or another special bin type.'
sources:
  - src/features/bin-designer/types/knifeBlock.ts
  - src/features/bin-designer/components/panel/KnifeRestSection/
  - src/features/bin-designer/types/slide.ts
  - src/features/bin-designer/components/panel/SlideTraySection/
  - src/core/labs/features.ts
  - src/features/bin-designer/components/panel/SlantSection/
  - src/shared/utils/slantPlan.ts
  - src/features/bin-designer/components/panel/BaseSection/bodyType.ts
---

# Special bins

Most bins are a box with compartments. The Gridfinity Layout Tool also makes knife blocks, slanted bins and bins with a sliding tray. This page shows how to make each one, and lists the other bin types in the bin designer.

## Make a knife block

A knife block holds kitchen knives flat. Each blade hangs in its own slot, and a handle rest carries the handles at the right height, so the edge never touches the plastic.

1. In the bin designer, select <Ui k="binDesigner.category.interior" /> and pick <Ui k="binDesigner.interior.solid.title" />.
2. Click <Ui k="binDesigner.editCutouts" /> to open the cutout editor. [Draw a cutout](../cutouts/basics#draw-a-cutout) explains the board and its tools.
3. Pick the <Ui k="binDesigner.cutouts.addKnifeSlot" /> tool (<kbd>K</kbd>) and place a slot on the board.
4. In the <Ui k="binDesigner.cutouts.section.knife" /> section, pick a <Ui k="binDesigner.cutouts.knifePreset" />, for example <Ui k="binDesigner.cutouts.knifePreset.santoku7" />. You can also type the measurements of your own knife.
5. Set <Ui k="binDesigner.cutouts.knifeOpenEnd" /> to the end where the handle comes out.
6. Add one slot for each knife.

The Layout Tool sizes each slot from the knife:

| Knife measurement                                            | Slot size                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| <Ui k="binDesigner.cutouts.knifeBladeLength" /> length       | Slot length: blade plus 10 mm, so the tip never touches the closed end   |
| <Ui k="binDesigner.cutouts.knifeSpineThickness" /> thickness | Slot width: spine plus 1.5 mm, at least 2.8 mm                           |
| <Ui k="binDesigner.cutouts.knifeHeelHeight" /> height        | Slot depth: heel plus 4 mm, so the edge floats 4 mm above the slot floor |

A knife slot turns only in quarter turns, so it always lines up with a wall. If the bin is too short for the blade, the panel says how many height units the bin needs.

<Screenshot id="designer-special-bins-knife-block" alt="A knife block with three knife slots and a separate handle rest, shown beside the Knife section of the cutout editor." spec="Open the Knife Block example from the gallery. Cut editor open, one knife slot selected so the Knife section with Preset, Blade, Heel, Spine and Handle side shows. Crop to the board and the Knife section." />

### Add a handle rest

Back on the <Ui k="binDesigner.category.interior" /> page, turn on <Ui k="binDesigner.knifeRest.title" />. It needs at least one knife slot with an open end.

| <Ui k="binDesigner.knifeRest.style" />            | What you get                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.knifeRest.style.companion" />  | A separate part with its own Gridfinity foot. It stands past the open end of the block, 21 mm away by default. |
| <Ui k="binDesigner.knifeRest.style.integrated" /> | The rear part of the block drops to rest height, so the whole knife holder prints as one part.                 |

<Ui k="binDesigner.knifeRest.grooveDepth" /> sets how far each handle sinks into its saddle. A deeper groove holds the knives better and makes the rest taller. For a companion rest, <Ui k="binDesigner.knifeRest.gap" /> and <Ui k="binDesigner.knifeRest.depth" /> set the space to the block and the size of the rest.

The gallery has a [knife block example](./save-and-reuse#start-from-an-example) to start from.

## Make a slanted bin

A slanted bin leans toward one side, while its base stays flat on the grid. Tall items such as pens then fit a shallow drawer. <Ui k="binDesigner.slant.title" /> carries an <Ui k="settings.experimental" /> label.

1. Select <Ui k="binDesigner.category.shape" /> in the panel.
2. Turn on <Ui k="binDesigner.slant.title" />. The bin leans 45° toward the back.
3. Set the <Ui k="binDesigner.slant.angle" />, from 1° to 60°.
4. Under <Ui k="binDesigner.slant.side" />, pick the side the bin leans toward.

The panel shows how far the top reaches past the base, and the longest straight item that fits. Past 45°, the leaning wall prints as an overhang with no support, and the walls get thinner across the slope.

Bins in a row lean on each other. The last bin in a row needs something to rest on: turn on <Ui k="binDesigner.slant.endSupport" /> to add a wedge. The wedge exports as a second part.

A slanted bin has no [stacking lip](./stacking) and no lid, and the Layout Tool cannot split it. If it is too large for your print bed, lower the angle or make the bin smaller. Some features do not work with a slant, for example an overhang, a custom shape, removable dividers or a pull tab. The panel names the feature that blocks the slant.

<Screenshot id="designer-special-bins-slant" alt="A bin that leans toward the back, with the Slant section showing the angle, the side picker and the end support switch." spec="Bin designer, 1x2x6 bin, Shape page, Slant on at 30 degrees toward the back, End support on. Preview from the side so the lean and the wedge show. Crop to the Slant section and the preview." />

## Add a sliding tray (Labs)

A sliding tray is a shallow tray that rides on a rail inside or on top of a bin. Small parts ride in the tray, and you push it aside to reach what is under it. The rail runs along the front and back walls, so the tray slides from side to side.

The sliding tray is a Labs feature, so it is off by default. [Turn on a Labs feature](../settings/labs#turn-on-a-labs-feature) shows how to turn it on.

Labs marks the sliding tray as unfinished. The rail and tray shapes can still change, so a saved design with a tray may not open the same way later. See [Labs](../settings/labs).

With the feature on, the <Ui k="binDesigner.category.features" /> page shows a <Ui k="binDesigner.slideTray.title" /> section.

- <Ui k="binDesigner.slideTray.mountAria" />: <Ui k="binDesigner.slideTray.mount.interior" /> drops the tray into this bin, and it slides inside it. <Ui k="binDesigner.slideTray.mount.rim" /> puts the tray above the rim. It can then slide onto a bin beside it that has the same rail.
- <Ui k="binDesigner.slideTray.trayWidth" /> is in grid units, from 0.5 to 16. A tray wider than its bin rides across two railed bins that stand side by side.
- <Ui k="binDesigner.slideTray.railDrop" /> lowers the rail below the rim. If the tray stands above the rim, the panel tells you to increase the drop.
- <Ui k="binDesigner.slideTray.clearance" /> sets the gap between tray and rail. It starts at 0.25 mm.

Click <Ui k="binDesigner.slideTray.fitSample.button" /> for a small test part. It has five rail stubs from 0.15 mm to 0.35 mm of clearance and one tray stub. The first rail that the stub slides in freely gives your clearance.

A sliding tray needs a hollow bin. It is not available on solid bins, slotted bins or custom-shape bins.

## Other bin types

The <Ui k="binDesigner.base.bodyType" /> picker on the <Ui k="binDesigner.category.shape" /> page changes what the whole bin is. [Pick a body type](./size-and-shape#pick-a-body-type) describes the six body types. To lift short bins level with tall bins in a layout, see [Make short bins finish flush with spacers](../layouts/layers#make-short-bins-finish-flush-with-spacers).

Two more kinds of design live in the design library:

- **Imported bin.** In the library, click <Ui k="common.import" /> and drop an STL file. Set the width, depth and height in units, then click <Ui k="binDesigner.importBin.save" />. The units set the space that the bin takes in a layout. The Layout Tool never resizes the mesh.
- **Workshop build.** <Ui k="binDesigner.newWorkshop" /> starts a tool holder built from parts on a Gridfinity base. See [Workshop](../cutouts/workshop).

## Next steps

- [Cutout basics](../cutouts/basics): learn the cutout editor that makes knife slots.
- [Lids](./lids): add a lid, or make an organizer tray that sits on a bin.
- [The base](./base): set the feet, magnets and body type of a bin.
- [Labs](../settings/labs): see the other features in Labs.
