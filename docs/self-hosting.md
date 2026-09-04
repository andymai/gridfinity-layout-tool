# Self-hosting

The app ships as a container image: the planner, bin designer, baseplate
generator and every exporter run in the browser, so the image is nginx serving
static files. Nothing phones home. The features that need a backend (sharing
by link, sign-in and cloud sync, the community showcase, real-time
collaboration, phone scan) are not part of the image and show an
"unavailable" state; the table below says exactly what.

## Quick start

```bash
docker run -d --name gridfinity -p 8080:8080 --restart unless-stopped \
  ghcr.io/andymai/gridfinity-layout-tool:latest
```

Or with Compose, using the `docker-compose.yml` at the repository root:

```bash
docker compose up -d
```

Open `http://localhost:8080`. The container reports healthy once
`/version.json` answers; that file also tells you which version and commit
are running.

Tags: `latest`, `4.484` (moves with patches) and `4.484.0` (fixed). The image
is multi-arch (amd64 and arm64). It runs as a non-root user, listens on 8080,
and writes only to `/tmp`, so `read_only: true` with a `tmpfs` on `/tmp` is
the intended hardening (the Compose file does this).

### Your data

Layouts and designs live in the browser's storage for the origin you use,
which is the host and port together: `http://localhost:8080` and
`http://192.168.1.5:8080` are two different libraries. Pick one address and
stick to it.

To move between instances, or off the public site: the Layout Manager's
archive export carries every layout plus the bin designs a layout links to;
bin designs that no layout uses export one JSON file each from the design
list; saved baseplate designs have no export of their own, only the baseplate
embedded in a layout travels with it.

## What works, what is cloud-only

| Feature                                                    | Self-hosted | What you'll see                                                                                     |
| ---------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------- |
| Layout planner, layers, print list, inspiration gallery    | Yes         |                                                                                                     |
| Bin designer, baseplate generator, STL / STEP / 3MF export | Yes         |                                                                                                     |
| JSON import and export, layout archives                    | Yes         |                                                                                                     |
| PWA install and offline use                                | Over HTTPS  | See "Plain HTTP on a LAN IP" below                                                                  |
| SpaceMouse                                                 | Over HTTPS  | Not offered on plain HTTP                                                                           |
| Share a layout by link, open a shared link                 | No          | "Server error. Try again later."                                                                    |
| Share a bin design by link                                 | No          | "Cloud features are not available on this self-hosted instance."                                    |
| Sign in, cloud sync across devices                         | No          | The sign-in buttons open a one-line page with a "Back to the app" link                              |
| Community showcase                                         | No          | "Couldn't load the community gallery." with Try again; publishing says "Publishing is switched off" |
| Real-time collaboration                                    | No          | Not offered                                                                                         |
| Phone scan for cutouts                                     | No          | The dialog falls back to SVG upload                                                                 |
| Supporters page                                            | Partly      | The bundled list at the time of the build                                                           |
| Analytics and error reporting                              | No          | Nothing is sent                                                                                     |

Two requests still reach the container on their own and answer 503; both are
harmless and can be ignored in access logs: `/api/supporters` when someone
opens the supporters page, and `/api/ml-telemetry` only if the image was
built without the self-hosted flag.

## Reverse proxy, TLS, and updating

Terminate TLS at your proxy and pass requests through unchanged; the container
sets the app's security headers itself, including the cross-origin isolation
headers, so do not strip them. Send `X-Forwarded-Proto` (every common proxy
does): the container emits `Strict-Transport-Security` only when that header
says `https`, because HSTS is your policy, not the app's. Browsers ignore HSTS
over plain HTTP, so a client setting the header itself changes nothing.

Traefik, as Compose labels on the `app` service:

```yaml
labels:
  - traefik.enable=true
  - traefik.http.routers.gridfinity.rule=Host(`gridfinity.example.com`)
  - traefik.http.routers.gridfinity.entrypoints=websecure
  - traefik.http.routers.gridfinity.tls.certresolver=letsencrypt
  - traefik.http.services.gridfinity.loadbalancer.server.port=8080
```

The app is built for the site root. Hosting it under a path such as
`/gridfinity/` is not supported.

### Plain HTTP on a LAN IP

Use HTTPS, or open the app on `localhost` (browsers treat it as secure). On
`http://<lan-ip>:8080` the browser refuses the secure-context APIs the app
relies on: no service worker, so no install, offline use, or update prompt;
no SpaceMouse; and the bin designer's cutout tools, STL and scan import,
version history, assemblies and knife-rest pairing fail because they generate
IDs with a secure-context-only API. The planner, exports and imports work.

### Updating

Pull the new tag and recreate the container (`docker compose pull && docker
compose up -d`). Open tabs check for a new version hourly, when the tab becomes
visible again and when they come back online, then reload on their own within
a minute of idle time; otherwise the version button in the sidebar shows
"Reload". There is no skew protection, so a tab that stays open across an
upgrade may reload once on its next navigation. Over plain HTTP there is no
service worker, and the new build simply arrives on the next page load.

## Build from source without Docker

Any static file server can host the app. Build with Node 24 and pnpm (corepack
picks the pinned version):

```bash
corepack enable
pnpm install --frozen-lockfile
VITE_SELF_HOSTED=1 GIT_SHA=$(git rev-parse HEAD) GIT_COMMIT_TIME=$(git log -1 --format=%cI) pnpm run build
find dist -name '*.map' -delete
```

`VITE_SELF_HOSTED=1` drops the Vercel analytics script, ML telemetry and the
sign-in check, none of which have a backend off the public site. The two git
values feed `version.json`; without them it reports an unknown commit. The
source maps are for error-tracking upload and nothing serves them.

`dist/` then holds the app shell, the prerendered content pages as
directories with an `index.html`, the hashed `assets/`, the geometry kernels
and the service worker. The minimum a static host needs, and what
`docker/nginx.conf` does in full:

- Serve `/assets/*` as immutable for a year; serve `sw.js`, `index.html` and
  `manifest.webmanifest` with `max-age=0, must-revalidate`; serve
  `version.json` with `no-store`.
- Serve a directory's `index.html` for a request without a trailing slash, so
  `/guide` and `/designer` work without a redirect.
- Answer the in-app routes `/supporters`, `/community`, `/s/<id>`,
  `/l/<id>` and `/scan/<id>` with the shell, and everything else that does not
  exist with a 404, never with the shell.
- Answer `/api/*` with a 503; the app treats that as "feature unavailable".
- Set the same security headers the container sets (they are listed in the
  config).

The page loads Inter from Google Fonts at runtime with a silent fallback to a
system font, so an air-gapped instance still renders.

The project is licensed under the AGPL: if you modify it and let others use
your instance over a network, you must offer them your source. See
[LICENSE](../LICENSE).
