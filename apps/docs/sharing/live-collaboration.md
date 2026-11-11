---
title: Work together live
description: 'Edit one layout with other people at the same time, and see their cursors and selections.'
sources:
  - src/shell/Collab/
  - src/shared/hooks/useCollabSync.ts
  - src/shared/hooks/useCollabMode.ts
  - src/liveblocks.config.ts
  - api/liveblocks-auth.ts
  - src/features/cloud-share/hooks/useCloudShareAutoSync.ts
---

# Work together live

Plan a drawer with a partner, or help a friend set up their first layout, without files that go back and forth. In the Gridfinity Layout Tool, a layout with an edit link becomes a **live room**. Everyone who opens the link edits the same layout at the same time, and sees what the others point at, select and move.

## Start a live session

1. Open the layout in the layout editor.
2. Make a share link with <Ui k="share.anyoneWithLinkCanEdit" />. See [Share a layout](./share-links).
3. Send the link to the people you want to work with.
4. Keep the layout open.

The room opens when someone opens a layout that has an edit link, and that includes you, the owner. Do you have a view-only link already? Open <Ui k="share.button.manageShare" /> and pick <Ui k="share.anyoneWithLinkCanEdit" />.

Nobody needs an account. The room never asks anyone to sign in.

## See who is in the room

During a live session, avatars show in the header next to the share button. Each person gets a color and a guest name, made from an adjective and an animal.

Click the avatars to open the list of people in the session. The link owner has the <Ui k="collab.owner" /> mark, and you have <Ui k="collab.you" />. A small indicator shows your connection:

| State                          | Meaning                                                         |
| ------------------------------ | --------------------------------------------------------------- |
| <Ui k="collab.connected" />    | You're in. Your changes go to the room, and theirs come to you. |
| <Ui k="collab.connecting" />   | The Layout Tool joins the room.                                 |
| <Ui k="collab.reconnecting" /> | The connection stopped. The Layout Tool tries again by itself.  |
| <Ui k="collab.disconnected" /> | You're not in the room.                                         |

<Screenshot id="sharing-live-collaboration-participants" alt="The participants list open below the header avatars, with the owner and the current person marked." spec="Layout editor, desktop. Open one edit link in three browser profiles. In the owner profile, click the avatars in the header to open the participants list. Show the avatars, the list and the connection indicator. Crop to the header right side and the list." />

## See what the others do

The work of the other people shows on your grid, each in their own color:

- **Cursors.** Each person's pointer, with their name, while it is over the grid.
- **Selection rings.** An outline around the bins that someone else selected.
- **Ghosts.** An outline of a bin that someone draws, moves or resizes, before they let go.

<Screenshot id="sharing-live-collaboration-grid" alt="Another person's named cursor grabs a bin and drags it two cells to the right. A ghost outline in their color follows the cursor. A third person's ring stays on a different bin." spec="Clip of one browser's grid in a live room with two other people. One of them keeps a bin selected. The other moves their cursor onto a bin, grabs it and drags it two cells into empty space, without letting go. Crop to the grid." />

## What the room shares

| Everyone in the room shares                                             | Each person keeps their own                  |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| The layout: drawer, layers, categories, bins, labels, notes and stash   | Zoom, the 3D preview and the settings        |
| The cursor, the selected bins and a drag or resize that is not complete | The layouts and designs in their own library |

## Who saves the link

The room holds the live layout, but only the link owner's browser saves the room changes back to the share link. It saves them about one second after each change.

::: warning
Keep the owner in the room while other people edit. When someone joins, the room loads the saved copy from the link. The room can then lose the changes that people made while the owner was away.
:::

## Read-only rooms

Each person gets the permission that the link has at the moment they connect. Say the owner changes the link to view only. Anyone whose page still shows the edit permission then connects read-only. The room ignores their changes, and their page shows the room copy. To get the view-only banner and its save button, they open the link again.

## When the server has no live service

Live editing needs a collaboration service on the server, and that service is optional. Without it, an edit link still opens the layout, but no room starts. You see no avatars and no cursors, and your changes stay in your browser. A self-hosted copy of the Layout Tool has no share links and no live rooms. See [Self-hosting](../reference/self-hosting).

## When it goes wrong

### Nobody else shows up in the room

Do you own the link? Open <Ui k="share.button.manageShare" />. The permission must be <Ui k="share.anyoneWithLinkCanEdit" />. Then make sure that everyone is online, and that they opened the link after the change.

A view-only link opens no room. It shows a copy of the layout, so nobody sees the others.

### Changes that other people made are gone

Keep the owner's tab open while other people edit.

Only the owner's browser saves the room to the link. When someone joins, the room loads the saved copy, so it can lose the changes from while the owner was away. See [Who saves the link](#who-saves-the-link).

### Your edits don't reach the others

Open the link again.

This happens when the owner changes the link to view only after your page loads. Your page then connects read-only, so the room ignores your changes. See [Read-only rooms](#read-only-rooms).

### You drop out of the room

When the status shows <Ui k="collab.reconnecting" />, wait a moment, and make sure that you're online. The Layout Tool joins the room again by itself.

## Next steps

- [Share a layout](./share-links): make, change and delete the link that opens the room.
- [Accounts and sync](./accounts-and-sync): keep your own layouts on all your devices.
- [Work with several bins](../layouts/multi-select): select and move many bins at once.
