---
title: Workshop
description: 'Build a tool holder out of parts on a Gridfinity base, and export a bin top as a flat shadow board.'
sources:
  - src/features/bin-designer/components/Workshop/
  - src/features/bin-designer/components/DesignListDialog/DesignListHeader.tsx
  - src/features/bin-designer/utils/workshopTemplates.ts
  - src/shared/types/assembly.ts
  - src/features/bin-designer/components/CutoutWorkspace/ShadowBoardButton.tsx
  - src/features/bin-designer/components/panel/CutoutsSection/shadowBoard/
---

# Workshop

Some tools store best standing up or hanging, and a flat cutout can't do that. Workshop builds a tool holder out of 3D parts on a Gridfinity base: posts, fins, tubes, cradles, racks and more. It carries an experimental label.

This page also shows how to export a shadow board from the cutout editor.

## Start a Workshop build

1. Open the [bin designer](https://gridfinitylayouttool.com/designer) and click <Ui k="binDesigner.designs" /> in the header.
2. In <Ui k="binDesigner.savedDesigns" />, click <Ui k="binDesigner.newWorkshop" />.

The panel on the left holds the parts, the build tree and the base settings. The 3D view on the right is where you place the parts. A build saves to your saved designs like a bin, and you can link it to a bin in a layout.

Not sure what to build first? When the build is empty, the <Ui k="workshop.tree.title" /> section offers templates to start from:

- <Ui k="workshop.template.pliersRack" />
- <Ui k="workshop.template.screwdriverBlock" />
- <Ui k="workshop.template.plierComb" />
- <Ui k="workshop.template.screwdriverStation" />
- <Ui k="workshop.template.angledBitBank" />
- <Ui k="workshop.template.wrenchRail" />

## Set up the base

Under <Ui k="workshop.base.title" />, set the <Ui k="workshop.envelope.width" /> and the <Ui k="workshop.envelope.depth" /> in grid units, and the <Ui k="workshop.base.floorThickness" />. Want the top of the base to tilt? Set a <Ui k="workshop.wedge.angle" /> and pick the <Ui k="workshop.wedge.lowEdge" />.

## Place parts

1. In <Ui k="workshop.palette.title" />, click a part.
2. Click a surface in the 3D view to place it there.

You can place a part on the base or on top of another part. The <Ui k="workshop.tree.title" /> section shows which part sits on which.

| Parts                                                                                                                      | Use                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| <Ui k="workshop.part.post" />, <Ui k="workshop.part.fin" />, <Ui k="workshop.part.block" />, <Ui k="workshop.part.tube" /> | Simple shapes that stand on the base.                    |
| <Ui k="workshop.part.cradle" />, <Ui k="workshop.part.hook" />, <Ui k="workshop.part.arch" />                              | Parts that hold or carry a tool.                         |
| <Ui k="workshop.part.comb" />, <Ui k="workshop.part.riser" />, <Ui k="workshop.part.boreBank" />                           | Rows of slots, steps or holes.                           |
| <Ui k="workshop.palette.hole" />, <Ui k="workshop.palette.slot" />                                                         | Cutters. They remove material from the parts below them. |

A cutter has a <Ui k="workshop.profile.title" />. Pick a <Ui k="workshop.profileShape.circle" />, a <Ui k="workshop.profileShape.rectangle" />, a <Ui k="workshop.profileShape.polygon" /> or a <Ui k="workshop.profileShape.slot" />. To cut the outline of a real tool, click <Ui k="workshop.profile.scan" />. See [Scan with your phone](./phone-scan).

<Screenshot id="cutouts-workshop-build" alt="A Workshop build from the Screwdriver station template on a 3x2 base: a stepped riser with a bit bank on top. The bit bank is selected, with its rotation ring and size handles. The panel shows the Parts, Build and Selected part sections." spec="Bin designer, Saved designs, New Workshop build. Set the base to 3x2 and load the Screwdriver station template. Select the bit bank so the move handle, rotation ring and resize handles show. Crop to the full panel and the 3D view." />

## Select parts

- Click a part to select it.
- <kbd>Shift</kbd>+click a part to add it to the selection or to remove it.
- Hold <kbd>Shift</kbd> and drag over empty space to select all the parts in a box.

With two or more parts selected, a toolbar opens at the top of the 3D view:

- <Ui k="workshop.selection.alignX" /> and <Ui k="workshop.selection.alignY" /> line the parts up.
- <Ui k="workshop.selection.distributeX" /> and <Ui k="workshop.selection.distributeY" /> space them evenly.
- <Ui k="workshop.menu.duplicate" />, <Ui k="workshop.menu.delete" /> and <Ui k="workshop.selection.clear" /> work on the whole selection.

Right-click a part for <Ui k="workshop.menu.duplicate" />, <Ui k="workshop.menu.rotate90" />, <Ui k="workshop.menu.mirror" /> and <Ui k="workshop.menu.delete" />.

## Move, turn and resize parts

- Drag a part to move it. Drop it over another part to put it on top of that part.
- Drag the ring around the selection to turn it. Several parts turn together around their center.
- Drag a handle on one selected part to change its size in that direction. For an exact value, click the number beside a handle and type it.

To move several parts, drag one of the selected parts, and the others come along. Resize handles show only when you select one part. Each drag is one step for undo, so one undo takes back a wrong move.

The <Ui k="workshop.inspector.title" /> section gives exact values for the position, the <Ui k="workshop.inspector.rotation" />, the <Ui k="workshop.inspector.seatZ" /> and the size of the part.

### Part warnings

The inspector warns you when a part has a problem:

- <Ui k="workshop.warning.floating" />
- <Ui k="workshop.warning.outsideBase" />
- <Ui k="workshop.warning.overhang" />
- <Ui k="workshop.warning.socketBreach" />
- <Ui k="workshop.warning.unsupported" />

## Look at the build

- The buttons in the corner of the 3D view set the camera: <Ui k="workshop.view.front" />, <Ui k="workshop.view.side" />, <Ui k="workshop.view.top" /> or <Ui k="workshop.view.isometric" />.
- <Ui k="workshop.view.fit" /> (<kbd>F</kbd>) zooms to the selection.
- <kbd>P</kbd> changes between <Ui k="workshop.view.perspective" /> and <Ui k="workshop.view.orthographic" />.

## Export the build

When the build looks right, click <Ui k="workshop.export.stl" />, <Ui k="workshop.export.threeMf" /> or <Ui k="workshop.export.step" /> at the top of the panel.

## Export a shadow board

A shadow board is a flat outline of a bin top. Use it to cut a matching board, a foam insert or a drawer liner on a laser cutter or a CNC machine. This export lives in the cutout editor of a bin with <Ui k="binDesigner.interior.solid.title" />, not in Workshop.

1. Open the cutout editor. See [Cutout basics](./basics#open-the-cutout-editor).
2. In the <Ui k="binDesigner.shapeList.tabProperties" /> tab, click <Ui k="binDesigner.shadowBoard.button" />.
3. Pick <Ui k="binDesigner.shadowBoard.format.svg" /> or <Ui k="binDesigner.shadowBoard.format.dxf" />. To make each opening larger by its clearance, tick <Ui k="binDesigner.shadowBoard.clearance" />.
4. Click the download button.

The file has the outline of the bin and every opening at true size. It includes each copy of a repeat, the result of each group, STL imprints, and openings through a wall. Cutouts that overlap become one opening. Entry edges, depths and leans have no outline.

## Next steps

- [Cutout basics](./basics): cut tool shapes into a solid bin.
- [Saved designs and linked bins](../concepts/saved-designs): find and reuse your Workshop builds.
- [Place and edit bins](../layouts/placing-bins): put a build in a drawer layout.
