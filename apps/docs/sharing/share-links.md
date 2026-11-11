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
  - api/liveblocks-auth.ts
  - api/share.ts
  - api/lib/contentFilter.ts
---

# Share a layout

Want a second opinion on your drawer plan, or a friend who wants to print the same bins? Send them a share link. The Gridfinity Layout Tool puts a copy of your layout on its server. You decide if people with the link can only look, or can also edit with you.

## Make a share link

1. Open the layout in the layout editor.
2. Click <Ui k="share.button.shareLayout" /> in the header, next to undo and redo.
3. Under <Ui k="share.anyoneWithLinkCan" />, pick what the other person can do (see the table below).
4. Click <Ui k="share.createShareLink" />. The link goes to your clipboard, ready to paste.

| Pick                                   | The other person can                                                      |
| -------------------------------------- | ------------------------------------------------------------------------- |
| <Ui k="share.anyoneWithLinkCanView" /> | Look at the layout and save their own copy. Their changes stay with them. |
| <Ui k="share.anyoneWithLinkCanEdit" /> | Edit the same layout with you, live.                                      |

Not sure? Pick view. You can change it later.

After you make the link, the share button gets a check mark and turns into <Ui k="share.button.manageShare" />.

<Screenshot id="sharing-share-links-popover" alt="The share popover below the header share button, with the permission menu and the create link button." spec="Layout editor, desktop, a sample layout with about 10 bins on two layers. Click the share button in the header. Show the popover before you create a link, with the permission menu set to view. Crop to the header right side and the popover." />

Prefer the keyboard? Run <Ui k="commandPalette.copyShareLink" /> in the command palette to open the same controls.

::: info
You must be online to make, change or delete a share link. You don't need an account.
:::

## What the link holds

The link carries the whole layout: the drawer, the layers, the categories, and the bins with their labels and notes. If a bin uses a saved design, a copy of that design goes along too. The person who opens the link gets their own copy of each design, so the linked bins look the same for them.

You can still edit after you share. The Layout Tool updates the link a few seconds after each change, so you never have to share it again. A change to the stash alone doesn't start an update.

Links don't expire. A link stays until you delete it. [Your data and privacy](../introduction/your-data#what-a-share-link-publishes) explains who can see the copy.

The server turns away a layout that is too large or that holds blocked text:

| Limit                   | Value                                                                            |
| ----------------------- | -------------------------------------------------------------------------------- |
| Size of the layout data | 500 KB                                                                           |
| Bins in the layout      | 2,500                                                                            |
| Text                    | No web addresses, no character 11 or more times in a row, and no offensive words |

If the server refuses the text, the error message names where it found it.

## What the other person sees

The link opens the layout editor with your layout in it. What they can do next depends on the permission that you picked.

**View only.** A banner at the top shows the name of the shared layout. They can look around and even change things on their screen, but their changes don't come back to you. The banner has two buttons:

- <Ui k="share.banner.saveToMyLayouts" /> keeps a copy in their own layouts, with "(imported)" after the name. The copy includes their changes.
- <Ui k="share.banner.discardConfirm" /> closes the shared layout and opens their last layout again. They lose their changes.

**Can edit.** They join a live session and edit the same layout as you, with no banner. See [Work together live](./live-collaboration).

Either way, they must be online to open the link.

<Screenshot id="sharing-share-links-banner" alt="The banner at the top of the layout editor for a view-only shared layout, with the save and discard buttons." spec="Open a view-only share link in a second browser profile with an empty library. Show the full width of the banner and the top of the grid below it. Crop to the top 250 px of the window." />

## Change or delete a link

Click <Ui k="share.button.manageShare" /> in the header to get the link controls back.

| To do this                 | Do this                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Copy the link again        | Click <Ui k="common.copy" />.                                                               |
| Change who can edit        | Pick a new value in <Ui k="share.anyoneWithLinkCan" />. A message lets you undo the change. |
| Stop the link from working | Click <Ui k="share.deleteShareLink" />, then <Ui k="common.delete" />.                      |

Switch an edit link to view only, and anyone who opens the link after that can only look. People already in a live session can keep editing until they leave and come back. Delete a link, and it stops working for everyone who has it.

::: info
Only the browser that made a link can change or delete it. A share link isn't part of your account, so it doesn't sync to your other devices.
:::

## Share without the server

Rather not put a copy on the server? The layout manager has three other ways to send a layout.

1. Open the layout manager with <kbd>Ctrl</kbd>+<kbd>O</kbd> (<kbd>Cmd</kbd>+<kbd>O</kbd> on a Mac).
2. Open the actions menu on the layout, and click <Ui k="share.copyLink" />.

The <Ui k="share.title" /> dialog opens with three tabs:

| Tab                        | What you get                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| <Ui k="share.tabs.link" /> | A link that carries the whole layout in the address itself, with no server. Very large layouts make long links that some browsers don't open. |
| <Ui k="share.tabs.file" /> | <Ui k="share.file.download" /> saves the layout as a JSON file. The other person imports it in the layout manager.                            |
| <Ui k="share.tabs.json" /> | <Ui k="share.json.copy" /> copies the layout data to your clipboard.                                                                          |

## Share one bin design

Want to send just one bin? Send its design file. It holds the editable design, not a printable model, and the other person imports it in the bin designer. [Save and reuse designs](../designer/save-and-reuse#download-and-import-a-design-file) shows how to download and import the file. To share a design with every maker, publish it in [the community gallery](./community).

## When it goes wrong

### The server refuses to share your layout

Read the message, and do what it asks:

| Message is about   | What to do                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------ |
| Blocked content    | Change the text that the message names, then share again.                                  |
| A layout too large | Remove bins that you don't need, or [share without the server](#share-without-the-server). |
| Too many bins      | Remove bins until the layout has 2,500 or fewer.                                           |

The server reads all the text that you share. That is the layout name, the category names, each linked bin design, and the labels, notes, contents and custom properties of each bin. In the text that the message names, remove web addresses that start with `http://`, `https://` or `www.`. Type a character fewer times where it comes 11 or more times in a row. Then reword offensive words.

### The link says that the share isn't found

Copy the whole link again, and open it. Still not found? Ask the owner for a new link.

A link doesn't expire. So when the server can't find a complete link, the owner deleted it, and it stops working for everyone.

### You can't change or delete your link

Open the layout in the browser that made the link, and change it there. If a message says that the share no longer exists, make a new link.

The browser that makes a link keeps a key for it. Another browser or another device doesn't have that key, even with the same account.

## Next steps

- [Work together live](./live-collaboration): edit one layout with other people at the same time.
- [Accounts and sync](./accounts-and-sync): keep your own layouts on all your devices.
- [The community gallery](./community): publish a bin design for everyone.
- [Layout file format](../reference/layout-file): what a layout JSON file holds.
