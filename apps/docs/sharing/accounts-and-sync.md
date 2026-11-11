---
title: Accounts and sync
description: 'Sign in with Google or GitHub to keep your layouts and designs on all your devices.'
sources:
  - src/core/sync/
  - src/shell/sync/
  - src/shared/components/UserDock/
  - src/shell/Modals/SettingsModal/tabs/AccountTab/AccountTab.tsx
  - api/lib/quota.ts
  - api/sync/account.ts
---

# Accounts and sync

You can use the Gridfinity Layout Tool without an account. Your work then stays in the browser on one device. Sign in with Google or GitHub when you want the same layouts and designs on your computer, your laptop and your phone.

## Work without an account

At the bottom of the side panel, the account button shows <Ui k="dock.workingLocally" />. The Layout Tool saves everything in this browser. Another browser or another device does not see it. See [Your data](../introduction/your-data) for where the browser keeps it and how to back it up.

## Sign in

1. Click <Ui k="dock.workingLocally" /> at the bottom of the side panel. The button is in the layout editor, the bin designer and the baseplate generator.
2. Click <Ui k="auth.signInWithGoogle" /> or <Ui k="auth.signInWithGithub" />.
3. Approve the sign-in on the Google or GitHub page.

The browser then goes back to the Layout Tool. The same buttons are also in Settings, on the <Ui k="settings.tabs.account" /> tab.

At the first sign-in on a device, the Layout Tool merges the local layouts and designs with the copies in your account. If the data on the device belongs to a different account, the <Ui k="syncDialog.accountMismatch.title" /> dialog asks what to do. Add the data to the account you use now, or click <Ui k="syncDialog.accountMismatch.discard" /> to remove it from the device.

A sign-in lasts 30 days. After that, the Layout Tool signs you out and keeps your local copies. Sign in again to start the sync again.

<Screenshot id="sharing-accounts-sign-in-menu" alt="The account menu open at the bottom of the side panel, with the Google and GitHub sign-in buttons." spec="Layout editor, desktop, signed out, with three layouts in the library. Click the account button at the bottom of the left side panel to open its menu. Show the menu and the button. Crop to the bottom of the side panel." />

## What syncs

| Item                                                 | Limit for each account |
| ---------------------------------------------------- | ---------------------- |
| Layouts                                              | 100 layouts, 10 MB     |
| Saved bin designs                                    | 100 designs, 10 MB     |
| Saved baseplate designs                              | 100 baseplates, 10 MB  |
| <Ui k="binDesigner.versions.title" /> of bin designs | 500 versions, 25 MB    |
| Folders in the layout manager                        | 200 folders            |

These items do not sync: your settings, your Labs choices, and your share links. Each device keeps its own.

The Layout Tool sends a change about 3 seconds after you stop. While the tab is visible, it gets the changes from your other devices every 45 seconds. When you are offline, your changes stay in the browser and go to your account when the connection comes back.

The account button shows the state of the sync: <Ui k="dock.syncStatusIdle" />, <Ui k="dock.syncStatusSyncing" />, <Ui k="dock.syncStatusOffline" /> or <Ui k="dock.syncStatusError" />. For more detail, open Settings > <Ui k="settings.tabs.account" />. The <Ui k="account.sync.heading" /> section shows the time of the last sync and the number of changes that wait to upload.

When your account reaches a limit, the server refuses the new item, and a message tells you that your cloud storage is full. Delete some items to make space. Deleted items do not count toward the limit.

## When two devices change the same item

Each layout, design and folder carries the time of its last change. When two devices change the same item, the newer change wins. The older device then takes the newer copy, and a message shows: <Ui k="sync.conflictPulled" />

The newer copy replaces the whole item. The Layout Tool does not merge two sets of changes into one layout. If two changes have the same time to the millisecond, all devices choose the same winner.

::: tip
Edit a layout on one device at a time. To edit one layout with other people at the same time, use [a live session](./live-collaboration).
:::

A deletion also syncs. If you delete an item on one device, your other devices remove it too. A device with an older edit of that item shows this message: <Ui k="sync.deletedElsewhere" /> Edit the item again on that device to bring it back.

## Sign out

1. Click your name at the bottom of the side panel.
2. Click <Ui k="auth.signOut" />.
3. In the <Ui k="syncDialog.signOut.title" /> dialog, select what happens to the data on this device:
   - <Ui k="syncDialog.signOut.keep" /> keeps your layouts, designs, baseplates and folders on this device. Changes that did not upload yet go to your account at the next sign-in.
   - <Ui k="syncDialog.signOut.wipe" /> removes them from this device. The copies in your account stay.

Settings > <Ui k="settings.tabs.account" /> has the same <Ui k="account.signOut.button" /> button.

## Delete your account

1. Open Settings > <Ui k="settings.tabs.account" />.
2. Under <Ui k="account.dangerZone.heading" />, click <Ui k="account.deleteAccount.button" />.
3. In the dialog, click <Ui k="syncDialog.deleteAccount.confirm" />.

::: warning
Make sure that you do not need the copies in your account. You cannot undo the deletion.
:::

The deletion removes these items from the server:

- your account and the sign-in on every device
- every synced layout, design, baseplate, version and folder
- your published designs in the community gallery, your likes and your print reports

The local copies on this device stay. To remove them too, clear the browser data, or use <Ui k="settings.storage.clearAllData" /> on the <Ui k="settings.tabs.storage" /> tab. Share links are not part of your account, so the deletion does not remove them. Delete each link from the share button first. See [Share a layout](./share-links#change-or-delete-a-link).

## When the server has no sign-in

Sign-in and sync need the server of the Layout Tool. A self-hosted copy has no sign-in, and the sign-in buttons open a short page with a link back to the app. See [Self-hosting](../reference/self-hosting).

## Next steps

- [Your data](../introduction/your-data): what the browser stores and how to back it up.
- [Share a layout](./share-links): send a layout to a person without an account.
- [The community gallery](./community): publish a design under your public name.
- [Settings and accessibility](../settings/settings): the other tabs in Settings.
