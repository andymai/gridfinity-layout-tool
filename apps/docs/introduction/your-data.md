---
title: Your data and privacy
description: 'Learn what stays in your browser, what goes to the server, and how to control it.'
sources:
  - src/core/storage/
  - src/core/sync/
  - api/auth/README.md
  - api/sync/account.ts
  - src/shared/analytics/posthog/
  - src/shell/Modals/SettingsModal/tabs/PrivacyTab/
  - src/core/api/share.ts
  - api/auth/providers/github.ts
---

# Your data and privacy

You don't need an account for the Gridfinity Layout Tool, and your work stays in your browser unless you choose to share or sync it. Here's what the Layout Tool keeps on your device, what it sends to the server, and which privacy choices are yours. For the full legal text, read the [privacy policy](https://gridfinitylayouttool.com/privacy).

## What stays in your browser

When you don't sign in, all of your work stays in your browser on this device:

- your layouts, and the history of each layout
- your saved bin designs
- your saved baseplates
- your settings

Each change saves automatically. Most data goes into the database in your browser. If your browser has no database, the Layout Tool falls back to the smaller local storage of about 5 MB. To see which one your browser uses, click <Ui k="sidebar.settings" /> (the gear icon in the header), then click <Ui k="settings.tabs.storage" />.

Your data stays until you delete it. Other browsers and other devices don't see it.

To delete the data in this browser:

1. Click <Ui k="sidebar.settings" /> (the gear icon) in the header.
2. Click <Ui k="settings.tabs.storage" />.
3. Click <Ui k="settings.storage.clearAllData" />, then confirm.

This deletes your layouts, their history, the usage data, and the cached data. It keeps your settings, your saved bin designs and your saved baseplates. To remove everything, also clear the site data for gridfinitylayouttool.com in your browser settings.

## Sign-in and sync

Sign-in is optional. Sign in when you want the same layouts and designs on more than one device. You sign in with a Google or GitHub account, so the Layout Tool never asks for a password or keeps one. [Accounts and sync](../sharing/accounts-and-sync) gives the steps to sign in, sign out and delete your account.

From your Google or GitHub account, the Layout Tool keeps these things:

- an account number that the provider gives you, so the Layout Tool knows you on your next visit
- your email address
- your display name
- with GitHub, your GitHub username

With GitHub, the Layout Tool also reads the list of email addresses that GitHub verified for you. It uses them only to recognize Ko-fi supporters, and it keeps one-way codes made from them, not the addresses.

When you sign in, the Layout Tool copies your work to your account on the server. That covers your layouts, saved bin designs, saved baseplates, layout folders, and the version history of your designs. Only your signed-in session can read them. Each account holds up to 100 layouts, 100 bin designs and 100 baseplates.

When you delete your account, the server deletes all of your synced data and the designs that you published to the community gallery. It also removes your likes and your reports. The local copies on this device stay. See [Delete your account](../sharing/accounts-and-sync#delete-your-account).

## What a share link publishes

<Ui k="share.button.shareLayout" /> in the layout editor header makes a share link. When you click <Ui k="share.createShareLink" />, the Layout Tool uploads a copy of the layout to the server. The copy holds:

- the layout name, the drawer size and the grid options
- the layers, and each bin with its label, notes, custom properties and items
- the categories and their colors
- the bin designs that link to bins in the layout

Anyone with the link can see the copy. By default, they can only view it. Choose <Ui k="share.anyoneWithLinkCanEdit" />, and people can edit the layout with you live. While you edit together, the others see your cursor, your display name and the bins that you select.

Changed your mind? Click <Ui k="share.deleteShareLink" />, and the link stops working.

You can also share without a server copy. The share window of the layout manager can put the whole layout inside the link itself, or save the layout as a JSON file. See [Share without the server](../sharing/share-links#share-without-the-server).

## What publishing makes public

You can publish a bin design to the [community gallery](https://gridfinitylayouttool.com/community). Publishing needs sign-in. These things become public:

- the design, its name and its description
- its preview images and its 3D preview
- the public name that you choose

Search engines can find them, and anyone can download and remix the design under the CC BY 4.0 license. You can unpublish a design at any time. Copies that other people made before you unpublish stay with them.

## Usage analytics

To find bugs and choose what to improve, the Layout Tool sends usage events to an analytics service (PostHog). The events tell which features people use, the device type, errors, speed, and patterns such as drawer sizes and bin counts. A random ID in your browser groups your events. The events don't hold your name or your email address.

To stop the usage events:

1. Click <Ui k="sidebar.settings" /> in the header.
2. Click <Ui k="settings.tabs.privacy" />.
3. Turn off <Ui k="settings.helpImprove" />.

With the switch off, the Layout Tool doesn't start the analytics service, and it deletes the random ID from your browser.

Your browser can also make this choice for you. If your browser sends a Global Privacy Control or Do Not Track signal, the switch starts off. The <Ui k="settings.tabs.privacy" /> tab then shows a note about the signal. You can still turn the switch on.

## Next steps

- [Accounts and sync](../sharing/accounts-and-sync): sign in, sync status, and what to do when sync fails
- [Share a layout](../sharing/share-links): all the ways to share a layout
- [Settings and accessibility](../settings/settings): the other settings tabs
- [Install and work offline](../settings/offline): use the Layout Tool with no connection
