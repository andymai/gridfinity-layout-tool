---
title: Labs
description: 'Turn on early features in Settings > Labs: Places and Find, the sliding tray, a second 3D engine and a speed overlay.'
sources:
  - src/core/labs/features.ts
  - src/shell/Modals/SettingsModal/tabs/LabsTab/LabsTab.tsx
  - src/features/labs/components/
  - src/features/places/
  - src/features/bin-inspector/components/Inspector/BinItemsEditor/
  - src/features/bin-designer/components/panel/SlideTraySection/
  - src/features/bin-designer/components/PerfOverlay/PerfOverlay.tsx
---

# Labs

Labs holds the features of the Gridfinity Layout Tool that are still in development. Each one stays off until you turn it on. Try them if you want new tools early, and expect them to change.

::: warning
Do not depend on a Labs feature for important work. <Ui k="settings.labsHint" />
:::

## Turn on a Labs feature

1. Open Settings.
2. Select <Ui k="settings.tabs.labs" />, in the <Ui k="settings.groups.advanced" /> group.
3. Find the card of the feature and turn on its switch.

The feature starts at once in all open tabs. A card with more risk shows a warning below its description. Your Labs choices stay in this browser. They do not sync to your other devices.

<Screenshot id="settings-labs-tab" alt="The Labs tab in Settings, with the 3D Engine selector at the top and the feature cards below it." spec="Settings, Labs tab, desktop. Leave the 3D engine on Default and all cards off, so the medium-risk warning on the sliding tray card shows. Crop to the Labs tab content." />

## Places and Find

This feature lets you write down what each bin holds, and then find any item in all your layouts.

**Say what a bin holds.** Select a bin in the layout editor. The inspector then has a <Ui k="inspector.contents.title" /> section. Type an item in <Ui k="inspector.contents.addPlaceholder" />, or paste a list to add many items at once. Each item can have a quantity. A bin holds up to 100 items.

**Find a bin.** In the layout editor, press <kbd>Ctrl</kbd>+<kbd>K</kbd> (<kbd>Cmd</kbd>+<kbd>K</kbd> on a Mac) and type what you look for. The command palette shows the matching bins above the commands, with the folder, the layout and the layer of each one. The search looks at item names, bin labels and notes. Select a result to open its layout and select the bin. On a phone, use <Ui k="places.find.placeholder" /> in the layouts sheet.

**Folders as places.** In the layout manager, a folder can be a <Ui k="places.kind.place" />, an <Ui k="places.kind.area" /> or a <Ui k="places.kind.unit" />. To change the kind, click the swap button (<Ui k="places.kind.change" />) beside the folder. <Ui k="places.newPlace" /> makes a new place. A place is always at the top level, for example your home or your shop. On a computer, the header of the layout editor shows where the open layout is.

See [Organizing layouts](../layouts/organizing-layouts) for folders, and [Keyboard and command palette](./keyboard-and-command-palette) for the palette.

## Sliding tray

This feature adds a rail to a bin and a tray that slides along the rail. Small parts ride in the tray above the bin floor, and you slide the tray aside to reach what is below.

When the feature is on, the bin designer shows a <Ui k="binDesigner.slideTray.title" /> section in the <Ui k="binDesigner.group.interior" /> group. Choose where the rail goes:

- <Ui k="binDesigner.slideTray.mount.interior" />: <Ui k="binDesigner.slideTray.mountHint.interior" />
- <Ui k="binDesigner.slideTray.mount.rim" />: <Ui k="binDesigner.slideTray.mountHint.rim" />

::: warning
Print a test before you print a full tray. The shape of the rail and the tray can still change, and the printed fit is not proven yet. A design that you save with a tray may not open the same way in a later version.
:::

## Alternative 3D engine

The Layout Tool makes each bin and baseplate model with a 3D engine. Labs lets you try a second engine that uses less memory and loads faster than the default one.

The <Ui k="labs.engine.title" /> selector is at the top of the Labs tab. It has two options: <Ui k="labs.engine.segmentDefault" /> and <Ui k="labs.engine.segmentBrepkit" />. After you change it, reload the page. A message with a <Ui k="labs.engine.reloadAction" /> button helps you do this.

While the second engine is on, the bin designer and the baseplate generator show <Ui k="labs.experimentalKernel.title" />. Click <Ui k="labs.experimentalKernel.labsSettings" /> in that notice to go back to Labs.

::: warning
Make sure that each export is correct when the second engine is on. <Ui k="labs.experimentalKernel.warning" /> Change back to <Ui k="labs.engine.segmentDefault" /> for the files that you print.
:::

## Generation performance overlay

This feature shows a small overlay in the bin designer. The overlay gives the time of each step that makes the bin model, the cache hit rates, and a history of recent models. It helps you find out why a bin is slow to update. It does not change the bin.

## Next steps

- [Settings and accessibility](./settings): the other tabs in Settings.
- [Keyboard and command palette](./keyboard-and-command-palette): open Find with the command palette.
- [Preview and export](../concepts/preview-and-export): how the Layout Tool makes the model that you export.
