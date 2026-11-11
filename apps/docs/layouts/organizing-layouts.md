---
title: Organize your layouts
description: 'Open, rename, copy and sort your layouts in folders, restore an earlier version, and undo changes.'
sources:
  - src/features/layout-library/
  - src/features/snapshots/
  - src/core/storage/SnapshotService.ts
  - src/shared/hooks/useSnapshotAutoSave.ts
  - src/core/cqrs/undo/historyStore.ts
  - src/shared/hooks/useLayoutActivation.ts
  - src/shell/Header/Header.tsx
  - src/core/storage/LayoutManager.ts
  - src/core/cqrs/store/retryQueue.ts
  - src/shared/hooks/useAutoSave.ts
---

# Organize your layouts

Plan one drawer, and soon you'll want to plan the whole workshop. Each drawer is one **layout**. The Gridfinity Layout Tool keeps all your layouts in a library in your browser, and it saves each change for you. Here's how to find, rename, copy and file your layouts, and how to go back to an earlier version when an idea doesn't work out.

## Rename and switch layouts

The name of the open layout is in the header. Click the name to change it, then press <kbd>Enter</kbd>. A name can have up to 64 characters.

Next to the name, a menu lists all your layouts, grouped by folder. Click a layout to open it. The menu also has <Ui k="layouts.newLayout" /> and <Ui k="header.manageLayouts" />.

## Use the layout manager

To open the layout manager, choose <Ui k="header.manageLayouts" /> in the menu, or press <kbd>Ctrl</kbd>+<kbd>O</kbd> (<kbd>Cmd</kbd>+<kbd>O</kbd> on a Mac). On a phone, open the layouts panel from the header.

<Screenshot id="layouts-organizing-manager" alt="The layout manager with the folder list on the left and layout cards in a grid on the right." spec="Layout editor on desktop. Library with about eight layouts and two folders, Garage and Kitchen, one with a subfolder. Press Ctrl+O. Select All layouts in the folder list so the cards show. Crop to the dialog." />

The manager shows each layout with a small picture of its drawer, so you can spot the one you want. You can:

- Click <Ui k="layouts.newLayout" /> to start an empty layout.
- Type in the search field to find a layout by name.
- Pick an order under <Ui k="layouts.sortBy" />. The table below shows the choices.
- Click <Ui k="common.download" /> on a layout to save it as a file.

| Order                           | Puts first                        |
| ------------------------------- | --------------------------------- |
| <Ui k="layouts.sortRecent" />   | The layouts that you changed last |
| <Ui k="layouts.sortName" />     | Names in alphabetical order       |
| <Ui k="layouts.sortSize" />     | The largest drawers, by area      |
| <Ui k="layouts.sortBinCount" /> | The layouts with the most bins    |

The open layout always comes first, whatever the order.

The more actions menu of each layout has these items:

| Item                              | What it does                                                                |
| --------------------------------- | --------------------------------------------------------------------------- |
| <Ui k="common.rename" />          | Changes the name                                                            |
| <Ui k="common.duplicate" />       | Makes a copy with "(copy)" after the name                                   |
| <Ui k="layouts.folders.moveTo" /> | Puts the layout in a folder                                                 |
| <Ui k="share.copyLink" />         | Opens <Ui k="share.title" />, to share the layout without a server copy     |
| <Ui k="common.delete" />          | Deletes the layout after you click <Ui k="layouts.confirmDelete.confirm" /> |

::: warning
Download a layout before you delete it if you think you need it later. You cannot undo a delete, and the snapshots of that layout go too.
:::

You can keep up to 500 layouts. The library always keeps at least one.

## Sort layouts into folders

Folders keep a big library tidy, for example one folder for the garage and one for the kitchen. The folder list is on the left side of the manager, and <Ui k="layouts.folders.all" /> shows every layout.

1. Select the folder that the new folder goes in, or <Ui k="layouts.folders.all" /> for the top level.
2. Click <Ui k="layouts.folders.newFolder" />.
3. Type a name of up to 32 characters, then click <Ui k="layouts.folders.create" />.

To put a layout in a folder, open its more actions menu and choose <Ui k="layouts.folders.moveTo" />. Pick the folder, then click <Ui k="layouts.folders.move" />.

To rename a folder, double-click its name. To delete a folder, click its delete button two times. Don't worry about what's inside: its layouts and folders move up one level, so you lose no layouts.

With the Places feature in Labs, a folder can also be a place, an area or a unit. See [Find What Your Bins Hold](../settings/labs#find-what-your-bins-hold).

## Go back to an earlier version

Tried an idea and don't like it? The Layout Tool saves a **snapshot** of the open layout every 2 minutes when it changes. On a computer, open the <Ui k="rightPanel.historyTab" /> tab in the right panel to see them. Each snapshot shows its age, a small picture, and the number of bins and layers.

- Click <Ui k="snapshots.saveCheckpoint" /> to keep the current state, with the date and time as its label. Do this before a big change.
- Click the name of a snapshot to give it a label.
- The Layout Tool keeps the 10 newest snapshots without a label. It keeps labeled snapshots until you delete them.

To go back, click <Ui k="snapshots.restore" /> on a snapshot. A dialog gives two choices:

- <Ui k="snapshots.restore" /> replaces the current layout with the snapshot and clears the undo history.
- <Ui k="snapshots.createCopy" /> opens the snapshot as a new layout and keeps the current one. Pick this one if you're not sure.

If the browser loses the data of a layout, the Layout Tool looks for it in its backup storage when it starts. If it finds the layout, it shows <Ui k="toast.layoutRecovered" />.

## Undo a change

Press <kbd>Ctrl</kbd>+<kbd>Z</kbd> to undo and <kbd>Ctrl</kbd>+<kbd>Y</kbd> to redo. On a Mac, use <kbd>Cmd</kbd>. The header also has undo and redo buttons.

The undo history keeps the last 100 changes of the open layout. When you open a different layout or restore a snapshot, the history starts again. For an older state, use a snapshot.

## When it goes wrong

### A message says the Layout Tool couldn't save your changes

Free up space on your device, then come back to the Layout Tool. When the header shows <Ui k="header.saved" />, your changes are safe.

Your browser keeps your layouts on your device, so the Layout Tool can't save when the device is full. While a save fails, the header shows <Ui k="header.saveFailed" />. The Layout Tool tries again by itself, first after a few seconds and then every minute. It also tries again when you come back to the window. Until a save works, the browser asks before you close or reload the tab.

### Undo doesn't go back far enough

Restore a snapshot from the <Ui k="rightPanel.historyTab" /> tab instead. Undo keeps only the last 100 changes of the open layout. It also starts again when you open a different layout or restore a snapshot.

### A snapshot that you wanted is gone

Give a snapshot a label to keep it, or click <Ui k="snapshots.saveCheckpoint" /> before a big change. The Layout Tool keeps only the 10 newest snapshots without a label. Each new snapshot pushes out the oldest one without a label.

### A new layout or a copy fails with a message

Delete the layouts that you don't need. Download a layout first if you may want it later. The library holds up to 500 layouts, and at that limit a new layout or a copy fails. To see your count, open Settings and go to the <Ui k="settings.tabs.storage" /> tab.

## Next steps

- [Your data and privacy](../introduction/your-data): where the browser keeps your layouts.
- [Accounts and sync](../sharing/accounts-and-sync): keep your layouts on all your devices.
- [Layout file format](../reference/layout-file): the file that a download makes.
- [Share a layout](../sharing/share-links): send a layout to someone else.
