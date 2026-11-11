---
title: Colors
description: 'Give each part of a bin its own filament color, add accent bands, and save color sets as palettes.'
sources:
  - src/features/bin-designer/types/featureColors.ts
  - src/features/bin-designer/components/panel/ColorsSection/
  - src/features/bin-designer/components/panel/shared/TextColorControl.tsx
  - src/features/bin-designer/components/panel/shared/FlatTextClashWarning.tsx
  - src/features/bin-designer/utils/flatTextContrast.ts
  - src/features/bin-designer/components/panel/LabelTabsSection/LabelColorControls.tsx
  - src/features/bin-designer/components/ExportDialog/ExportDialog.tsx
---

# Colors

Got a printer that takes more than one filament? Give each part of a bin its own color: an orange stacking lip, white label tabs, black text. The Gridfinity Layout Tool writes each color as a separate filament in a 3MF file. In your slicer, you assign each filament to a slot.

For how the 3MF file carries the colors, see [Multi-color printing](../concepts/multi-color).

## Turn on multi-color

1. In the bin designer, open the <Ui k="binDesigner.group.finishing" /> group.
2. Under <Ui k="binDesigner.style.section.color" />, turn on <Ui k="binDesigner.group.colors" />.
3. Click a color zone and pick a color.

The 3D preview shows each change right away. All zones start in the same light gray, so the bin looks the same until you change a zone.

Only a 3MF file keeps the colors. STL and STEP files carry no color data, so the export dialog turns them off for a multi-color design. To get them back, see [Go back to one color](#go-back-to-one-color).

<Screenshot id="designer-colors-zones" alt="Multi-color is turned on and the Exterior zones show. The Stacking lip zone is clicked and Orange is picked. The bin then shows an orange lip, white label tabs and black text." spec="Bin designer, 2 x 2 x 3 bin with 2 compartments, stacking lip, label tabs with captions, a scoop. Label tab zone white and Text zone black. Close-up of the Color section in the Finishing group: turn on Multi-color, click the Stacking lip zone, pick Orange. Cut to the bin." />

## Color zones

The panel shows a zone only when the bin has that part. For example, the <Ui k="binDesigner.colors.scoop" /> row shows only when the bin has scoops.

| Group                                        | Zone                                   | What it colors                                                              |
| -------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| <Ui k="binDesigner.colors.group.exterior" /> | <Ui k="binDesigner.colors.body" />     | The walls and floor, and every part that has no zone of its own.            |
| <Ui k="binDesigner.colors.group.exterior" /> | <Ui k="binDesigner.colors.lip" />      | The stacking lip at the top of the bin.                                     |
| <Ui k="binDesigner.colors.group.exterior" /> | <Ui k="binDesigner.colors.base" />     | The Gridfinity feet under the bin. A base with no sockets has no Base zone. |
| <Ui k="binDesigner.colors.group.interior" /> | <Ui k="binDesigner.colors.scoop" />    | The finger scoop ramps.                                                     |
| <Ui k="binDesigner.colors.group.interior" /> | <Ui k="binDesigner.colors.dividers" /> | The walls between compartments.                                             |
| <Ui k="binDesigner.colors.group.addons" />   | <Ui k="binDesigner.colors.labelTab" /> | The label tab ledges and swappable label plates.                            |
| <Ui k="binDesigner.colors.group.addons" />   | <Ui k="binDesigner.colors.lid" />      | The lid. A stackable lid also gets a grid for its own top lip.              |
| <Ui k="binDesigner.colors.group.text" />     | <Ui k="binDesigner.colors.text" />     | All the letters and plate icons on the bin and the lid.                     |

Two more things can carry a color of their own:

- A cutout, in the <Ui k="binDesigner.cutouts.section.color" /> section of the cutout editor. See [Color zones](../concepts/multi-color#color-zones).
- A compartment in the <Ui k="binDesigner.openBentoWorkspace" />. See [Draw compartments with Bento](./compartments#draw-compartments-with-bento).

### Split the stacking lip

The stacking lip can carry more than one color. Turn on <Ui k="binDesigner.colors.lip.splitZones" /> under the lip row. Then set <Ui k="binDesigner.colors.lip.cornersLabel" /> to 1, 2 or 4 and <Ui k="binDesigner.colors.lip.bandsLabel" /> to 1, 2 or 4. Corners split the lip around the bin, and bands split it from bottom to top. The panel remembers every cell color, so if you go back to more cells, your colors come back too.

### Label tab supports

The supports under a label tab print in the body color by default. Each support layer in a second color costs a filament change, so this saves print time. To print the supports in the label tab color, turn off <Ui k="binDesigner.labelSupportsBodyColor" /> in the label section.

## Add accent bands

An **accent band** recolors a strip at the top or the bottom of the bin body. Use it to color-code a set of bins. It works with or without a stacking lip and feet.

1. Under <Ui k="binDesigner.colors.accent.title" />, turn on <Ui k="binDesigner.colors.zone.topAccent" />, <Ui k="binDesigner.colors.zone.bottomAccent" />, or both.
2. Set the <Ui k="binDesigner.colors.accent.height" />. A new band is 2 mm high.
3. Pick the band color.

The switch above the bands shows the height in <Ui k="binDesigner.colors.accent.unit.mm" /> or in <Ui k="binDesigner.colors.accent.unit.layers" /> at your layer height. A band covers every zone in its strip except the text. Bands color the bin body only, not the lid or separate feet.

## Set the Text color

The <Ui k="binDesigner.textColor" /> covers all lettering: label tab text, plate text and icons, cutout labels, and wall, floor and lid text. Set it in the Text group here, or right under each finish picker in the text controls.

Pick a <Ui k="binDesigner.textColor" /> that stands out from the surface under the letters. Engraved and embossed letters show by their shape, even in one color. [Flat letters](./labels-and-text#pick-a-text-finish) show only by color.

When flat letters have the same color as their surface, the panel warns you that they won't show. Click <Ui k="binDesigner.textColor.useContrasting" /> to pick a color that does.

## Work faster with the color tools

| Tool                                         | Where                                          | What it does                                                                                                         |
| -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Eyedropper                                   | The pipette button                             | Click any part in the 3D preview to change its color. Press <kbd>Esc</kbd> to stop.                                  |
| <Ui k="binDesigner.colors.matchAllToBody" /> | The <Ui k="binDesigner.colors.actions" /> menu | Sets the lip, label tab, base, scoop and divider zones to the body color. The text, lid and accent band colors stay. |
| <Ui k="binDesigner.colors.swap.enter" />     | The same menu                                  | Pick one zone and then a second zone to swap their colors.                                                           |
| <Ui k="binDesigner.colors.suggest" />        | The sparkle button in a color picker           | Offers colors that go with the body color.                                                                           |

The color picker also has <Ui k="binDesigner.colors.presets" /> of common filament colors, the colors <Ui k="binDesigner.colors.usedInDesign" />, a hex field and <Ui k="binDesigner.colors.resetToDefault" />.

In the label section, the label tab color picker turns on multi-color for you when you pick a color that differs from the body.

## Save a palette

Found a color set you like? A **palette** stores one set of zone colors so you can use it on other bins.

1. Open the <Ui k="binDesigner.colors.actions" /> menu.
2. Click <Ui k="binDesigner.colors.savePalette" />.
3. Type a name and save.

To use a palette, open the same menu and click the palette under <Ui k="binDesigner.colors.palettes" />. A palette sets the body, lip, label tab, base, scoop, divider and text colors. The Layout Tool keeps your 20 newest palettes in your settings, so they're there for every design.

## Go back to one color

Want an STL or a STEP file of a colored bin? The design must be single-color first. The export dialog treats a design as multi-color in two cases:

- <Ui k="binDesigner.group.colors" /> is on, and a zone in use has a color that differs from the body.
- A cutout or a Bento compartment has its own color. This counts even with <Ui k="binDesigner.group.colors" /> off.

To make the design single-color:

1. Turn off <Ui k="binDesigner.group.colors" />.
2. In the cutout editor, open the <Ui k="binDesigner.cutouts.section.color" /> section of each colored cutout and pick <Ui k="binDesigner.cutouts.color.off" />.
3. In the <Ui k="binDesigner.openBentoWorkspace" />, do the same for each colored compartment.

Your zone colors stay saved, so you can turn <Ui k="binDesigner.group.colors" /> back on later. <Ui k="binDesigner.colors.matchAllToBody" /> doesn't make a design single-color by itself. It leaves the text, lid and accent band colors as they are, and it doesn't touch cutout or compartment colors.

## When it goes wrong

### STL and STEP are greyed out in the export dialog

Export as 3MF to keep the colors. For an STL or a STEP file, make the design single-color first. See [Go back to one color](#go-back-to-one-color).

STL and STEP files carry no color data. Is only STEP greyed out? Then the bin has an imported mesh cutout, and STEP can't hold that.

### Flat letters don't show

Click <Ui k="binDesigner.textColor.useContrasting" /> under the warning. It picks a <Ui k="binDesigner.textColor" /> that stands out from the surface.

Flat letters sit level with the surface, so only their color shows them. When the text color matches the surface, the letters disappear.

### A split bin prints in one color

Turn off <Ui k="binDesigner.splitExport.enableSplit" /> in the export dialog to keep the colors. If the bin is too large for your print bed, make it smaller, or print it in one color.

A split export writes each piece in one color. The export dialog warns you before it drops the colors. See [Fitting the print bed](../concepts/print-bed-fit#when-a-bin-is-too-large).

### The slicer shows only one filament

Add the filaments in your slicer by hand, or update Bambu Studio to 2.9.1 or later. Then assign each filament to the correct slot.

Bambu Studio 2.8 does not add the filaments of a 3MF file when it opens the file on an empty plate. The colors are still in the file. See [The colors are wrong](../printing/troubleshooting#the-colors-are-wrong).

## Next steps

- [Multi-color printing](../concepts/multi-color): learn how the colors reach your slicer.
- [Labels and text](./labels-and-text): pick a finish that shows in two colors.
- [Slicer setup](../printing/slicers): set up the filaments in your slicer.
- [File formats](../printing/file-formats): see which formats keep color.
