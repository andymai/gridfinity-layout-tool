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
  - src/shared/utils/lidInteriorRelief.ts
  - src/shared/utils/hingeLidPlan.ts
  - src/shared/utils/lipGapPlan.ts
---

# Lids

A lid keeps dust out and keeps small parts in their own compartments. The Gridfinity Layout Tool makes the lid as a second part that fits your bin. Pick how it holds on, then shape its top and its grip. [Anatomy of a bin](../concepts/bin-anatomy#lid) shows where the lid sits on a bin.

## Turn on a lid

1. In the bin designer, open the <Ui k="binDesigner.group.lid" /> group.
2. Turn on <Ui k="binDesigner.lid.enable" />.
3. Under <Ui k="binDesigner.lid.section.attaches" />, pick how the lid attaches.

Most lids grip the stacking lip of the bin. If the stacking lip is off, the panel shows <Ui k="binDesigner.lid.requiresStackingLip" /> and a button that turns the lip on for you. A slanted bin can't have a lid.

Some features get in the way of a lid, for example handles that reach up into the lip. The section lists them under <Ui k="binDesigner.lid.compat.heading" />. Some come with a <Ui k="binDesigner.lid.compat.fixButton" /> button that clears the conflict for you.

<Screenshot id="designer-lids-attachment" alt="Turning on the Lid switch shows the five attachment choices, and the preview shows the click-rail lid above the bin. Then picking Hinged stands the lid open on its hinge." spec="Bin designer, 2 x 2 x 3 bin. In the Lid group, turn on Lid in close-up, then show the click-rail lid in the preview. Pick Hinged in close-up, then show the hinged lid in the preview." />

## Pick how the lid attaches

Not sure? Keep <Ui k="binDesigner.lid.attachment.clickRails" />, which every new lid starts with.

| Attachment                                       | How it holds                                                                            | Settings                                                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.lid.attachment.friction" />   | The lid grips the lip by friction alone. It's the easiest lid to print and to pull off. | None                                                                                                                                                 |
| <Ui k="binDesigner.lid.attachment.clickRails" /> | Snap rails on the lid click under the lip.                                              | <Ui k="binDesigner.lid.clickRails" />, <Ui k="binDesigner.lid.clickRailCoverage" />                                                                  |
| <Ui k="binDesigner.lid.attachment.magnetic" />   | A magnet in each corner of the bin and the lid pulls the lid shut.                      | <Ui k="binDesigner.lid.retentionMagnetDiameter" />, <Ui k="binDesigner.lid.retentionMagnetDepth" />, <Ui k="binDesigner.lid.retentionEdgeMagnets" /> |
| <Ui k="binDesigner.lid.attachment.slide" />      | A flat plate slides in a channel along two walls.                                       | See [Sliding lids](#sliding-lids)                                                                                                                    |
| <Ui k="binDesigner.lid.attachment.hinge" />      | The lid swings on a pin of filament.                                                    | See [Hinged lids](#hinged-lids)                                                                                                                      |

A new lid starts with click rails on all four sides, each rail half as long as its wall. If the base of the bin has magnet holes, the lid also starts with a stackable top and magnet pockets. Under <Ui k="binDesigner.lid.clickRails" />, turn off a side to leave it without a rail. If a label tab, wall cutout or handle is in the way, the panel turns that side off for you.

A magnetic lid takes 6 × 2 mm magnets by default. Glue the magnets in with matching poles facing, so the lid closes only one way round. <Ui k="binDesigner.lid.retentionEdgeMagnets" /> adds up to three more magnets along each long edge, so a large lid doesn't sag.

### Sliding lids

A **sliding lid** is a flat plate that slides in and out of a channel. It doesn't need the stacking lip.

| Setting                                    | What it does                                                                                                                                                                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.lid.slide.placement" /> | <Ui k="binDesigner.lid.slide.placement.recessed" /> keeps the stacking lip, so other bins still stack on this one. <Ui k="binDesigner.lid.slide.placement.flush" /> gives the deepest inside, but you must turn the stacking lip off. |
| <Ui k="binDesigner.lid.slide.entrySide" /> | The wall the lid slides out of. The two walls on each side of it carry the runners.                                                                                                                                                   |
| <Ui k="binDesigner.lid.slide.pull" />      | What your finger pulls on: <Ui k="binDesigner.lid.slide.pull.none" />, <Ui k="binDesigner.lid.slide.pull.notch" />, <Ui k="binDesigner.lid.slide.pull.tab" /> or <Ui k="binDesigner.lid.slide.pull.catch" />.                         |
| <Ui k="binDesigner.lid.slide.detent" />    | Adds a small ramp on each runner. The lid clicks past it, so a knock can't slide the lid open.                                                                                                                                        |

The finger catch is a part of the stacking rim that moves with the lid, so the whole width becomes a pull. It keeps the [lip peak](./stacking#make-the-lip-print-cleanly) shape of the rest of the rim.

<Ui k="binDesigner.lid.slide.clearance" />, under <Ui k="binDesigner.lid.advanced" />, sets the gap between the lid and its channel, from 0.1 to 0.6 mm. If the lid binds, raise it. If the lid rattles, lower it.

### Hinged lids

A **hinged lid** has knuckles on one wall. A short piece of 1.75 mm filament goes through them as the hinge pin, so you need no metal pin. The panel tells you how long to cut each piece.

- <Ui k="binDesigner.lid.hinge.side" />: the wall the lid swings up from. It starts on the <Ui k="binDesigner.lid.side.back" /> wall, so the open lid falls away from your hand.
- <Ui k="binDesigner.lid.hinge.catch" />: <Ui k="binDesigner.lid.hinge.catch.none" />, <Ui k="binDesigner.lid.hinge.catch.detent" /> (the default) or <Ui k="binDesigner.lid.hinge.catch.magnets" />. Magnets give the strongest hold, and they still work with a cutout in the wall opposite the hinge.
- <Ui k="binDesigner.lid.hinge.fitClearance" />, under <Ui k="binDesigner.lid.advanced" />: the gap between the knuckles and the pin. If the hinge binds, raise it. If the lid rattles, lower it.

When you first pick <Ui k="binDesigner.lid.attachment.hinge" />, the lid also gets a scallop grip on the wall opposite the hinge, so your thumb can lift it. A hinged lid can't carry a stackable top.

## Pick the top surface

Under <Ui k="binDesigner.lid.section.topSurface" />, pick what the top of the lid does. A sliding lid has no top surface choice.

| Top                                             | What you get                                                                                                                                                                        |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.lid.topSurface.flat" />      | A plain closed top.                                                                                                                                                                 |
| <Ui k="binDesigner.lid.topSurface.stackable" /> | A grid of Gridfinity sockets, so another bin locks onto the lid.                                                                                                                    |
| <Ui k="binDesigner.lid.topSurface.tray" />      | A shallow recess in the top that holds small parts. Set its <Ui k="binDesigner.lid.trayDepth" /> and <Ui k="binDesigner.lid.trayWall" /> under <Ui k="binDesigner.lid.advanced" />. |

A stackable top has three more options:

- <Ui k="binDesigner.lid.stackLipOnly" /> makes one lip around the edge, not a full grid. The top face stays clear, and it takes less filament.
- <Ui k="binDesigner.lid.magnetHoles" /> cuts holes for the magnets of the bin above.
- <Ui k="binDesigner.lid.separateStackPlate" /> prints the stack grid as its own flat part. Glue it onto the lid top after you print. The lid then prints without supports.

## Set the height and thickness

Tall contents? <Ui k="binDesigner.lid.extraHeight" /> raises the lid by up to 100 mm. Switch it to height units to line the lid top up with the rim of a taller bin. <Ui k="binDesigner.lid.topThickness" />, under <Ui k="binDesigner.lid.advanced" />, makes a large lid stiffer.

## Add a grip

A snug lid can be hard to get a fingernail under. The <Ui k="binDesigner.lid.section.grip" /> group removes a little material where the lid meets the bin, so a fingertip gets in.

- <Ui k="binDesigner.lid.gripMode" />: <Ui k="binDesigner.lid.gripMode.chamfer" />, <Ui k="binDesigner.lid.gripMode.reveal" /> or <Ui k="binDesigner.lid.gripMode.scallop" />. A shadow line moves the outer face of the lid, so a stackable lid can't use it.
- <Ui k="binDesigner.lid.gripSides" /> and <Ui k="binDesigner.lid.gripCoverage" /> set where the relief goes and how wide it is.
- <Ui k="binDesigner.lid.gripBinDip" /> also lowers the stacking lip of the bin across the same span. A bin stacked on top then has nothing to locate against along that span.

A sliding lid has no grip group. Use its <Ui k="binDesigner.lid.slide.pull" /> setting.

## Cut holes in the lid

Click <Ui k="binDesigner.lid.editCutouts" /> to draw shapes that go right through the lid: a slot to dispense parts, a vent, or a hole for a cable. The button opens the cutout editor, with the same tools as for a bin. See [Draw a cutout](../cutouts/basics#draw-a-cutout).

A lid holds up to 24 shapes, clear of the mating wall and the magnets. Holes need a flat top or a lip-only top, on a rectangular bin.

## Other lid options

- <Ui k="binDesigner.lid.section.text" /> puts text on the lid top. See [Labels and text](./labels-and-text#add-floor-and-lid-text).
- <Ui k="binDesigner.lid.fill" /> fills the lid down to just above the dividers, so small parts stay in their compartments. It works on friction and magnetic lids.
- <Ui k="binDesigner.lid.createMatchingTray" /> starts a new design with the same size as this bin. Its underside is a lid, so it sits on this bin as an organizer tray. To stack whole boxes without a lid, see [Nest boxes on each other](./stacking#nest-boxes-on-each-other).

The lid exports with its rails up, ready to print. The default lid needs no supports, but a fused stack grid can need them.

## When it goes wrong

### You can't turn on the lid

Read the note under the switch. It names the conflict to fix. If the stacking lip is off, click <Ui k="binDesigner.dependency.enableStackingLip" /> under the switch.

Most lids grip the stacking lip. Wall cutouts or handles block the lid only when they leave no usable lip on any wall. A lid also can't sit down on divider pieces that are taller than the inside of the bin.

### One wall has no click rail

Look under <Ui k="binDesigner.lid.compat.heading" />. It names the feature that took the rail. For a finger scoop, lower the scoop height, or turn on <Ui k="binDesigner.lid.relieveInterior" /> under <Ui k="binDesigner.lid.advanced" />.

A label tab, a wall cutout, a handle or a tall scoop at the top of a wall gets in the way of the rail. The bin designer then makes that rail shorter, or leaves it off.

### A sliding lid catches on the dividers

Turn on <Ui k="binDesigner.lid.relieveInterior" /> under <Ui k="binDesigner.lid.advanced" />. Dividers then stop a few millimeters below the rim, and label tabs sit lower.

The lid sweeps across the whole top of the bin, so dividers, label tabs or a scoop at the rim stop it. While the option is off, the compatibility notes warn you.

### A hinged lid won't stay shut

Under <Ui k="binDesigner.lid.hinge.catch" />, pick <Ui k="binDesigner.lid.hinge.catch.magnets" />. Or make <Ui k="binDesigner.lid.extraHeight" /> lower.

On a tall lid, the snap catch can't clear the rim as the lid opens. The bin designer then builds the lid without the catch, and the compatibility notes tell you.

## Next steps

- [Colors](./colors): print the lid and its stack lip in their own colors.
- [Stacking](./stacking): learn how the stacking lip works with lids.
- [Special bins](./special-bins): see other bin types, such as the organizer tray.
- [Fit and tolerances](../printing/fit-and-tolerances): tune fits for your printer.
