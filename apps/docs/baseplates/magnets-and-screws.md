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
  - src/shared/generation/screwHolePlacement.ts
  - src/shared/generation/magnetHoleStyle.ts
  - src/shared/generation/mountMagnetPlan.ts
  - src/features/generation/worker/generators/baseplateGenerator.ts
  - content/what-is-gridfinity.md
  - src/shared/utils/magnetDiameter.ts
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

The diameter changes in steps of 0.05 mm, so you can type a value such as 6.45 mm to make the fit tighter or looser.

<Screenshot id="baseplates-magnets-magnet-settings" alt="Magnet holes is on and Customize is open. It shows Magnet diameter at 6.5 mm, Magnet depth at 2 mm, Crush ribs, and Chamfered mouth. Chamfered mouth is off, with a note to turn on Solid floor for a lead-in." spec="Baseplate generator, 4 by 3 plate with the default lightweight floor, Magnet holes on. Click Customize under Magnet holes. Crop to the panel from Magnet holes down to the note under Chamfered mouth." />

Your bins need magnets in the same places. In the bin designer, open <Ui k="binDesigner.group.base" /> and turn on magnet holes. See [The base](../designer/base#add-magnet-holes). For a big bin, turn on <Ui k="binDesigner.base.cornerHolesOnly" /> under <Ui k="binDesigner.base.section.mounting" />. The bin then gets holes only at its outer corners, so it needs fewer magnets and lifts off the plate more easily.

Magnet holes make the plate taller by the magnet depth plus 0.5 mm. That extra 0.5 mm is the floor under each hole.

### Fit settings for magnets

Want the magnets to stay in without glue? Two options under <Ui k="common.customize" /> help, and you can use both together:

- <Ui k="baseplate.magnetCrushRibs" /> adds eight ridges inside each hole. The ridges crush as you push the magnet in.
- <Ui k="baseplate.magnetChamfer" /> adds a 45° lead-in at the top of each hole, so the magnet goes in straight.

Each ridge stands 0.3 mm into the hole, so a hole that prints a little too large still grips the magnet. The bin designer has the same <Ui k="binDesigner.base.magnetCrushRibs" /> option for the magnet holes of a bin. See [Hold magnets without glue](../designer/base#hold-magnets-without-glue).

<Ui k="baseplate.magnetChamfer" /> needs <Ui k="baseplate.solidFloor" />. A plate without it has a hollow floor, which leaves too little wall around each hole for a lead-in. The lead-in is 0.8 mm deep, so a hole must be deeper than that to get it. <Ui k="baseplate.magnetCrushRibs" /> works on either floor.

### Push magnets out from below

A magnet held by crush ribs or glue is hard to get out again. Turn on <Ui k="baseplate.magnetPopOutHoles" /> under <Ui k="common.customize" />. Each magnet hole then gets a small hole through the floor under it. Push the magnet out from the underside with a pin.

The small hole is 2 mm wide at most, so the floor still holds the magnet. The <Ui k="baseplate.mountMagnets.label" /> holes don't get one.

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

Set the diameter to the magnet diameter plus the clearance for your printer, usually 0.2 to 0.5 mm. The diameter changes in steps of 0.05 mm. The depth starts at the underside, so a magnet of that height sits flush with the bottom. The Layout Tool spreads the magnets evenly over each printed piece, and a high count fills every place that it can.

It skips a crossing on a split seam, on the plate edge, or where a screw goes. If a hole is too deep or too wide for the plate, a warning appears below the depth.

Under <Ui k="common.customize" />, the underside holes also have <Ui k="baseplate.mountMagnets.crushRibs" /> and <Ui k="baseplate.magnetChamfer" />. They work the same as for <Ui k="baseplate.magnetHoles" />. A hole gets the lead-in only where the wall around it has room for it.

<Screenshot id="baseplates-magnets-underside" alt="The preview looks at the plate from below. Underside magnets is turned on in the Base section, and the underside then gets four magnet holes, each where four pockets meet." spec="Baseplate generator, 4 by 3 plate. Orbit the preview to look up at the underside. The plate, then a close-up of the Base section where Underside magnets is turned on, then the plate again with its holes." />

## Screw the plate down

<Ui k="baseplate.screwHoles.label" /> adds vertical holes, so you can screw the plate to a drawer bottom, a bench or a wall. They're **clearance holes**, not pilot holes, so the screw goes through freely. A thread that bites into the plastic holds the plate off the surface.

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

## When it goes wrong

### The magnet and screw settings are gone

Turn off <Ui k="baseplate.stackPrint.enable" />. The settings come back with the values that you set.

A stack prints most plates upside down, and the holes can't print that way without supports. So while the stack is on, <Ui k="baseplate.sectionBase" /> hides all three options. See [What a stack changes](./eco-and-stack-printing#what-a-stack-changes).

### Magnets fall out of the plate

Turn on <Ui k="baseplate.magnetCrushRibs" /> in the <Ui k="common.customize" /> fold of <Ui k="baseplate.magnetHoles" />. For underside magnets, turn on <Ui k="baseplate.mountMagnets.crushRibs" /> in the fold of <Ui k="baseplate.mountMagnets.label" />. Print the plate again, and press the magnets in.

A plain round hole holds a magnet only when its size suits your printer exactly. The ribs crush as the magnet goes in, so it holds without glue. See [Fit and tolerances](../printing/fit-and-tolerances).

### Some underside magnet holes are missing

Read the warning below <Ui k="baseplate.mountMagnets.depth.label" />. It gives the deepest hole that fits at your diameter. Make the depth that value or less, or use a smaller magnet.

The holes sit in the solid corners where four pockets meet, and a wide or deep hole doesn't fit there. The Layout Tool then skips that hole. It also skips a corner on a split seam, on the plate edge, or where a screw goes. <Ui k="baseplate.magnetHoles" /> and <Ui k="baseplate.solidFloor" /> make the plate taller, so a deeper hole fits.

### A piece of the plate gets no screws

Lower <Ui k="baseplate.screwHoles.edgeInset.label" /> until the piece gets its screws.

The inset keeps screws away from each piece edge, by the number of grid units that you set. On a small piece, the inset covers the whole piece, so no place stays for a screw.

### A bin sits high on the plate

Look for a screw head or a magnet that stands up from the plate. See [A bin sits high on one spot](../printing/troubleshooting#a-bin-sits-high-on-one-spot).

## Next steps

- [Split for your print bed](./splitting): every split piece gets its own screws and underside magnets.
- [Eco plates and stack printing](./eco-and-stack-printing): see what makes a plate taller, and which options a stack removes.
- [The base](../designer/base): add the matching magnet holes to your bins.
- [Fit and tolerances](../printing/fit-and-tolerances): tune the fit of parts for your printer.
