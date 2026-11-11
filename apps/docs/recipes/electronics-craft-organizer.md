---
title: An electronics and craft organizer
description: 'Sort small parts into compartments with swappable label plates, printed in two colors.'
sources:
  - src/shared/utils/labelSocketPlan.ts
  - src/shared/constants/labelPlates.ts
  - src/shared/utils/placedCaption.ts
  - src/shell/layoutExport/planLabelPlateExport.ts
  - src/features/bin-designer/hooks/useLabelPlateExport.ts
  - src/features/bin-designer/types/featureColors.ts
  - src/features/bin-designer/utils/compartmentDimensions.ts
  - src/shared/utils/drawerFit.ts
---

# An electronics and craft organizer

Resistors, LEDs, beads and buttons all want small compartments, and the mix keeps changing. This recipe gives every compartment a label plate that clicks in and out. When the contents change, you print a new plate, not a new bin. Print the text in a second color, and the labels stand out.

<Screenshot id="recipes-electronics-craft-organizer-hero" alt="A long drawer layout in 3D with divided parts trays at the front and bead boxes, tape bins and a pen bin at the back, in two category colors." spec="Layout editor, desktop 1440 px, 3D preview expanded with Space, isometric view from the front right. Layout with a 7 x 12 grid, measured size 295 x 522 mm, one layer, all bins 3u. Category Electronics on the front bins, category Craft on the back bins. Front six rows: four 3 x 2 parts trays with 3 columns and 2 rows of compartments, two 3 x 2 fine-parts trays with 4 columns and 2 rows, and three 1 x 2 bins in the right column. Back six rows: three 2 x 2 bead boxes with 2 columns and 2 rows, two 3 x 4 tape bins, and one 1 x 6 pen bin in the right column. All label tabs in Swappable label mode so the sockets show. Crop to the preview." />

## What you need

- The inside size of your drawer. This recipe uses an IKEA Alex drawer of 295 × 522 mm. Alex drawers vary by a millimeter or two, so measure yours.
- A print bed of 256 × 256 mm. The longest bin is 1 × 6, which is 252 mm.
- About 440 m of PLA for the bins, or 1.3 spools of 1 kg. That's the bin list estimate with the default settings. The plates are tiny on top of that.
- A second filament color for the labels: in a multi-material printer, or by hand with one filament change.

## The plan

The drawer takes a 7 × 12 grid. Every bin is 3u: 25.4 mm tall with its lip, and 14 mm deep inside.

| Bins | Size  | Compartments            | Plates in each bin             | Holds                      |
| ---- | ----- | ----------------------- | ------------------------------ | -------------------------- |
| 4    | 3 × 2 | 3 × 2, about 40 × 40 mm | 6 of size 1U                   | LEDs, resistors, headers   |
| 2    | 3 × 2 | 4 × 2, about 30 × 40 mm | 2 of size 3U, one for each row | Tiny parts in sets         |
| 3    | 1 × 2 | 1                       | 1 of size 1U                   | Wire, jumpers, batteries   |
| 3    | 2 × 2 | 2 × 2, about 40 × 40 mm | 4 of size 1U                   | Beads and buttons          |
| 2    | 3 × 4 | 1                       | 1 of size 3U                   | Tape rolls and glue sticks |
| 1    | 1 × 6 | 1                       | 1 of size 1U                   | Pens and scissors          |

That's 46 plates: 40 of size 1U (36 × 11 mm) and 6 of size 3U (120 × 11 mm).

## Step 1: Size the drawer

The [IKEA Alex page](https://gridfinitylayouttool.com/gridfinity-ikea-alex) has a link that opens a layout sized to this drawer. To use your own size instead:

1. In the [layout editor](https://gridfinitylayouttool.com/), click <Ui k="drawerDims.addMeasured" />, type your width, depth and height, and press <kbd>Enter</kbd>.
2. Click <Ui k="drawerDims.suggestionUse" /> on the card.

For 295 × 522 mm, the grid is 7 × 12, or 294 × 504 mm. That leaves 1 mm across and 18 mm front to back. If your drawer measures under 294 mm wide, the card offers 6.5 units in half-grid mode instead.

## Step 2: Draw the bins

Put electronics in the front rows and craft in the back rows. The bottom of the grid is the front of the drawer.

- Front four rows: four parts trays, two across and two deep.
- Next two rows: the two fine-parts trays.
- Right column, front six rows: the three 1 × 2 bins.
- Back six rows: the bead boxes, then the tape bins, and the 1 × 6 pen bin in the right column.

A new layout has five categories. In the <Ui k="common.categories" /> group, rename one to Electronics and one to Craft. Select the front bins and click Electronics, then do the same for the back bins and Craft. See [Categories and colors](../layouts/categories).

## Step 3: Design a parts tray with plates

1. Select a parts tray, and click <Ui k="designLinking.inspector.createDesign" /> under <Ui k="designLinking.inspector.linkedDesign" />.
2. In the <Ui k="binDesigner.group.interior" /> group, set <Ui k="binDesigner.columns" /> to 3 and <Ui k="binDesigner.rows" /> to 2.
3. Turn on <Ui k="binDesigner.labelTabs" />, and pick <Ui k="binDesigner.tabMode.socket" /> under <Ui k="binDesigner.tabMode" />.
4. Type a caption for each compartment in the <Ui k="binDesigner.labelText" /> list, for example LED 5mm red.
5. Turn on <Ui k="binDesigner.socketRemovalHole" />, so a tweezer tip can lift a plate out later.

<Screenshot id="recipes-electronics-craft-organizer-plates" alt="A 3 by 2 parts tray with six compartments, each with a white label plate and black text, beside the label section with its six captions." spec="Bin designer, desktop 1440 px, 3 x 2 x 3u design, Grid dividers with 3 columns and 2 rows. Interior group open, Label tabs on, Swappable label, six captions such as LED 5mm red, LED 5mm green, 220R, 1k, 10k, 100k, Removal hole on. Multi-color on with Label tab white and Text color black. Show in 3D preview on, so the plates sit in the sockets. Crop to the label section and the preview." />

Each compartment is about 40 mm wide, so Auto picks a 1U plate for each. The width menu and an icon picker sit under each caption.

Finish this tray before you copy it in step 6. Each copy then keeps the plate fit and the colors.

## Step 4: Test the plate fit

Every printer prints a little differently, so test one plate before you print 46 of them.

1. In the label section, open <Ui k="binDesigner.plateFitGroup" /> and click <Ui k="binDesigner.fitSample.button" />.
2. Print the card flat. It has five sockets, from −0.10 to +0.10 mm.
3. Find the socket that holds the plate firmly and lets it go cleanly. Type its value in <Ui k="binDesigner.plateFitOffset" />.

## Step 5: Print the labels in two colors

**With a multi-material printer:**

1. Open the <Ui k="binDesigner.group.finishing" /> group. Under <Ui k="binDesigner.style.section.color" />, turn on <Ui k="binDesigner.group.colors" />.
2. Set the <Ui k="binDesigner.colors.labelTab" /> zone to white, and the <Ui k="binDesigner.colors.text" /> zone to black.
3. To color-code the bins, turn on <Ui k="binDesigner.colors.zone.topAccent" /> under <Ui k="binDesigner.colors.accent.title" />, and pick blue.

A 3MF export of the plates prints each plate in the label tab color, with the text in the text color.

**With one filament:** open the <Ui k="binDesigner.type.heading" /> section in the <Ui k="binDesigner.group.finishing" /> group. Under <Ui k="binDesigner.type.advanced" />, pick <Ui k="binDesigner.textMode.emboss" /> as the finish. The plate is 1.2 mm thick, and the raised letters are a whole number of layers tall. In your slicer, add a filament change at the first layer above 1.2 mm.

## Step 6: Copy the tray for every other bin

1. Open <Ui k="binDesigner.savedDesigns" />, and use <Ui k="common.duplicate" /> on the tray design.
2. Open the copy, and change what differs: the captions, and for other bins the size and the columns.
3. Repeat for each design, then link each bin in the layout to its design with <Ui k="designLinking.inspector.linkExisting" />.

You need a copy for each tray or box with its own captions. For the craft bins, change the accent band to orange.

The fine-parts trays use 4 columns. Their compartments are about 30 mm wide, too narrow for a 1U plate each. So each row gets one 3U plate across the full width. Write one caption for the row, for example SMD 0805: 1k 10k 100k.

The 1 × 2, 3 × 4 and 1 × 6 bins have one compartment each. Make one design for each size, and leave its text box empty. Each plate then prints the <Ui k="inspector.binLabel" /> of its bin in the layout. So one design serves all three 1 × 2 bins, with three different plates.

## Step 7: Export and print

Export the layout with <Ui k="header.export" /> and <Ui k="layoutExport.download" />. Pick 3MF to keep the plate and text colors: one project file then holds the bins and the plates. With STL or STEP, the ZIP holds the bins, and the plates in a `labels/` folder. The bin list counts the plates too.

Contents changed? Change the caption in the design, or the <Ui k="inspector.binLabel" /> in the layout. Then export the plates again, and print only the new plate.

## When it goes wrong

### Plates fall out, or won't click in

A negative <Ui k="binDesigner.plateFitOffset" /> makes the fit tighter, and a positive value makes it looser. Each design keeps its own offset, so change it in every design that has sockets. See [Swappable label plates](../designer/label-plates#tune-the-fit-for-your-printer).

### The letters print in the plate color

With one filament, the change must come at the first layer of the letters. The letter height snaps to the <Ui k="settings.printLayerHeight" /> in <Ui k="sidebar.settings" />, on the <Ui k="settings.tabs.print" /> tab. Set that value to the layer height in your slicer, and export the plates again.

### The plates are not in the bin file

The plates are separate prints, so the bin file never holds them. Use <Ui k="binDesigner.plates.export" /> in the <Ui k="binDesigner.plates.title" /> list, or take them from the layout ZIP. With 3MF they are in the project file, and with STL or STEP in the `labels/` folder. See [Troubleshooting prints](../printing/troubleshooting#the-label-plates-are-not-in-the-bin-file).

## Next steps

- [Swappable label plates](../designer/label-plates): socket styles, plate widths and icons
- [Colors](../designer/colors): every color zone, accent bands and palettes
- [Slicer setup](../printing/slicers): map the colors of a 3MF file to your filaments
- [IKEA Alex drawers](https://gridfinitylayouttool.com/gridfinity-ikea-alex): the grids that fit the other Alex units
