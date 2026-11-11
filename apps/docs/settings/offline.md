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

No Wi-Fi in the workshop? No problem. The Gridfinity Layout Tool runs in your browser, and it keeps a copy of itself on your device. You can install it as an app with its own window, and you can plan drawers and design bins without an internet connection. Here is what works offline, and how a new version gets to you.

## Install the app

Your browser can install the Layout Tool as an app. While the Layout Tool is open, use the install command of your browser. The app has no install button of its own.

The installed app has the name Gridfinity Layout Tool. It opens in its own window, without the address bar, and starts on the layout editor. It uses the same data as the browser tab, because it is the same site.

## Get ready to work offline

The first visit stores the core of the app. The other parts download the first time that you open them, so do this once while you are online:

1. Open the layout editor, the bin designer and the baseplate generator.
2. In the bin designer and the baseplate generator, wait until the preview shows a model.

After that, these tools also start without a connection. A tool that you did not open while online is not available offline.

## Work offline

When the connection stops, a message tells you: <Ui k="toast.offline" /> Your layouts and designs save in the browser as usual. When the connection comes back, you see <Ui k="toast.online" />.

These features need the server, so they do not work offline:

| Feature                                          | What happens offline                                                   |
| ------------------------------------------------ | ---------------------------------------------------------------------- |
| [Share links](../sharing/share-links)            | You can't make, change or open a share link.                           |
| [Live sessions](../sharing/live-collaboration)   | You are not in the room until the connection comes back.               |
| [Sign-in and sync](../sharing/accounts-and-sync) | Changes wait in the browser and upload when the connection comes back. |
| [The community gallery](../sharing/community)    | The gallery doesn't load. It tries again when you are back online.     |
| [Phone scan](../cutouts/phone-scan)              | The phone can't send the scan to your computer.                        |
| These docs                                       | The pages don't load. The app does not keep a copy of them.            |

## How updates arrive

The Layout Tool looks for a new version at these times:

- when the page loads
- when you come back to the tab
- every hour while the tab is open
- when the connection comes back

A new version downloads in the background. The Layout Tool then waits for a pause in your work before it reloads. It doesn't reload while:

- you drag, resize, draw or paint bins
- bins sit in the stash
- the large 3D preview is open
- a dialog or a menu is open
- you type in a field
- a sync runs

If you take a short break during the first minute, the update applies then. If you don't stop, the version button at the bottom of the side panel changes to <Ui k="pwaUpdate.reload" />. The update then applies when you click that button, when you leave the tab, or after 5 minutes without input.

Just before the reload, this message shows: <Ui k="toast.updating" />

After the reload, the Layout Tool puts back your selection, the active layer, the zoom, the panels and the 3D preview. You can continue where you stopped.

<Screenshot id="settings-offline-reload-button" alt="The version button at the bottom of the side panel, with the Reload label that shows when a new version is ready." spec="Layout editor, desktop, on a preview deploy with a newer build waiting. Keep the pointer moving so the update does not apply on its own. Crop to the bottom of the left side panel with the version button and its tooltip." />

## Get the newest version

Want the update at once? Look at the version button at the bottom of the side panel. If it shows <Ui k="pwaUpdate.reload" />, click it.

If the button shows only the version number, you have the newest version that your browser found. Click the button to see what changed in recent versions. To see a summary after each update, turn on <Ui k="settings.general.showUpdateSummaries" /> in Settings > <Ui k="settings.tabs.general" />.

Once in a while, a stored copy of the app fails to load after an update. The app then clears that copy and loads the newest version from the server. It does this one time for each tab, so a damaged version can't get stuck in a reload loop.

::: info
A self-hosted copy of the Layout Tool on plain HTTP cannot install or work offline. Use HTTPS or `localhost`. See [Use HTTPS](../reference/self-hosting#use-https).
:::

## Next steps

- [Your data and privacy](../introduction/your-data): where the browser keeps your layouts, and how to back them up.
- [Accounts and sync](../sharing/accounts-and-sync): keep a copy of your work in your account.
- [Settings and accessibility](./settings): the other tabs in Settings.
