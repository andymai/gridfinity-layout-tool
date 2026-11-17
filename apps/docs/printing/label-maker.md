---
title: Labels for a label maker
description: 'Turn a list into paper labels for a Brother P-touch, DYMO, Niimbot or Phomemo label maker, with part numbers on a second line.'
sources:
  - src/features/labels/
  - src/features/print-export/components/PrintModal/PrintModal.tsx
---

# Labels for a label maker

A paper label tells you what's in a bin, and a label maker prints one in seconds. The Gridfinity Layout Tool turns a list into labels for your label maker. Each label downloads as an image made for your printer, in the same type as the labels you print on bins.

## Make labels from a list

1. In the header, click <Ui k="header.print" />, then click <Ui k="print.makeLabels" />. Or press <kbd>Ctrl</kbd>+<kbd>K</kbd> and type labels.
2. Under <Ui k="labels.printer" />, pick your printer. Under <Ui k="labels.media" />, pick the tape or the labels in it.
3. Type or paste your list in <Ui k="labels.paste" />, one label on each line, then click <Ui k="labels.paste.add" />.
4. Look at the preview of each label. Change its text, its second line or its number of <Ui k="labels.row.copies" /> in its row.
5. Click <Ui k="labels.download" />. With more than one label, the button says <Ui k="labels.downloadZip" /> and you get one ZIP.

## Paste a parts order

Copy the rows of a spreadsheet or of a supplier's order page, and paste them. The Layout Tool finds the column of part numbers and puts each part number on a second line. It sets them in a font where 0 and O look different, so you reorder the right part. The longest text in each row becomes the label.

A typed line works too. When a line starts or ends with a McMaster-Carr part number, such as `91290A113 Socket head screw`, the part number goes on the second line.

The Layout Tool does not look up part numbers. Paste each description with its part number.

## Choose the length

Label-maker tape has no fixed length, so you choose one under <Ui k="labels.length" />:

- <Ui k="labels.length.fit" /> makes each label as long as its text.
- 1U, 2U and 3U make each label 36, 78 or 120 mm long, to fit a bin that many grid units wide. Long text breaks onto two or three lines.

Die-cut labels, such as the 12 × 40 mm labels of a Niimbot D11, have a fixed size, so this setting does not show.

When text does not fit at a size you can read, its row shows a warning, and the download leaves that label out. Make the text shorter, or pick a longer label.

## Print the labels

Each image has one pixel for each dot of your printer's head, in pure black and white, so small text stays sharp. Open it as an image in the app for your printer, and print it at full size.

## Your list stays in this browser

The list stays in this browser until you clear it. It is not part of a layout, so it does not sync to your other devices and is not in a share link.

## Next steps

- [Labels and text](../designer/labels-and-text): print the text on the bin itself.
- [Swappable label plates](../designer/label-plates): print labels that click into the bin.
- [The print list and ZIP export](./print-list-and-zip): print a paper plan of the drawer.
