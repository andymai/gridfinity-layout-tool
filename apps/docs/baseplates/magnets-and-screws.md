---
title: Magnets and screws
description: 'Add magnet holes that hold your bins, and fasten the plate to a drawer with underside magnets or screws.'
sources:
  - src/features/baseplate/components/BaseplatePanel/BaseSection.tsx
  - src/core/baseplateDefaults.ts
  - src/shared/generation/screwHolePlan.ts
  - src/features/baseplate/utils/mountMagnetFit.ts
  - src/shared/printSettings/baseplateHeight.ts
  - src/features/baseplate/components/BaseplatePanel/PhysicalUnitsSection.tsx
  - content/what-is-gridfinity.md
---

# Magnets and screws

A plain baseplate holds bins by the shape of its pockets, and for a normal drawer that's enough. Magnets help when a drawer gets yanked hard or lives in a vehicle. Screws and underside magnets keep the plate itself in place. Here's how to set up each of the three options in <Ui k="baseplate.sectionBase" />, and what each one does to the plate.

## Choose what to hold

| Option                                  | Pick it to hold                              | Where the holes go                                     |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| <Ui k="baseplate.magnetHoles" />        | The bins, to the plate                       | In the pocket under each bin foot                      |
| <Ui k="baseplate.mountMagnets.label" /> | The plate, to a steel drawer or tool chest   | In the underside, where four pockets meet              |
| <Ui k="baseplate.screwHoles.label" />   | The plate, to a drawer bottom, bench or wall | In the margin, between pockets, or in the pocket floor |

All three are off by default. <Ui k="baseplate.stackPrint.enable" /> removes all three, because the flipped plates in a stack can't print the holes without supports. See [Eco plates and stack printing](./eco-and-stack-printing).

<Screenshot id="baseplates-magnets-base-section" alt="Magnet holes is turned on in the Base section, where Screw down is already on. The plate in the preview then gets a magnet hole in each corner of every pocket." spec="Baseplate generator, 4 by 3 plate, no split, Screw down on. The plate in iso view, then a close-up of the Base section where Magnet holes is turned on, then the plate again with its magnet holes." />

## Add magnet holes for the bins

1. In <Ui k="baseplate.sectionBase" />, turn on <Ui k="baseplate.magnetHoles" />.
2. Set <Ui k="baseplate.magnetDiameter" />. The default of 6.5 mm fits a standard 6 mm magnet.
3. Set <Ui k="baseplate.magnetDepth" />. The default of 2 mm suits a 6 by 2 mm magnet.

Not sure? Keep the defaults. Gridfinity magnets are 6 by 2 mm discs.

Your bins need magnets in the same places. In the bin designer, open <Ui k="binDesigner.group.base" /> and turn on magnet holes. See [The base](../designer/base#add-magnet-holes). For a big bin, turn on <Ui k="binDesigner.base.cornerHolesOnly" /> under <Ui k="binDesigner.base.section.mounting" />. The bin then gets holes only at its outer corners, so it needs fewer magnets and lifts off the plate more easily.

Magnet holes make the plate taller by the magnet depth plus 0.5 mm. That extra 0.5 mm is the floor under each hole.

### Fit settings for magnets

Want the magnets to stay in without glue? Two options help:

- <Ui k="baseplate.magnetCrushRibs" /> adds eight ridges inside each hole. The ridges crush as you push the magnet in.
- <Ui k="baseplate.magnetChamfer" /> adds a 45° lead-in at the top of each hole, so the magnet goes in straight.

If you can't turn on <Ui k="baseplate.magnetChamfer" />, the plate has too little wall around each hole for a lead-in.

### Magnet position on large grids

When the <Ui k="baseplate.gridUnit" /> is more than 42 mm, <Ui k="common.physicalUnits" /> shows <Ui k="baseplate.magnetAnchor" />. This one setting applies to the plate, the bins and the lids together, so their magnets stay lined up.

| Choice                                  | Magnet position                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| <Ui k="baseplate.magnetAnchorEdge" />   | 8 mm from each cell edge, the standard Gridfinity position                         |
| <Ui k="baseplate.magnetAnchorCenter" /> | 13 mm from each cell center, to match parts that you printed with an older version |

Not sure? Pick <Ui k="baseplate.magnetAnchorEdge" />. It's the standard position.

## Hold the plate to steel with underside magnets

Got a steel drawer or tool chest? <Ui k="baseplate.mountMagnets.label" /> cuts magnet holes into the bottom of the plate, so the whole plate holds to the steel. The holes sit where four pockets meet, so the plate doesn't get any taller.

| Setting                                          | Default | Range         |
| ------------------------------------------------ | ------- | ------------- |
| <Ui k="baseplate.mountMagnets.diameter.label" /> | 6.5 mm  | 2 to 6.5 mm   |
| <Ui k="baseplate.mountMagnets.depth.label" />    | 2 mm    | 0.5 to 2.5 mm |
| <Ui k="baseplate.mountMagnets.perPiece.label" /> | 4       | 1 to 64       |

Set the diameter to the magnet diameter plus the clearance for your printer, usually 0.2 to 0.5 mm. The depth starts at the underside, so a magnet of that height sits flush with the bottom. The Layout Tool spreads the magnets evenly over each printed piece, and a high count fills every place that it can.

It skips a crossing on a split seam, on the plate edge, or where a screw goes. If a hole is too deep or too wide for the plate, a warning appears below the depth.

## Screw the plate down

<Ui k="baseplate.screwHoles.label" /> adds vertical holes, so you can screw the plate to a drawer bottom, a bench or a wall. They're clearance holes, not pilot holes, so the screw goes through freely. A thread that bites into the plastic holds the plate off the surface.

| Setting                                                | What it does                                                                                                                                                   | Default                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| <Ui k="baseplate.screwHoles.diameter.label" />         | The shaft hole. 3.4 mm lets an M3 screw through.                                                                                                               | 3.4 mm                                                |
| <Ui k="baseplate.screwHoles.headStyle.label" />        | <Ui k="baseplate.screwHoles.headStyle.countersink" /> for a flat-head screw, <Ui k="baseplate.screwHoles.headStyle.counterbore" /> for a socket head cap screw | <Ui k="baseplate.screwHoles.headStyle.countersink" /> |
| <Ui k="baseplate.screwHoles.headDiameter.label" />     | The recess width at the surface                                                                                                                                | 6 mm countersink, 5.5 mm counterbore                  |
| <Ui k="baseplate.screwHoles.counterboreDepth.label" /> | The pocket depth. Make it the height of the screw head.                                                                                                        | 3 mm                                                  |
| <Ui k="baseplate.screwHoles.perPiece.label" />         | Screws in each printed piece, from 1 to 8                                                                                                                      | 4                                                     |
| <Ui k="baseplate.screwHoles.edgeInset.label" />        | Grid units along each piece edge with no screws, from 0 to 4                                                                                                   | 0                                                     |
| <Ui k="baseplate.screwHoles.cellCorner.label" />       | The cell corner for a pocket-floor screw                                                                                                                       | <Ui k="baseplate.screwHoles.cellCorner.outer" />      |

For the head diameter, use 6 mm for an M3 flat head and 8 mm for an M4 flat head. Use 5.5 mm for an M3 socket head cap screw. The head must sit flush, because a head that sticks up lifts any bin above it.

### Put screws only at the corners

With 4 screws for each piece, the screws go in the corners of each piece. Higher counts add screws at the middle of each edge. Each split piece gets its own screws, so no printed piece stays loose.

Does your drawer have a lip? Set <Ui k="baseplate.screwHoles.edgeInset.label" /> to 1 to keep screws away from it. Above 0, no screw goes in the margin. A piece that is too small for the inset gets no screws.

### Keep the plate at standard height

Each screw goes in one of three places:

- In the solid margin, when the margin is wide enough.
- In the solid corner where four pockets meet, when the head fits there.
- In the pocket floor. The plate then gets a little taller, so that the floor can hold the head.

If one piece of a split plate needs a pocket-floor screw, all the pieces get the same taller floor. That way the pieces stay flush when you put them together.

To keep the standard plate height, use a <Ui k="baseplate.screwHoles.headStyle.countersink" /> with a 6 mm head diameter. A countersink of 6 mm or less fits where four pockets meet. M3 flat-head screws with these settings are a safe pick.

<Screenshot id="baseplates-magnets-screw-settings" alt="Screw down is turned on and its settings open: a 3.4 mm hole, a countersink head of 6 mm and four screws for each piece. The plate in the preview then gets four countersunk holes where four pockets meet." spec="Baseplate generator, 4 by 3 plate. The plate in top view, then a close-up of the Base section: turn on Screw down, click Customize and scroll to Hole diameter 3.4, Countersink, Head diameter 6 and Screws per piece 4. Then the plate again with its screw holes." />

## Next steps

- [Split for your print bed](./splitting): every split piece gets its own screws and underside magnets.
- [Eco plates and stack printing](./eco-and-stack-printing): see what makes a plate taller, and which options a stack removes.
- [The base](../designer/base): add the matching magnet holes to your bins.
- [Fit and tolerances](../printing/fit-and-tolerances): tune the fit of parts for your printer.
