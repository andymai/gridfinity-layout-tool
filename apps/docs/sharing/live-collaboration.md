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

In the Gridfinity Layout Tool, a layout with an edit link becomes a live room. Every person who opens the link edits the same layout at the same time, and sees what the others point at, select and move. Use it to plan a drawer with a partner, or to help a friend set up their first layout.

## Start a live session

1. Open the layout in the layout editor.
2. Make a share link with <Ui k="share.anyoneWithLinkCanEdit" />. See [Share a layout](./share-links).
3. Send the link to the people who help you.
4. Keep the layout open.

The room opens when a person opens a layout that has an edit link. This includes you, the owner. To change a view-only link into an edit link, open <Ui k="share.button.manageShare" /> and select <Ui k="share.anyoneWithLinkCanEdit" />.

No person needs an account. The room does not ask anyone to sign in.

## See who is in the room

During a live session, avatars show in the header beside the share button. Each person gets a color and a guest name, made from an adjective and an animal.

Click the avatars to open the <Ui k="collab.participants" /> list. The list marks the owner of the link with <Ui k="collab.owner" /> and you with <Ui k="collab.you" />. A small indicator shows the state of your connection:

| State                          | Meaning                                                             |
| ------------------------------ | ------------------------------------------------------------------- |
| <Ui k="collab.connected" />    | Your changes go to the room, and you get the changes of the others. |
| <Ui k="collab.connecting" />   | The Layout Tool is joining the room.                                |
| <Ui k="collab.reconnecting" /> | The connection stopped, and the Layout Tool tries again.            |
| <Ui k="collab.disconnected" /> | You are not in the room.                                            |

<Screenshot id="sharing-live-collaboration-participants" alt="The participants list open below the header avatars, with the owner and the current person marked." spec="Layout editor, desktop. Open one edit link in three browser profiles. In the owner profile, click the avatars in the header to open the participants list. Show the avatars, the list and the connection indicator. Crop to the header right side and the list." />

## See what the others do

The grid shows the work of the other people in their colors:

- **Cursors.** The pointer of each person, with their name, while it is over the grid.
- **Selection rings.** An outline around the bins that another person selected.
- **Ghosts.** An outline that shows a bin that another person draws, moves or resizes, before they release it.

<Screenshot id="sharing-live-collaboration-grid" alt="The grid with a second person's named cursor, a selection ring on one bin, and a ghost outline of a bin that moves." spec="Layout editor, desktop, two browser profiles side by side on one edit link. In the second profile, select one bin, then start to drag a different bin and hold the mouse button. Capture the first profile's grid. Crop to the grid area around the cursor and the two bins." />

## What the room shares

| The room shares                                                         | Each person keeps their own                  |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| The layout: drawer, layers, categories, bins, labels, notes and stash   | Zoom, the 3D preview and the settings        |
| The cursor, the selected bins and a drag or resize that is not complete | The layouts and designs in their own library |

## Who saves the link

The room holds the live layout. Only the browser of the link owner saves the room changes to the share link. It saves them about one second after each change.

::: warning
Keep the owner in the room while other people edit. When a person joins, the room takes the saved copy of the link. The room can then lose the changes that people made while the owner was away.
:::

## Read-only rooms

The room gives each person the permission that the link has at the time they connect. If the owner changes the link to view only, a person whose page still shows the edit permission connects read-only. The room does not take their changes, and their page shows the room copy. To get the view-only banner and its save button, that person opens the link again.

## When the server has no live service

Live editing needs a collaboration service on the server. This service is optional. On a server without it, an edit link opens the layout, but no room starts. You see no avatars and no cursors, and your changes stay in your browser. A self-hosted copy of the Layout Tool has no share links and no live rooms. See [Self-hosting](../reference/self-hosting).

## Next steps

- [Share a layout](./share-links): make, change and delete the link that opens the room.
- [Accounts and sync](./accounts-and-sync): keep your own layouts on all your devices.
- [Work with several bins](../layouts/multi-select): select and move many bins at once.
