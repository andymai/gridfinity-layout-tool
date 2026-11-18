---
title: Labels for a label maker
description: 'Make labels for a Brother P-touch, DYMO, Niimbot or Phomemo label maker from a typed or pasted list.'
sources:
  - src/features/labels/
  - src/features/print-export/components/PrintModal/PrintModal.tsx
  - src/shared/hooks/useLabelsRouting.ts
---

# Labels for a label maker

The Labels dialog turns a list into one image for each label, sized for your label maker. You print the images from your printer's app. It works with Brother P-touch and DYMO LabelManager tape, and with Niimbot D11, D110 and Phomemo D30 labels.

## Make labels

1. Open [the label maker](https://gridfinitylayouttool.com/labels). It needs no layout. In the layout editor, you can also click <Ui k="header.print" />, then <Ui k="print.makeLabels" />, or press <kbd>Ctrl</kbd>+<kbd>K</kbd> and type label.
2. Pick your printer under <Ui k="labels.printer" />, and the tape or labels it holds under <Ui k="labels.media" />.
3. Type or paste your list in <Ui k="labels.paste" />, one label on each line, and click <Ui k="labels.paste.add" />.
4. Edit a label in its row. The preview shows it as it prints.
5. Click <Ui k="labels.download" />. More than one label downloads as a ZIP.

<Screenshot id="printing-label-maker-dialog" alt="The Labels dialog with Niimbot D11 / D110 and 12 × 40 mm labels. Four McMaster-Carr parts each show a preview with the description above the part number." spec="Layout editor, desktop 1440 by 900 px. The list holds four McMaster-Carr parts, the printer is Niimbot D11 / D110 with 12 × 40 mm labels. Click Print in the header, then Labels for a label maker. Crop to the dialog." />

Open each image in your printer's app and print it at full size. If you set an export folder in Settings, the files go there.

## Paste a parts order

Paste rows copied from a spreadsheet or an order page. The part numbers go on a second line, in a font where 0 and O look different. The longest text in each row becomes the label.

<Screenshot id="printing-label-maker-paste" alt="Four rows of a parts order are pasted into Add labels and added to the list. Each row gets a preview with the part number under the description. Then 1U makes each label 36 mm long, and the descriptions wrap." spec="Clip. The Labels dialog with an empty list and Brother P-touch 12 mm tape. Paste four tab-separated McMaster-Carr rows, click Add to list, then click 1U. Crop to the dialog." />

In a typed line, a McMaster-Carr part number at the start or end goes on the second line: `91290A113 Socket head screw`.

The dialog does not look up part numbers, so paste the descriptions with them. Text longer than 120 characters, or a second line longer than 40, is cut at a word and ends with an ellipsis (…).

## Print more than one copy

Need the same label on more than one bin? Set <Ui k="labels.row.copies" /> in the row of that label. Each row starts at 1, and the highest count is 99.

The download still holds one image for each label, not one for each copy. A count above 1 goes into the file name, for example `03-m3-screws-x4.png`. Print that number of copies from your printer's app.

## Choose the length

Tape has no fixed length. Under <Ui k="labels.length" />:

- <Ui k="labels.length.fit" />: each label is as long as its text.
- 1U, 2U or 3U: each label is 36, 78 or 120 mm long, to fit a bin that many grid units wide. Long text wraps.

Die-cut labels have a fixed size, so this setting does not show. On 6 mm tape the part number goes after the name, on the same line.

## Labels left out of the download

A row shows a warning, and the download skips that label, when:

- the label has no text
- the text does not fit at a size you can read: shorten it, or pick a longer label
- the font has no letters for some of the text, such as Cyrillic or Chinese

If the label fonts do not load, for example offline, the dialog says so. Click <Ui k="error.tryAgain" /> when you are back online.

## Where the list is kept

The list stays in this browser until you clear it. It is not part of a layout, so it does not sync to your other devices or go into share links.

## Next steps

- [Labels and text](../designer/labels-and-text): print the text on the bin itself.
- [Swappable label plates](../designer/label-plates): print labels that click into the bin.
- [The print list and ZIP export](./print-list-and-zip): print a paper plan of the drawer.
