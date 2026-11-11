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
---

# Magnets and screws

A plain baseplate holds bins by the shape of its pockets. Magnets and screws make the bins and the plate stay where you put them. This page shows the three options in the <Ui k="baseplate.sectionBase" /> section and how each one changes the plate.

## Choose what to hold

| Option                                  | What it holds                                | Where the holes go                                     |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------------ |
| <Ui k="baseplate.magnetHoles" />        | The bins, to the plate                       | In the pocket under each bin foot                      |
| <Ui k="baseplate.mountMagnets.label" /> | The plate, to a steel drawer or tool chest   | In the underside, where four pockets meet              |
| <Ui k="baseplate.screwHoles.label" />   | The plate, to a drawer bottom, bench or wall | In the margin, between pockets, or in the pocket floor |

All three are off by default. <Ui k="baseplate.stackPrint.enable" /> removes all three, because the flipped plates in a stack cannot print the holes without supports. See [Eco plates and stack printing](./eco-and-stack-printing).

<Screenshot id="baseplates-magnets-base-section" alt="The Base section with Magnet holes and Screw down turned on." spec="Baseplate generator, 4 by 3 plate, no split. Base section expanded with Magnet holes on and expanded, Screw down on and collapsed. Crop to the Base section of the panel." />

## Add magnet holes for the bins

1. In <Ui k="baseplate.sectionBase" />, turn on <Ui k="baseplate.magnetHoles" />.
2. Set <Ui k="baseplate.magnetDiameter" />. The default is 6.5 mm, which fits a standard 6 mm magnet.
3. Set <Ui k="baseplate.magnetDepth" />. The default is 2 mm, for a 6 by 2 mm magnet.

The bins need magnets in the same places. In the bin designer, turn on magnet holes in the base of each bin. See [The base](../designer/base). Under <Ui k="binDesigner.base.section.mounting" />, the bin option <Ui k="binDesigner.base.cornerHolesOnly" /> puts holes only at the outer corners of a bin. A large bin then needs fewer magnets and lifts off the plate more easily.

Magnet holes make the plate taller by the magnet depth plus 0.5 mm. The extra 0.5 mm is the floor under each hole.

### Fit settings for magnets

Two options help a magnet stay in its hole without glue:

- <Ui k="baseplate.magnetCrushRibs" /> adds eight ridges inside each hole. The ridges crush as you push the magnet in.
- <Ui k="baseplate.magnetChamfer" /> adds a 45° lead-in at the top of each hole, so the magnet goes in straight.

If <Ui k="baseplate.magnetChamfer" /> is not available, the plate has too little wall around each hole for a lead-in.

### Magnet position on large grids

When the <Ui k="baseplate.gridUnit" /> is more than 42 mm, <Ui k="common.physicalUnits" /> shows <Ui k="baseplate.magnetAnchor" />. This setting applies to the plate, the bins and the lids together, so their magnets stay aligned.

| Choice                                  | Magnet position                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------------- |
| <Ui k="baseplate.magnetAnchorEdge" />   | 8 mm from each cell edge, the standard Gridfinity position                         |
| <Ui k="baseplate.magnetAnchorCenter" /> | 13 mm from each cell center, to match parts that you printed with an older version |

## Hold the plate to steel with underside magnets

<Ui k="baseplate.mountMagnets.label" /> cuts magnet holes into the bottom of the plate. The holes sit where four pockets meet, so the plate does not get taller.

| Setting                                          | Default | Range         |
| ------------------------------------------------ | ------- | ------------- |
| <Ui k="baseplate.mountMagnets.diameter.label" /> | 6.5 mm  | 2 to 6.5 mm   |
| <Ui k="baseplate.mountMagnets.depth.label" />    | 2 mm    | 0.5 to 2.5 mm |
| <Ui k="baseplate.mountMagnets.perPiece.label" /> | 4       | 1 to 64       |

Set the diameter to the magnet diameter plus the clearance for your printer, usually 0.2 to 0.5 mm. The depth starts at the underside, so a magnet of that height sits flush with the bottom. The Layout Tool spreads the magnets evenly over each printed piece. A high count fills every place that it can.

The Layout Tool skips a crossing on a split seam, on the plate edge, or with a screw. If a hole is too deep or too wide for the plate, a warning shows below the depth.

## Screw the plate down

<Ui k="baseplate.screwHoles.label" /> adds vertical holes for screws. The holes are clearance holes, not pilot holes. A thread that bites into the plastic holds the plate off the surface.

| Setting                                                | What it does                                                                                                                                                   | Default                                               |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| <Ui k="baseplate.screwHoles.diameter.label" />         | The shaft hole. 3.4 mm lets an M3 screw through.                                                                                                               | 3.4 mm                                                |
| <Ui k="baseplate.screwHoles.headStyle.label" />        | <Ui k="baseplate.screwHoles.headStyle.countersink" /> for a flat-head screw, <Ui k="baseplate.screwHoles.headStyle.counterbore" /> for a socket head cap screw | <Ui k="baseplate.screwHoles.headStyle.countersink" /> |
| <Ui k="baseplate.screwHoles.headDiameter.label" />     | The recess width at the surface                                                                                                                                | 6 mm countersink, 5.5 mm counterbore                  |
| <Ui k="baseplate.screwHoles.counterboreDepth.label" /> | The pocket depth. Make it the height of the screw head.                                                                                                        | 3 mm                                                  |
| <Ui k="baseplate.screwHoles.perPiece.label" />         | Screws in each printed piece, from 1 to 8                                                                                                                      | 4                                                     |
| <Ui k="baseplate.screwHoles.edgeInset.label" />        | Grid units along each piece edge with no screws, from 0 to 4                                                                                                   | 0                                                     |
| <Ui k="baseplate.screwHoles.cellCorner.label" />       | The cell corner for a pocket-floor screw                                                                                                                       | <Ui k="baseplate.screwHoles.cellCorner.outer" />      |

For the head diameter, use 6 mm for an M3 flat head and 8 mm for an M4 flat head. Use 5.5 mm for an M3 socket head cap screw. The head must sit flush. A head that stands up lifts any bin above it.

### Put screws only at the corners

With 4 screws for each piece, the screws go in the corners of each piece. Higher counts add screws at the middle of each edge. Each split piece gets its own screws, so no printed piece stays loose.

To keep screws away from a drawer lip, set <Ui k="baseplate.screwHoles.edgeInset.label" /> to 1. Above 0, no screw goes in the margin. A piece that is too small for the inset gets no screws.

### Keep the plate at standard height

Each screw goes in one of three places:

- In the solid margin, when the margin is wide enough.
- In the solid corner where four pockets meet, when the head fits there.
- In the pocket floor. The plate then gets a little taller, so that the floor can hold the head.

If one piece of a split plate needs a pocket-floor screw, all the pieces get the same taller floor. The pieces then stay flush when you put them together.

To keep the standard plate height, use a <Ui k="baseplate.screwHoles.headStyle.countersink" /> with a 6 mm head diameter. A countersink of 6 mm or less fits where four pockets meet.

<Screenshot id="baseplates-magnets-screw-settings" alt="The Screw down settings with a countersink head of 6 mm and four screws for each piece." spec="Baseplate generator, 4 by 3 plate. Base section with Screw down on and expanded: Hole diameter 3.4, Countersink, Head diameter 6, Screws per piece 4. Preview in iso view with screw holes visible. Crop to the panel section and the preview side by side." />

## Next steps

- [Split for your print bed](./splitting): every split piece gets its own screws and underside magnets.
- [Eco plates and stack printing](./eco-and-stack-printing): see what makes a plate taller, and which options a stack removes.
- [The base](../designer/base): add the matching magnet holes to your bins.
- [Fit and tolerances](../printing/fit-and-tolerances): tune the fit of parts for your printer.
