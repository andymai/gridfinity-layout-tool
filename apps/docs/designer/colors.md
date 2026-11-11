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
---

# Colors

With multi-color on, each part of a bin gets its own color: the body, the stacking lip, the label tabs, the text and more. The Gridfinity Layout Tool writes each color as a separate filament in a 3MF file. In your slicer, you assign each filament to a slot. Use this page to turn on multi-color, set each color zone, and keep text readable.

For how the 3MF file carries the colors, see [Multi-color printing](../concepts/multi-color).

## Turn on multi-color

1. In the bin designer, select <Ui k="binDesigner.category.style" /> in the panel.
2. Under <Ui k="binDesigner.style.section.color" />, turn on <Ui k="binDesigner.group.colors" />.
3. Click a color zone to open its color picker.
4. Pick a color.

The 3D preview shows the colors at once. All zones start in the same light gray, so the bin looks the same until you change a zone.

Only a 3MF file keeps the colors. STL and STEP files carry no color data, so the export dialog disables them for a multi-color design.

<Screenshot id="designer-colors-zones" alt="The Multi-color section with the Exterior, Interior, Add-ons and Text groups, next to a bin with a colored lip and label tabs." spec="Bin designer, 2x2x3 bin with 2 compartments, stacking lip, label tabs with captions, a scoop. Style page, Multi-color on, body light gray, lip orange, label tab white, text black. Crop to the Color section and the preview." />

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

### Split the stacking lip

The stacking lip can carry more than one color. Turn on <Ui k="binDesigner.colors.lip.splitZones" /> under the lip row. Then set <Ui k="binDesigner.colors.lip.cornersLabel" /> to 1, 2 or 4 and <Ui k="binDesigner.colors.lip.bandsLabel" /> to 1, 2 or 4. Corners split the lip around the bin, and bands split it from bottom to top. The panel keeps every cell color, so a change back to more cells restores the colors that you set.

### Label tab supports

The supports under a label tab print in the body color by default. Each support layer in a second color costs a filament change, so this saves print time. To print the supports in the label tab color, turn off <Ui k="binDesigner.labelSupportsBodyColor" /> in the label section.

## Add accent bands

An accent band recolors a strip at the top or the bottom of the bin body. It works with or without a stacking lip and feet.

1. Under <Ui k="binDesigner.colors.accent.title" />, turn on <Ui k="binDesigner.colors.zone.topAccent" />, <Ui k="binDesigner.colors.zone.bottomAccent" />, or both.
2. Set the <Ui k="binDesigner.colors.accent.height" />. A new band is 2 mm high.
3. Pick the band color.

The switch above the bands shows the height in <Ui k="binDesigner.colors.accent.unit.mm" /> or in <Ui k="binDesigner.colors.accent.unit.layers" /> at your layer height. A band covers every zone in its strip except the text. Bands color the bin body only, not the lid or separate feet.

## Set the Text color

The <Ui k="binDesigner.textColor" /> covers all lettering: label tab text, plate text and icons, cutout labels, and wall, floor and lid text. You can set it in the Text group here, or directly under each finish picker in the text controls.

Pick a Text color that is different from the surface under the letters. Engraved and embossed letters show by shape in one color, but [flat letters](./labels-and-text#pick-a-text-finish) show only by color.

When flat letters have the same color as their surface, the panel warns that the letters will not show. Click <Ui k="binDesigner.textColor.useContrasting" /> to pick a color that shows.

## Work faster with the color tools

- **Eyedropper.** Click the pipette button, then click any part in the 3D preview to change its color. Press <kbd>Esc</kbd> to stop.
- **<Ui k="binDesigner.colors.matchAllToBody" />.** In the <Ui k="binDesigner.colors.actions" /> menu, this sets the lip, label tab, base, scoop and divider zones to the body color. The text, lid and accent band colors stay.
- **<Ui k="binDesigner.colors.swap.enter" />.** In the same menu, pick one zone and then a second zone to swap their colors.
- **<Ui k="binDesigner.colors.suggest" />.** In a color picker, the sparkle button offers colors that go with the body color.

The color picker also has <Ui k="binDesigner.colors.presets" /> of common filament colors, <Ui k="binDesigner.colors.usedInDesign" />, a hex field and <Ui k="binDesigner.colors.resetToDefault" />.

In the label section, the label tab color picker turns on multi-color for you when you pick a color that differs from the body.

## Save a palette

A palette stores one set of zone colors so you can use it on other bins.

1. Open the <Ui k="binDesigner.colors.actions" /> menu.
2. Click <Ui k="binDesigner.colors.savePalette" />.
3. Type a name and save.

To use a palette, open the same menu and click the palette under <Ui k="binDesigner.colors.palettes" />. A palette sets the body, lip, label tab, base, scoop, divider and text colors. The Layout Tool keeps your 20 newest palettes in your settings, so they are there for every design.

## Next steps

- [Multi-color printing](../concepts/multi-color): learn how the colors reach your slicer.
- [Labels and text](./labels-and-text): pick a finish that shows in two colors.
- [Slicers](../printing/slicers): set up the filaments in your slicer.
- [File formats](../printing/file-formats): see which formats keep color.
