---
title: FAQ
description: 'Short answers to common questions about the Layout Tool: cost, your data, drawer sizes, print beds, file formats and shortcuts.'
questions:
  - 'How do I back up my layouts?'
  - 'Can I enter my drawer size in inches?'
  - 'Do my bins fit baseplates from other models?'
sources:
  - src/i18n/locales/en.ts
  - content/guide.md
  - src/core/constants.ts
  - src/core/baseplateDefaults.ts
  - src/core/bedFit.ts
  - docs/self-hosting.md
  - src/App.tsx
  - src/features/layout-library/components/LayoutManagerModal/
  - src/core/storage/clearAppData.ts
  - src/features/layout-library/components/LayoutManagerModal/ImportView/ImportView.tsx
  - src/features/bin-designer/components/DesignImportView/DesignImportView.tsx
  - src/features/bin-designer/components/panel/CutoutsSection/svgImport/useSvgImport.ts
  - src/features/bin-designer/components/panel/CutoutsSection/stlImport/useStlImport.ts
  - src/features/bin-designer/components/panel/CutoutsSection/scanImport/ScanToolDialog.tsx
  - src/features/bin-designer/components/TraceView/TraceView.tsx
  - src/features/bin-designer/components/CutoutWorkspace/usePhotoDropAndPaste.ts
  - src/shared/scanReview/components/ScanCaptureFlow/ScanCaptureFlow.tsx
  - src/features/drawer-shape/components/PenShapeDialog/useOutlineImport.ts
  - src/features/community/components/PrintDialog/PrintPhotoPicker.tsx
---

# FAQ

Quick answers to the questions that makers ask most about the Gridfinity Layout Tool. Each answer links to the page with the full details.

## Start

### Is the Layout Tool free? Do I need an account?

Yes, it's free, and no, you don't need an account. You can plan layouts, design bins and baseplates, and export files without one. Sign in only if you want to sync your work across devices. See [What the Layout Tool does](../).

### What are Labs and Experimental features?

Both are features that can still change. Labs features are still in development, and they stay off until you turn them on in <Ui k="settings.title" /> > <Ui k="settings.tabs.labs" />. An Experimental label marks a feature that is on for everyone. See [Labs](../settings/labs).

### Can I run my own copy of the Layout Tool?

Yes. A Docker image serves the app from your own computer or server. Sharing, sign-in and the community gallery need the hosted service, so they don't work in your copy. See [Self-hosting with Docker](./self-hosting).

## Your data

### Where does the Layout Tool save my work?

In your browser, on this device. It saves while you work. Sign in to sync your layouts and designs to your other devices. See [Your data and privacy](../introduction/your-data).

### How do I move my layouts to another computer?

Sign in on both computers, and your layouts sync. Use <Ui k="auth.signIn" /> on each one. No account? Use <Ui k="layouts.exportAll" /> in the layout manager, then import that file on the other computer. See [Accounts and sync](../sharing/accounts-and-sync).

### How do I back up my layouts?

1. Open the layout manager with <kbd>Ctrl</kbd>+<kbd>O</kbd> (<kbd>Cmd</kbd>+<kbd>O</kbd> on a Mac).
2. Click <Ui k="layouts.exportAll" />. You get one archive file with every layout and the bin designs that the layouts link to.

To bring the layouts back, open the layout manager, click <Ui k="common.import" /> and drop the archive file. The layout manager shows what the archive holds. Then click the **Import All** button. A bin design that no layout uses doesn't go into the archive. Export it as a design file from <Ui k="binDesigner.savedDesigns" />.

### How do I start over?

Pick the smallest step that does the job:

| To do this                        | Do this                                                                                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Take back your last changes       | Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> (<kbd>Cmd</kbd>+<kbd>Z</kbd> on a Mac). See [Undo a change](../layouts/organizing-layouts#undo-a-change).                 |
| Start one drawer again            | Click <Ui k="layouts.newLayout" /> in the menu next to the layout name. Your other layouts stay.                                                             |
| Remove all layouts in the browser | Back up first. Then use <Ui k="settings.storage.clearAllData" /> in <Ui k="settings.tabs.storage" />. See [Settings](../settings/settings#account-and-data). |
| Remove everything                 | Back up first. Then clear the site data for gridfinitylayouttool.com in your browser settings.                                                               |

Signed in? <Ui k="settings.storage.clearAllData" /> doesn't sign you out, so your synced layouts come back from your account. To start over on this device, click <Ui k="auth.signOut" /> and pick <Ui k="syncDialog.signOut.wipe" />. The copies in your account stay until you [delete your account](../sharing/accounts-and-sync#delete-your-account).

### Can I use the Layout Tool offline?

Yes. Open each tool once while you are online, so that your browser stores it. After that, the Layout Tool opens without a network connection, in a browser tab or as an installed app. Your changes still save on your device. See [Install and work offline](../settings/offline).

### Can I edit a layout file by hand?

Yes. A layout file is plain JSON text with a published schema. Point the file at the schema, and most code editors suggest field names and mark mistakes. See [Layout file format](./layout-file).

### What files can I import?

Layout and design files, STL models, SVG and DXF outlines, and photos. Each kind goes in at its own place in the app:

| What you import                 | File type                       | Where                                                                                                                                                              | See                                                                                               |
| ------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| A layout                        | `.json`                         | Layout manager (<kbd>Ctrl</kbd>+<kbd>O</kbd>), <Ui k="common.import" />                                                                                            | [Import a layout file](./layout-file#import-a-layout-file)                                        |
| A backup of all your layouts    | `.json` archive                 | Layout manager, <Ui k="common.import" />                                                                                                                           | [How do I back up my layouts?](#how-do-i-back-up-my-layouts)                                      |
| A bin design                    | `.json`                         | <Ui k="binDesigner.savedDesigns" />, <Ui k="common.import" />                                                                                                      | [Download and import a design file](../designer/save-and-reuse#download-and-import-a-design-file) |
| A whole bin as a 3D model       | `.stl`                          | <Ui k="binDesigner.savedDesigns" />, <Ui k="common.import" />                                                                                                      | [Special bins](../designer/special-bins#other-bin-types)                                          |
| Flat shapes for cutouts         | `.svg`                          | Cutout editor, <Ui k="binDesigner.cutouts.importSvg" />                                                                                                            | [Import an SVG as cutouts](../cutouts/import-svg-stl#import-an-svg-as-cutouts)                    |
| A 3D shape to cut into a bin    | `.stl`                          | Cutout editor, <Ui k="binDesigner.cutouts.importStl" />                                                                                                            | [Cut an STL shape into a bin](../cutouts/import-svg-stl#cut-an-stl-shape-into-a-bin)              |
| A photo of tools to trace       | Image file                      | Cutout editor, <Ui k="binDesigner.cutouts.scanImport.title" /> > <Ui k="binDesigner.cutouts.traceView.open" />. You can also drop or paste the photo on the board. | [Trace a photo](../cutouts/photo-trace#open-trace-a-photo)                                        |
| A phone scan of a tool          | Photo on the phone              | Cutout editor, <Ui k="binDesigner.cutouts.scanImport.title" /> > <Ui k="binDesigner.cutouts.scanImport.routePhone" />                                              | [Scan with your phone](../cutouts/phone-scan#take-the-photo-on-the-phone)                         |
| A tool outline from another app | `.svg`                          | Cutout editor, <Ui k="binDesigner.cutouts.scanImport.title" /> > <Ui k="binDesigner.cutouts.scanImport.upload" />                                                  | [Start a scan on the computer](../cutouts/phone-scan#start-a-scan-on-the-computer)                |
| A drawer outline from CAD       | `.svg`, or `.dxf` in ASCII form | Layout editor, <Ui k="drawerShape.penOpen" /> > <Ui k="drawerShape.penImport" />                                                                                   | [Drawers that are not rectangles](../baseplates/odd-shaped-drawers#give-the-drawer-a-shape)       |
| A photo of your print           | Image file under 25 MB          | A design page in the community gallery, <Ui k="community.print.cta" />                                                                                             | [Post a print](../sharing/community#post-a-print)                                                 |

The layout manager and <Ui k="binDesigner.savedDesigns" /> also take pasted JSON text. The label maker takes a pasted list, not a file. See [Labels for a label maker](../printing/label-maker).

## Sizes and fit

### How do I convert my drawer to grid units?

Measure the inside width and depth of the drawer in millimeters. Divide each value by 42 and round down. For example, a drawer of 380 mm × 260 mm takes a grid of 9 × 6. The box in [Units and sizes](../concepts/units#grid-units-and-height-units) does the math for you, and its link opens a layout at that size. See [Set up the drawer](../layouts/drawer-setup).

### My drawer is in inches. What do I do?

Multiply each size by 25.4 to get millimeters. For example, a drawer of 15.5 × 21 inches is 393.7 × 533.4 mm, and it takes a grid of 9 × 12. The Layout Tool takes sizes in millimeters only. The box in [Units and sizes](../concepts/units#grid-units-and-height-units) takes inches too: pick **in** above the fields.

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

It splits into pieces that fit. The Layout Tool splits a bin or a baseplate that is too large for your print bed. A long bin that fits only from corner to corner of the bed still prints in one piece. To cut a bin in your slicer, turn off <Ui k="binDesigner.splitToFitBed" /> in its design. See [Fitting the print bed](../concepts/print-bed-fit).

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
