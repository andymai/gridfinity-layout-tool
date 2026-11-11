---
title: FAQ
description: 'Short answers to common questions about the Layout Tool: cost, your data, drawer sizes, print beds, file formats and shortcuts.'
sources:
  - src/i18n/locales/en.ts
  - content/guide.md
  - src/core/constants.ts
  - src/core/baseplateDefaults.ts
  - src/core/bedFit.ts
  - docs/self-hosting.md
---

# FAQ

This page gives short answers to the questions that makers ask most about the Gridfinity Layout Tool. Each answer links to the page with the full details.

## Start

### Is the Layout Tool free? Do I need an account?

The Layout Tool is free, and you do not need an account. You can plan layouts, design bins and baseplates, and export files without one. Sign in only if you want to sync your work across devices. See [What the Layout Tool does](../introduction/what-it-does).

### What are Labs and Experimental features?

Labs features are still in development, and you turn them on in <Ui k="settings.title" /> > <Ui k="settings.tabs.labs" />. An Experimental label marks a feature that is on for everyone but can still change. See [Labs](../settings/labs).

### Can I run my own copy of the Layout Tool?

Yes. A Docker image serves the app from your own computer or server. Sharing, sign-in and the community gallery need the hosted service and do not work in your copy. See [Self-hosting with Docker](./self-hosting).

## Your data

### Where does the Layout Tool save my work?

The Layout Tool saves your layouts and designs in this browser, on this device, while you work. Sign in to sync them to your other devices. See [Your data and privacy](../introduction/your-data).

### How do I move my layouts to another computer?

Sign in with <Ui k="auth.signIn" /> on both computers, and your layouts sync. Without an account, use <Ui k="layouts.exportAll" /> in the layout manager, then import that file on the other computer. See [Accounts and sync](../sharing/accounts-and-sync).

### Can I use the Layout Tool offline?

Yes. Install the Layout Tool from your browser, and it opens without a network connection. When you go offline, your changes still save on your device. See [Install and work offline](../settings/offline).

### Can I edit a layout file by hand?

Yes. A layout file is plain JSON text with a published schema. Most code editors show completion and mark mistakes when the file points at the schema. See [Layout file format](./layout-file).

## Sizes and fit

### How do I convert my drawer to grid units?

Measure the inside width and depth of the drawer in millimeters. Divide each value by 42 and round down. For example, a drawer of 380 mm × 260 mm takes a grid of 9 × 6. See [Set up the drawer](../layouts/drawer-setup).

### What do I do with the gap at the edge of the drawer?

The baseplate can fill the gap with padding on each side. You can also let an edge bin grow into that gap, so the bin fills the drawer. See [Baseplate basics](../baseplates/basics).

### How tall is a bin of 6 units?

One height unit is 7 mm, so a bin of 6 units is 42 mm high to the top of its wall. The stacking lip adds more height above the wall. See [Units and sizes](../concepts/units).

### Do my bins fit baseplates from other Gridfinity models?

The Layout Tool builds the foot and pocket profiles to the standard Gridfinity measurements. A low-profile baseplate still takes standard bins, with less grip. See [Gridfinity dimensions](./dimensions).

### Do I need magnets?

No. Magnet holes are an option, and a new baseplate has none. Add magnet holes to the bins and to the baseplate only if you plan to fit magnets. See [Magnets and screws](../baseplates/magnets-and-screws).

## Print and export

### What happens when a bin is larger than my print bed?

The Layout Tool splits a bin or a baseplate that does not fit your print bed into pieces. A long bin that fits only from corner to corner of the bed prints in one piece. See [Fitting the print bed](../concepts/print-bed-fit).

### Which file format do I export: STL, 3MF or STEP?

Export 3MF for a bin with more than one color, because each color zone becomes a separate filament. STL holds no color. STEP cannot carry an imported STL shape. See [File formats](../printing/file-formats).

### How do I export all the bins of a layout at once?

Click <Ui k="layoutExport.button" /> in the header. You get one ZIP file with every bin linked to a saved design, and the baseplate. See [The print list and ZIP export](../printing/print-list-and-zip).

## Work faster

### Why does a keyboard shortcut do nothing?

Shortcuts do not work while the cursor is in a text field. Click an empty part of the canvas, then press the key again. See [Keyboard shortcuts](./shortcuts).

### How many steps can I undo?

The layout editor and the bin designer each keep the last 100 changes. Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo, or <kbd>Cmd</kbd>+<kbd>Z</kbd> on a Mac. See [Keyboard shortcuts](./shortcuts).

### What is the stash?

The stash is a holding area beside the grid. Put a bin there when you do not want it in the drawer yet. The Layout Tool also moves bins there when a smaller drawer has no room for them. See [Layouts, layers and the stash](../concepts/layouts-layers-stash).

## Next steps

- [Glossary](./glossary): the meaning of each term in the app.
- [Plan your first drawer](../getting-started/first-drawer): start a layout from an empty drawer.
- [Troubleshooting prints](../printing/troubleshooting): answers for prints that do not fit or do not stack.
