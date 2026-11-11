---
title: Install and work offline
description: 'Install the Layout Tool as an app, use it without a connection, and get the newest version.'
sources:
  - vite.config.ts
  - src/shared/hooks/usePWAUpdate.ts
  - src/shared/pwa/
  - src/core/store/pwaUpdate.ts
  - src/shared/components/AppVersionButton/AppVersionButton.tsx
---

# Install and work offline

The Gridfinity Layout Tool runs in your browser, and it keeps a copy of itself on your device. You can install it as an app with its own window, and you can plan drawers and design bins without an internet connection. This page tells you what works offline and how a new version gets to you.

## Install the app

The Layout Tool is a web app that your browser can install. Use the install command of your browser while the Layout Tool is open. The app does not show an install button of its own.

The installed app has the name Gridfinity Layout Tool. It opens in its own window, without the address bar, and starts on the layout editor. It uses the same data as the browser tab, because it is the same site.

## Get ready to work offline

The first visit stores the core of the app. The other parts download when you open them for the first time:

1. Open the layout editor, the bin designer and the baseplate generator once while you are online.
2. In the bin designer and the baseplate generator, wait until the preview shows a model.

After that, these tools also start without a connection. A tool that you did not open while online is not available offline.

## Work offline

When the connection stops, a message tells you: <Ui k="toast.offline" /> Your layouts and designs save in the browser as usual. When the connection comes back, a message shows <Ui k="toast.online" />.

These features need the server, so they do not work offline:

| Feature                                          | What happens offline                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| [Share links](../sharing/share-links)            | You cannot make, change or open a share link.                          |
| [Live sessions](../sharing/live-collaboration)   | You are not in the room until the connection comes back.               |
| [Sign-in and sync](../sharing/accounts-and-sync) | Changes wait in the browser and upload when the connection comes back. |
| [The community gallery](../sharing/community)    | The gallery does not load. It tries again when you are back online.    |
| [Phone scan](../cutouts/phone-scan)              | The phone cannot send the scan to your computer.                       |

## How updates arrive

The Layout Tool looks for a new version at these times:

- when the page loads
- when you come back to the tab
- every hour while the tab is open
- when the connection comes back

A new version downloads in the background. The Layout Tool then waits for a pause in your work before it reloads. It does not reload in these conditions:

- You drag or resize a bin.
- Bins sit in the stash.
- A dialog or a menu is open.
- You type in a field.
- A sync runs.

If you stop work for a short time during the first minute, the update applies then. If you keep on working, the version button at the bottom of the side panel changes to <Ui k="pwaUpdate.reload" />. The update then applies when you click that button, when you leave the tab, or after 5 minutes without input.

Just before the reload, this message shows: <Ui k="toast.updating" />

After the reload, the Layout Tool restores your selection, the active layer, the zoom, the panels and the 3D preview.

<Screenshot id="settings-offline-reload-button" alt="The version button at the bottom of the side panel, with the Reload label that shows when a new version is ready." spec="Layout editor, desktop, on a preview deploy with a newer build waiting. Keep the pointer moving so the update does not apply on its own. Crop to the bottom of the left side panel with the version button and its tooltip." />

## Get the newest version

1. Look at the version button at the bottom of the side panel.
2. If it shows <Ui k="pwaUpdate.reload" />, click it.

When the button shows only the version number, you have the newest version that your browser found. Click the button to see what changed in recent versions. To see a summary after each update, turn on <Ui k="settings.general.showUpdateSummaries" /> in Settings > <Ui k="settings.tabs.general" />.

Sometimes a stored copy of the app fails to load after an update. The app then clears that copy and loads the newest version from the server. It does this one time for each tab, so a damaged version cannot reload without end.

::: info
A self-hosted copy of the Layout Tool on plain HTTP cannot install or work offline. Use HTTPS or `localhost`. See [Use HTTPS](../reference/self-hosting#use-https).
:::

## Next steps

- [Your data and privacy](../introduction/your-data): where the browser keeps your layouts, and how to back them up.
- [Accounts and sync](../sharing/accounts-and-sync): keep a copy of your work in your account.
- [Settings and accessibility](./settings): the other tabs in Settings.
