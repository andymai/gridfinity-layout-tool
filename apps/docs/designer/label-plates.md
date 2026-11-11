---
title: Swappable label plates
description: 'Add label sockets to a bin, print label plates on their own, and change a label without a new bin.'
sources:
  - src/shared/constants/labelPlates.ts
  - src/features/bin-designer/components/panel/LabelTabsSection/
  - src/features/bin-designer/components/panel/LabelIconPicker/
  - src/features/bin-designer/hooks/useLabelPlateExport.ts
  - src/features/bin-designer/components/CutoutWorkspace/CutoutSocketControls.tsx
  - src/features/bin-designer/components/CutoutWorkspace/CutoutPlateSettings.tsx
  - src/features/bin-designer/components/panel/WallsSection/WallSurfaceSection.tsx
---

# Swappable label plates

A swappable label plate is a small printed plate that clicks into a socket on the bin. When the contents of a compartment change, you print a new plate, not a new bin. The Gridfinity Layout Tool cuts the sockets, makes one plate for each socket, and exports the plates as one file.

The sockets follow a common click-in label standard, so plates from other makers that follow the same standard also fit.

## Turn on label sockets

1. In the bin designer, select <Ui k="binDesigner.category.interior" /> in the panel.
2. Turn on <Ui k="binDesigner.labelTabs" />.
3. Under <Ui k="binDesigner.tabMode" />, select <Ui k="binDesigner.tabMode.socket" />.
4. Type the text for each plate in the <Ui k="binDesigner.labelText" /> list.

Each label tab now has a socket in its top face. A socket tab must be at least 14 mm deep, so the tab depth can grow when you switch. If no standard plate fits in the bin, the panel disables <Ui k="binDesigner.tabMode.socket" /> and tells you that the bin is too narrow.

<Screenshot id="designer-label-plates-socket-list" alt="The Label tabs section in Swappable label mode, with a plate width and an icon picker under each caption." spec="Bin designer, 4x1 bin with 2 compartments, Interior page, Label tabs on, Swappable label, captions M3 and M4, a bolt icon on the first row. Crop to the Label style control, the caption list and the Socket style control." />

## Pick a socket style

Under <Ui k="binDesigner.socketStyle" />, pick one of two styles. Both take the same plates.

| Style                                           | How the plate goes in                                                                               |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| <Ui k="binDesigner.socketStyle.clickIn" />      | You press the plate down into the socket, and small ribs hold it. This is the default.              |
| <Ui k="binDesigner.socketStyle.slideChannel" /> | The plate slides in from the compartment side, under retaining lips, and stops behind a small bump. |

To lift a click-in plate out again, turn on <Ui k="binDesigner.socketRemovalHole" />. It cuts a small notch at the socket edge, so a tweezer tip reaches under the plate.

## Set the plate width and icon

Plates come in three standard widths. Under each caption, a menu shows the widths that fit that compartment, and Auto picks the widest one that fits.

| Width | Plate size  |
| ----- | ----------- |
| 1U    | 36 × 11 mm  |
| 2U    | 78 × 11 mm  |
| 3U    | 120 × 11 mm |

All plates are 1.2 mm thick. If the compartments are too narrow for one plate each, each row gets one full-width plate.

Next to the width menu, an icon picker adds a small picture to the plate. It holds 45 icons in three groups: <Ui k="binDesigner.plateIcon.group.fastener" />, <Ui k="binDesigner.plateIcon.group.tooling" /> and <Ui k="binDesigner.plateIcon.group.kitchen" />. Type in <Ui k="binDesigner.plateIcon.searchPlaceholder" /> to find one, or pick <Ui k="binDesigner.plateIcon.none" />. A full-width row plate carries text only.

The plate text follows the <Ui k="binDesigner.type.heading" /> section and its finish. An emboss finish gives raised letters, a flat finish gives letters level with the plate, and every other finish cuts the letters into the plate. See [Labels and text](./labels-and-text).

## Tune the fit for your printer

Each printer prints a slightly different size, so a plate that clicks on one machine can be loose on another.

1. Open the <Ui k="binDesigner.plateFitGroup" /> group in the label section.
2. Click <Ui k="binDesigner.fitSample.button" /> and download the card.
3. Print the card flat, without supports, with the nozzle, material and settings that you use for your bins.
4. Click the plate on the card into each socket. Find the socket that holds the plate firmly and releases it cleanly.
5. Type the value embossed on that socket into <Ui k="binDesigner.plateFitOffset" />.

The card has five sockets that step the offset from −0.10 to +0.10 mm. The offset field goes from −0.20 to +0.50 mm. A negative value makes the fit tighter, and a positive value makes it looser. The offset describes your printer, so the cutout sockets below use the same value.

## Export the plates

The label section lists every plate under <Ui k="binDesigner.plates.title" />, with its width, text and icon.

- Turn on <Ui k="binDesigner.plates.showInPreview" /> to see the plates seated in the bin.
- Click <Ui k="binDesigner.plates.preview" /> to turn the plate set in a small 3D view.
- Click <Ui k="binDesigner.plates.export" />, pick 3MF, STL or STEP, and download one file with a plate for each socket.

The exported text depth snaps to whole layers, so one filament change at the right layer prints two-color labels. With multi-color on, a 3MF file prints the plate in the label tab color and the text in the Text color. See [Colors](./colors).

A layout export also includes the plates for every bin that has sockets, and the print list shows how many plates to print. See [Print list and ZIP export](../printing/print-list-and-zip).

<Screenshot id="designer-label-plates-export" alt="The Label plates list with its plate count, the Show in 3D preview switch and the Preview plates and Export plates buttons." spec="Bin designer, the same 4x1 socket bin as above, Interior page, scroll to the Label plates list. Crop to the list and the two buttons." />

## Add label slots to the outer walls

A label slot is a vertical slot in an outer wall that takes a 1U plate. The plate drops in from the top and shows through a window in the wall. [Add label slots](./walls#add-label-slots) gives the steps and the limits. The plates for the slots appear in a plate list with the same export buttons.

## Add sockets on cutout bins

A bin with custom cutouts can carry label sockets beside its cutouts.

1. Open the cutout editor and select a cutout.
2. Open the <Ui k="binDesigner.cutouts.section.label" /> section and select <Ui k="binDesigner.cutoutLabelMode.socket" />.
3. Type the plate text.
4. Set <Ui k="binDesigner.cutoutSocket.width" />, <Ui k="binDesigner.cutoutSocket.icon" /> and <Ui k="binDesigner.cutoutSocket.orientation" />.

The socket goes at the label position beside the cutout, in solid material. If there is no room, the panel tells you to move the cutout or to try a different position. One bin holds up to 32 sockets. All copies in a repeat share one plate. With no cutout selected, the board settings show the plate count, the plate fit and the export buttons. For the other label options of a cutout, see [Add a label](../cutouts/basics#add-a-label).

## Next steps

- [Labels and text](./labels-and-text): set the font and finish that the plates use.
- [Colors](./colors): print the plate text in a second filament.
- [The print list and ZIP export](../printing/print-list-and-zip): print the plates for a whole drawer at once.
- [Fit and tolerances](../printing/fit-and-tolerances): tune other fits for your printer.
