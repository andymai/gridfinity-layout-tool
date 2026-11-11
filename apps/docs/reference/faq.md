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
  - src/App.tsx
---

# FAQ

Quick answers to the questions that makers ask most about the Gridfinity Layout Tool. Each answer links to the page with the full details.

## Start

### Is the Layout Tool free? Do I need an account?

Yes, it's free, and no, you don't need an account. You can plan layouts, design bins and baseplates, and export files without one. Sign in only if you want to sync your work across devices. See [What the Layout Tool does](../introduction/what-it-does).

### What are Labs and Experimental features?

Both are features that can still change. Labs features are still in development, and they stay off until you turn them on in <Ui k="settings.title" /> > <Ui k="settings.tabs.labs" />. An Experimental label marks a feature that is on for everyone. See [Labs](../settings/labs).

### Can I run my own copy of the Layout Tool?

Yes. A Docker image serves the app from your own computer or server. Sharing, sign-in and the community gallery need the hosted service, so they don't work in your copy. See [Self-hosting with Docker](./self-hosting).

## Your data

### Where does the Layout Tool save my work?

In your browser, on this device. It saves while you work. Sign in to sync your layouts and designs to your other devices. See [Your data and privacy](../introduction/your-data).

### How do I move my layouts to another computer?

Sign in on both computers, and your layouts sync. Use <Ui k="auth.signIn" /> on each one. No account? Use <Ui k="layouts.exportAll" /> in the layout manager, then import that file on the other computer. See [Accounts and sync](../sharing/accounts-and-sync).

### Can I use the Layout Tool offline?

Yes. Open each tool once while you are online, so that your browser stores it. After that, the Layout Tool opens without a network connection, in a browser tab or as an installed app. Your changes still save on your device. See [Install and work offline](../settings/offline).

### Can I edit a layout file by hand?

Yes. A layout file is plain JSON text with a published schema. Point the file at the schema, and most code editors suggest field names and mark mistakes. See [Layout file format](./layout-file).

## Sizes and fit

### How do I convert my drawer to grid units?

Measure the inside width and depth of the drawer in millimeters. Divide each value by 42 and round down. For example, a drawer of 380 mm × 260 mm takes a grid of 9 × 6. See [Set up the drawer](../layouts/drawer-setup).

### What do I do with the gap at the edge of the drawer?

Fill it, in one of two ways. The baseplate can fill the gap with padding on each side. Or let an edge bin grow into that gap, so the bin fills the drawer. See [Baseplate basics](../baseplates/basics).

### How tall is a bin of 6 units?

42 mm to the top of its wall. One height unit is 7 mm, and 6 × 7 mm is 42 mm. The stacking lip adds more height above the wall. See [Units and sizes](../concepts/units).

### Do my bins fit baseplates from other Gridfinity models?

Yes, when the other model follows the standard Gridfinity measurements. The Layout Tool builds the foot and pocket profiles to those measurements. A low-profile baseplate still takes standard bins, with less grip. See [Gridfinity dimensions](./dimensions).

### Do I need magnets?

No. Magnet holes are an option, and a new baseplate has none. Add magnet holes to the bins and to the baseplate only if you plan to fit magnets. See [Magnets and screws](../baseplates/magnets-and-screws).

## Print and export

### What happens when a bin is larger than my print bed?

It splits into pieces that fit. The Layout Tool splits a bin or a baseplate that is too large for your print bed. A long bin that fits only from corner to corner of the bed still prints in one piece. See [Fitting the print bed](../concepts/print-bed-fit).

### Which file format do I export: STL, 3MF or STEP?

STL for a one-color print, 3MF for more than one color, and STEP to edit the part in a CAD program. A 3MF file sends each color zone to the slicer as a separate filament. STL holds no color, and STEP cannot carry an imported STL shape. See [File formats](../printing/file-formats).

### How do I export all the bins of a layout at once?

Click <Ui k="layoutExport.button" /> in the header. You get one ZIP file with every bin linked to a saved design, and the baseplate. See [The print list and ZIP export](../printing/print-list-and-zip).

## Work faster

### Why does a keyboard shortcut do nothing?

The cursor is probably in a text field, where shortcuts don't work. Click an empty part of the canvas, then press the key again. See [Keyboard shortcuts](./shortcuts).

### How many steps can I undo?

100. The layout editor and the bin designer each keep the last 100 changes. Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo, or <kbd>Cmd</kbd>+<kbd>Z</kbd> on a Mac. See [Keyboard shortcuts](./shortcuts).

### What is the stash?

A holding area below the grid. Put a bin there when you don't want it in the drawer yet. The Layout Tool also moves bins there when a smaller drawer has no room for them. See [Layouts, layers and the stash](../concepts/layouts-layers-stash).

## Next steps

- [Glossary](./glossary): the meaning of each term in the app.
- [Plan your first drawer](../getting-started/first-drawer): start a layout from an empty drawer.
- [Troubleshooting prints](../printing/troubleshooting): answers for prints that do not fit or do not stack.
