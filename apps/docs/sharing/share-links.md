---
title: Share a layout
description: 'Make a link so other people can view a layout or edit it with you.'
sources:
  - src/features/cloud-share/
  - src/shared/hooks/useCollabMode.ts
  - api/lib/shareConstraints.ts
  - src/core/result/catalog.ts
  - src/core/storage/ShareService.ts
  - src/features/bin-designer/components/ExportDialog/ExportDialog.tsx
---

# Share a layout

The Gridfinity Layout Tool can put a copy of a layout on its server and give you a link to it. Send the link to a person who helps you plan the drawer, or who wants to print the same bins. You decide if the people with the link can only view the layout or can also edit it.

## Make a share link

1. Open the layout in the layout editor.
2. Click <Ui k="share.button.shareLayout" /> in the header, beside the undo and redo buttons.
3. In <Ui k="share.anyoneWithLinkCan" />, select <Ui k="share.anyoneWithLinkCanView" /> or <Ui k="share.anyoneWithLinkCanEdit" />.
4. Click <Ui k="share.createShareLink" />.

The Layout Tool uploads the layout and copies the link to your clipboard. A check mark then shows on the share button, and its name changes to <Ui k="share.button.manageShare" />.

<Screenshot id="sharing-share-links-popover" alt="The share popover below the header share button, with the permission menu and the create link button." spec="Layout editor, desktop, a sample layout with about 10 bins on two layers. Click the share button in the header. Show the popover before you create a link, with the permission menu set to view. Crop to the header right side and the popover." />

The command palette has the same controls. Run <Ui k="commandPalette.copyShareLink" /> to open them.

::: info
You must be online to make, change or delete a share link. You do not need an account.
:::

## What the link holds

The link holds the whole layout: the drawer, the layers, the categories, and the bins with their labels and notes. When a bin uses a saved design, a copy of the design goes with the layout. The person who opens the link gets their own copy of each design, so the linked bins look the same for them.

When you change a layout that has a link, the Layout Tool updates the link a few seconds later. You do not have to share it again. A change to the stash alone does not start an update.

A link stays until you delete it. Links do not expire.

The server refuses a layout that is too large or that holds blocked text:

| Limit                   | Value                                                        |
| ----------------------- | ------------------------------------------------------------ |
| Size of the layout data | 500 KB                                                       |
| Bins in the layout      | 2,500                                                        |
| Labels and notes        | No web addresses, and no character 11 or more times in a row |

If the server refuses the text, the error message tells you to check the bin labels and notes.

## What the other person sees

The link opens the layout editor with your layout. What happens next depends on the permission.

**View only.** A banner at the top shows the name of the shared layout. The person can look at the layout and change it on their screen, but their changes do not go back to you. The banner has two buttons:

- <Ui k="share.banner.saveToMyLayouts" /> saves a copy in their own layouts, with "(imported)" after the name. The copy includes the changes they made.
- <Ui k="share.banner.discardConfirm" /> closes the shared layout and opens their last layout again. The person loses their changes.

**Can edit.** The person joins a live session and edits the same layout as you. The banner does not show. See [Work together live](./live-collaboration).

The person must be online to open the link.

<Screenshot id="sharing-share-links-banner" alt="The banner at the top of the layout editor for a view-only shared layout, with the save and discard buttons." spec="Open a view-only share link in a second browser profile with an empty library. Show the full width of the banner and the top of the grid below it. Crop to the top 250 px of the window." />

## Change or delete a link

Click <Ui k="share.button.manageShare" /> in the header to open the link controls.

| To do this                 | Do this                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| Copy the link again        | Click <Ui k="common.copy" />.                                                                 |
| Change who can edit        | Select a new value in <Ui k="share.anyoneWithLinkCan" />. A message lets you undo the change. |
| Stop the link from working | Click <Ui k="share.deleteShareLink" />, then <Ui k="common.delete" />.                        |

When you change an edit link to view only, the live session ends. A deleted link stops working for every person who has it.

::: info
Only the browser that made a link can change or delete it. A share link is not part of your account, and it does not sync to your other devices.
:::

## Share without the server

The layout manager has three more ways to send a layout. These ways do not put a copy on the server.

1. Open the layout manager with <kbd>Ctrl</kbd>+<kbd>O</kbd> (<kbd>Cmd</kbd>+<kbd>O</kbd> on a Mac).
2. Open the actions menu on the layout.
3. Click <Ui k="share.copyLink" />.

The <Ui k="share.title" /> dialog opens with three tabs:

| Tab                        | What you get                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="share.tabs.link" /> | A link that holds the whole layout in the address. No server is necessary. Very large layouts make long links that some browsers do not open. |
| <Ui k="share.tabs.file" /> | <Ui k="share.file.download" /> saves the layout as a JSON file. The other person imports it in the layout manager.                            |
| <Ui k="share.tabs.json" /> | <Ui k="share.json.copy" /> copies the layout data to the clipboard.                                                                           |

## Share one bin design

To send one bin design, send its design file:

1. Open the design in the bin designer.
2. Click <Ui k="common.export" /> in the header.
3. Click <Ui k="binDesigner.downloadDesignJson" />.

The file holds the editable design, not a printable model. The other person imports it in the bin designer. To share a design with every maker, publish it in [the community gallery](./community).

## Next steps

- [Work together live](./live-collaboration): edit one layout with other people at the same time.
- [Accounts and sync](./accounts-and-sync): keep your own layouts on all your devices.
- [The community gallery](./community): publish a bin design for everyone.
- [Layout file](../reference/layout-file): what a layout JSON file holds.
