---
title: Self-hosting with Docker
description: 'Run the Layout Tool on your own server with Docker, see what works without the hosted service, and update it.'
sources:
  - docs/self-hosting.md
  - Dockerfile
  - docker-compose.yml
  - docker/nginx.conf
  - .github/workflows/docker.yml
  - src/shared/hooks/usePWAUpdate.ts
---

# Self-hosting with Docker

Want the Layout Tool on your own computer, home server or NAS? The Gridfinity Layout Tool runs in your browser, so a small container image can serve it. Use this page to start the image, see which features need the hosted service, and update your copy.

The image holds only static files behind a web server. The layout editor, the bin designer, the baseplate generator and every export run in your browser, so they all work in your copy.

## Run the image

1. Install Docker on the computer that serves the app.
2. Run this command:

   ```bash
   docker run -d --name gridfinity -p 8080:8080 --restart unless-stopped \
     ghcr.io/andymai/gridfinity-layout-tool:latest
   ```

3. Open `http://localhost:8080` in your browser.

Prefer Docker Compose? Save this file as `docker-compose.yml` in a folder, then run `docker compose up -d` in that folder:

```yaml
services:
  app:
    image: ghcr.io/andymai/gridfinity-layout-tool:latest
    ports:
      - '8080:8080'
    restart: unless-stopped
    read_only: true
    tmpfs:
      - /tmp
```

The container reports healthy when `/version.json` answers. That file also shows the version and the commit that run.

| Fact         | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Image        | `ghcr.io/andymai/gridfinity-layout-tool`                                |
| Port         | 8080                                                                    |
| Platforms    | amd64 and arm64                                                         |
| User         | Not root                                                                |
| Disk writes  | Only to `/tmp`, so a read-only container with a `tmpfs` on `/tmp` works |
| Tag `latest` | The newest release                                                      |
| Tag `X.Y`    | The newest patch of one minor version                                   |
| Tag `X.Y.Z`  | One exact release that does not change                                  |

## Use one address

Pick one address and always open the app there. Your browser keeps layouts and designs separately for each address, and the port is part of the address. So `http://localhost:8080` and `http://192.168.1.5:8080` give you two different libraries.

## What works in your copy

| Feature                                                     | In your copy | Notes                                          |
| ----------------------------------------------------------- | ------------ | ---------------------------------------------- |
| Layout editor, layers, print list, inspiration gallery      | Yes          |                                                |
| Bin designer, baseplate generator, STL, STEP and 3MF export | Yes          |                                                |
| JSON import and export, layout archives                     | Yes          |                                                |
| Install the app and work offline                            | HTTPS only   | Also works on `localhost`                      |
| SpaceMouse                                                  | HTTPS only   | Also works on `localhost`                      |
| Share a layout by link, open a shared link                  | No           | The app shows an error                         |
| Sign in and sync across devices                             | No           | The sign-in buttons open a short notice page   |
| Community gallery and publish                               | No           | The gallery shows an error, and publish is off |
| Live collaboration                                          | No           | The app does not offer it                      |
| Phone scan for cutouts                                      | No           | The dialog offers an SVG upload instead        |
| Supporters page                                             | Partly       | It shows the list from the day of the build    |
| Analytics and error reports                                 | No           | Your copy sends nothing                        |

The container answers every request to `/api/` with a "service unavailable" status. The app reads that answer as "this feature is not available here".

These pages explain the features that need the server: [Share a layout](../sharing/share-links), [Work together live](../sharing/live-collaboration), [Accounts and sync](../sharing/accounts-and-sync) and [The community gallery](../sharing/community).

## Move your data into your copy

Your layouts on the public site stay in the browser storage of that site. To bring them over to your copy:

1. On the public site, open the layout manager with <kbd>Ctrl</kbd>+<kbd>O</kbd> (<kbd>Cmd</kbd>+<kbd>O</kbd> on a Mac).
2. Click <Ui k="layouts.exportAll" />. The archive holds every layout and the bin designs that the layouts link to.
3. Open your copy and open the layout manager.
4. Click <Ui k="common.import" /> and drop the archive file.

A bin design that no layout uses does not go into the archive. Export it as a design file from <Ui k="binDesigner.savedDesigns" />, then import it in your copy. Saved baseplate designs have no export of their own. Only the baseplate inside a layout moves with that layout.

## Use HTTPS

Serve your copy over HTTPS, or open it on `localhost`. On a plain `http://` address, such as a LAN IP, the browser blocks a few features:

- no install, no offline use and no update prompt
- no SpaceMouse
- the button that copies the print list to the clipboard does nothing

Everything else works, the bin designer too.

If you put a reverse proxy in front of the container, end TLS at the proxy and pass the requests through. Keep the security headers that the container sets, and send the `X-Forwarded-Proto` header. Serve the app at the root of a domain: a path such as `/gridfinity/` does not work.

## Update your copy

1. Pull the new image: `docker compose pull`.
2. Start the new container: `docker compose up -d`.

Open tabs look for a new version every hour, when the tab becomes visible again, and when the network comes back. A tab reloads by itself when you pause your work for a moment. If you don't pause, the version button in the sidebar shows <Ui k="pwaUpdate.reload" />. On a plain `http://` address, the new version arrives the next time you load the page.

::: warning
If you change the app and let other people use your copy over a network, offer them your source code. The AGPL license requires it.
:::

## Next steps

- [Your data and privacy](../introduction/your-data): where the Layout Tool keeps your layouts and designs.
- [Install and work offline](../settings/offline): install the app from your browser.
- [Organize your layouts](../layouts/organizing-layouts): export and import layouts and archives.
- [Accounts and sync](../sharing/accounts-and-sync): the hosted sync that your copy does not have.
