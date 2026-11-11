---
title: Lids
description: 'Add a lid that presses on, clicks, holds with magnets, slides or swings on a hinge, and shape its top and grip.'
sources:
  - src/features/bin-designer/types/lid.ts
  - src/features/bin-designer/components/panel/LidSection/
  - src/features/bin-designer/components/panel/SlideControls/
  - src/features/bin-designer/components/panel/HingeControls/
  - src/features/bin-designer/components/panel/LidGripControls/
  - src/features/bin-designer/utils/lidCompatibility.ts
---

# Lids

A lid keeps dust out and keeps small parts in their compartments. The Gridfinity Layout Tool makes the lid as a second part that fits the bin. This page shows each way a lid can hold on, and how to shape its top and its grip.

## Turn on a lid

1. In the bin designer, select <Ui k="binDesigner.category.features" /> in the panel.
2. Turn on <Ui k="binDesigner.lid.enable" />.
3. Under <Ui k="binDesigner.lid.section.attaches" />, pick an attachment.

Most lids grip the stacking lip of the bin. If the stacking lip is off, the panel shows <Ui k="binDesigner.lid.requiresStackingLip" /> and a button that turns the lip on. A slanted bin has no lid.

Some features conflict with a lid, for example handles that reach up into the lip. The section lists them under <Ui k="binDesigner.lid.compat.heading" />, some with a <Ui k="binDesigner.lid.compat.fixButton" /> button.

<Screenshot id="designer-lids-attachment" alt="The Lid section with the five attachment choices and the Top surface control." spec="Bin designer, 2x2x3 bin with stacking lip, Features page, Lid on, Click rails selected, Flat top. Crop to the Lid section from the Lid switch to the Top surface control, with the lid visible in the preview." />

## Pick how the lid attaches

| Attachment                                       | How it holds                                                                             | Settings                                                                                                                                             |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.lid.attachment.friction" />   | The lid grips the lip by friction alone. It is the easiest lid to print and to pull off. | None                                                                                                                                                 |
| <Ui k="binDesigner.lid.attachment.clickRails" /> | Snap rails on the lid click under the lip.                                               | <Ui k="binDesigner.lid.clickRails" />, <Ui k="binDesigner.lid.clickRailCoverage" />                                                                  |
| <Ui k="binDesigner.lid.attachment.magnetic" />   | A magnet in each corner of the bin and the lid pulls the lid shut.                       | <Ui k="binDesigner.lid.retentionMagnetDiameter" />, <Ui k="binDesigner.lid.retentionMagnetDepth" />, <Ui k="binDesigner.lid.retentionEdgeMagnets" /> |
| <Ui k="binDesigner.lid.attachment.slide" />      | A flat plate slides in a channel along two walls.                                        | See [Sliding lids](#sliding-lids)                                                                                                                    |
| <Ui k="binDesigner.lid.attachment.hinge" />      | The lid swings on a pin of filament.                                                     | See [Hinged lids](#hinged-lids)                                                                                                                      |

A new lid starts with <Ui k="binDesigner.lid.attachment.clickRails" /> on all four sides, with rails half as long as each wall. If the base of the bin has magnet holes, the lid also starts with a stackable top and magnet pockets. Under <Ui k="binDesigner.lid.clickRails" />, turn off a side to leave it without a rail. If a label tab, wall cutout or handle is in the way, the panel turns that side off for you.

A magnetic lid uses 6 × 2 mm magnets by default. Glue the magnets in with matching poles facing, so the lid closes only one way. <Ui k="binDesigner.lid.retentionEdgeMagnets" /> adds up to three more magnets along each long edge, so a large lid does not sag.

### Sliding lids

A sliding lid is a flat plate. It does not need the stacking lip.

- <Ui k="binDesigner.lid.slide.placement" />: <Ui k="binDesigner.lid.slide.placement.recessed" /> keeps the stacking lip, so other bins still stack on this one. <Ui k="binDesigner.lid.slide.placement.flush" /> gives the deepest inside, but you must turn the stacking lip off.
- <Ui k="binDesigner.lid.slide.entrySide" />: the wall the lid slides out of. The two walls on each side of it carry the runners.
- <Ui k="binDesigner.lid.slide.pull" />: <Ui k="binDesigner.lid.slide.pull.none" />, <Ui k="binDesigner.lid.slide.pull.notch" />, <Ui k="binDesigner.lid.slide.pull.tab" /> or <Ui k="binDesigner.lid.slide.pull.catch" />. The finger catch is a part of the stacking rim that moves with the lid, so the whole width becomes a pull.
- <Ui k="binDesigner.lid.slide.detent" />: a small ramp on each runner. The lid clicks past it, so a knock cannot slide the lid open.

<Ui k="binDesigner.lid.slide.clearance" />, under <Ui k="binDesigner.lid.advanced" />, sets the gap between the lid and its channel, from 0.1 to 0.6 mm. Raise it if the lid binds, and lower it if the lid rattles.

### Hinged lids

A hinged lid has knuckles on one wall. A short piece of 1.75 mm filament goes through them as the hinge pin. The panel tells you how long to cut each piece.

- <Ui k="binDesigner.lid.hinge.side" />: the wall the lid swings up from. It starts on the <Ui k="binDesigner.lid.side.back" /> wall, so the open lid falls away from your hand.
- <Ui k="binDesigner.lid.hinge.catch" />: <Ui k="binDesigner.lid.hinge.catch.none" />, <Ui k="binDesigner.lid.hinge.catch.detent" /> (the default) or <Ui k="binDesigner.lid.hinge.catch.magnets" />. Magnets give the strongest hold, and they still work with a cutout in the wall opposite the hinge.
- <Ui k="binDesigner.lid.hinge.fitClearance" />, under <Ui k="binDesigner.lid.advanced" />: the gap between the knuckles and the pin. Raise it if the hinge binds, and lower it if the lid rattles.

When you first pick <Ui k="binDesigner.lid.attachment.hinge" />, the lid also gets a scallop grip on the wall opposite the hinge, so your thumb can lift it. A hinged lid cannot carry a stackable top.

## Pick the top surface

Under <Ui k="binDesigner.lid.section.topSurface" />, pick what the top of the lid does. A sliding lid has no top surface choice.

| Top                                             | What you get                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.lid.topSurface.flat" />      | A plain closed top.                                                                                                                                                                 |
| <Ui k="binDesigner.lid.topSurface.stackable" /> | A grid of Gridfinity sockets, so another bin locks onto the lid.                                                                                                                    |
| <Ui k="binDesigner.lid.topSurface.tray" />      | A shallow recess in the top that holds small parts. Set its <Ui k="binDesigner.lid.trayDepth" /> and <Ui k="binDesigner.lid.trayWall" /> under <Ui k="binDesigner.lid.advanced" />. |

A stackable top has three more options:

- <Ui k="binDesigner.lid.stackLipOnly" /> makes one lip around the edge, not a full grid. The top face stays clear, and it uses less filament.
- <Ui k="binDesigner.lid.magnetHoles" /> cuts pockets for the magnets of the bin above.
- <Ui k="binDesigner.lid.separateStackPlate" /> prints the stack grid as its own flat part. Glue it onto the lid top after you print. The lid then prints without supports.

## Set the height and thickness

<Ui k="binDesigner.lid.extraHeight" /> raises the lid by up to 100 mm, so tall contents fit under it. Switch it to height units to line the lid top up with the rim of a taller bin. <Ui k="binDesigner.lid.topThickness" />, under <Ui k="binDesigner.lid.advanced" />, makes a large lid stiffer.

## Add a grip

The <Ui k="binDesigner.lid.section.grip" /> group removes a little material where the lid meets the bin, so a fingertip can get under a tight lid.

- <Ui k="binDesigner.lid.gripMode" />: <Ui k="binDesigner.lid.gripMode.chamfer" />, <Ui k="binDesigner.lid.gripMode.reveal" /> or <Ui k="binDesigner.lid.gripMode.scallop" />. A shadow line moves the outer face of the lid, so it is not available on a stackable lid.
- <Ui k="binDesigner.lid.gripSides" /> and <Ui k="binDesigner.lid.gripCoverage" /> set where the relief goes and how wide it is.
- <Ui k="binDesigner.lid.gripBinDip" /> also lowers the stacking lip of the bin across the same span. A bin stacked on top then has nothing to locate against along that span.

A sliding lid has no grip group. Use its <Ui k="binDesigner.lid.slide.pull" /> setting.

## Cut holes in the lid

Click <Ui k="binDesigner.lid.editCutouts" /> to draw shapes that go through the lid. Use it for a slot to dispense parts, a vent, or a hole for a cable. A lid holds up to 24 shapes, clear of the mating wall and the magnets. The lid needs a flat top or a lip-only top, on a rectangular bin.

## Other lid options

- <Ui k="binDesigner.lid.section.text" /> puts text on the lid top. See [Labels and text](./labels-and-text#add-floor-and-lid-text).
- <Ui k="binDesigner.lid.fill" /> fills the lid down to just above the dividers, so small parts stay in their compartments. It is available on friction and magnetic lids.
- <Ui k="binDesigner.lid.createMatchingTray" /> starts a new design with the same size as this bin. Its underside is a lid, so it sits on this bin as an organizer tray.

The lid exports with its rails up, ready to print. The default lid needs no supports, but a fused stack grid can need them.

## Next steps

- [Colors](./colors): print the lid and its stack lip in their own colors.
- [Stacking](./stacking): learn how the stacking lip works with lids.
- [Special bins](./special-bins): see other bin types, such as the organizer tray.
- [Fit and tolerances](../printing/fit-and-tolerances): tune fits for your printer.
