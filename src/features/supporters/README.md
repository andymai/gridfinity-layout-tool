# Supporters

Standalone `/supporters` thank-you page: an orbitable WebGL workshop scene
(react-three-fiber) where each Ko-fi supporter is a **real generated Gridfinity
bin** (stacking lip, base feet, back-edge label tab) seated on a real socketed
baseplate, styled to match the app: THREE_COLORS backgrounds, the app-default
#d4d8dc preview plastic, and the user's chosen accent. No amounts and no tiers
are ever shown — every bin is equal and the order is shuffled per load. The
single exception is the most recent supporter, whose bin gets a soft arrival
glow.

Each supporter also carries a **join date** and, for those shown publicly, a
short **message**. Those drive the recency touches (a "joined this month" line,
the newest-bin glow, a muted support-over-time sparkline) and a rotating quote
near the CTA. A **find-your-bin** search flies the camera to your bin.

## Data flow

Redis is the source of truth. `api/kofi-webhook.ts` receives each Ko-fi payment,
verifies it, and writes the supporter to the `supporters:donors` hash as a
compact JSON record (`{n: name, t: joinedAt, m?: message}`; legacy bare-name
values are still parsed). The payment amount is folded into a **collect-only**
per-currency `supporters:totals` counter, never tied to a person and never
served. `api/supporters.ts` serves the list; `hooks/useSupportersData.ts`
fetches it.

Ko-fi has **no read API and no webhook replay**, so the live feed only ever sees
payments made after it went live. Historical supporters (dates, messages,
totals) are backfilled once from a manually-exported Ko-fi transaction CSV via
`pnpm seed-supporters --csv <Transaction_All.csv>` — see `api/README.md` for the
ingest rules. `data/supporters.json` is only the offline fallback (see below).

## Key files

- `data/supporters.json` — the reconciled public list seeded into Redis once via
  `pnpm seed-supporters`. Still bundled as the **fallback** when
  `/api/supporters` is unreachable, so an outage shows a stale baseplate instead
  of an empty one. **Names only — never emails, amounts, dates, or messages;**
  recency and messages live in Redis and stay dormant on the fallback.
- `scripts/seed-supporters.ts` + `.core.ts` — one-time seed/backfill. `--csv`
  enriches the `seed:*` records with real join dates and best messages from a
  Ko-fi export (attributing a name only if it's in the public list) and writes
  the `supporters:totals` baseline. Messages/emails go to Redis only, never disk.
- `hooks/useSupportersData.ts` — fetch + fallback + `settled`. The page holds
  its render until `settled`, so a hanging request can't block it forever
  (`FETCH_TIMEOUT_MS`). An empty API response is treated as "not seeded yet" and
  keeps the fallback rather than wiping the scene.
- `data/meshes/*.glb` + `data/meshMeta.json` — Draco GLBs of the real 1×1×3
  label-tab bin and 1×1 baseplate tile, baked by `scripts/gen-supporters-meshes.ts`
  from the production OCCT generators at preview tolerance (scene units: Y-up,
  1 unit = 42mm, bottom at Y=0; the bin is baked with a front tab and spun 180°
  because the generator's mirrored back-tab tessellates with inverted shelf
  normals). Each GLB carries a second LINES primitive with the real BREP edge
  overlay (Douglas-Peucker-simplified — Draco can't compress lines), so bins
  get the same black edge lines as the in-app previews. `meshMeta.json` records
  the label-tab rectangle measured from the `LABEL_TAB` face group so name
  tapes land exactly on the shelf. **Re-run the script instead of editing these
  by hand.**
- `data/meshes.ts` — resolves the GLBs to bundled hashed URLs (`import.meta.glob` + `?url`).
- `utils/supportersData.ts` — `buildSupporterBins(data?, rng?)` (shuffled bins,
  flags the newest by `joinedAt`), `getSupporterCount(data?)`, `joinedThisMonth()`,
  `supportHistogram()` (sparkline series), `FALLBACK_SUPPORTERS`,
  `isSupportersData()` (the API response is untrusted input — narrow it).
- `utils/supportersLayout.ts` — pure layout math: bin seats on exact 42mm pitch,
  a one-socket empty margin ring, and `computeCameraFrame()` (aspect-aware
  auto-framing that scales with supporter count).
- `utils/labelText.ts` — pure name word-wrap/truncation (unit-tested; feeds the tab texture).
- `scene/palette.ts` — app-matched palette: `THREE_COLORS` backgrounds, uniform
  #d4d8dc bins/plate, and per-theme accent hexes mirroring
  `src/shell/styles/themes.css` (**keep in lockstep**). Accent follows
  `settings.accentColor`.
- `scene/labelTexture.ts` — renders a name as a printed label-tape strip
  (`CanvasTexture`, **system font**, no font file, CSP-safe) for the tab shelf.
- `components/SupportersScene/` — the R3F scene: all bins as ONE `InstancedMesh`,
  instanced socket tiles, per-bin label-tape planes and edge overlays that
  mirror instance transforms each frame, one merged `LineSegments` for all
  plate-tile edges, constrained `OrbitControls` (drag-orbit only, no idle
  auto-rotate), intro dolly, magnetic cursor bins, newest-bin glow, and baked
  shadow. `CameraFocus.tsx` drives the find-your-bin fly-to (exports `FlyToRequest`).
- `components/SupportersPage/` — DOM orchestrator: `<Canvas>`, hero count-up +
  "joined this month", find-your-bin search, corner sparkline, rotating public
  message + purpose line by the CTA, celebration burst, reduced-motion + mobile
  gating, and the accessible fallback list.

## Gotchas

- **Bundle boundary:** the whole page is lazy-loaded by `App.tsx`, keeping
  three/drei out of the main bundle. Keep heavy imports inside this slice.
  The GLBs load via `useGLTF` with the **self-hosted** Draco decoder in
  `public/draco/` (CSP forbids the default CDN) — same pattern as the
  bin-designer example gallery.
- **Scale architecture:** bin bodies are one draw call at any supporter count;
  the camera auto-frames the growing plate per viewport aspect (portrait pulls
  back further). Label tapes are one small plane per bin — fine to ~500.
- **No real shadow maps.** `Canvas` runs without `shadows`; depth comes from
  directional lighting + a baked `ShadowBlob`. Enabling shadow maps grows the
  shared three chunk — avoid.
- **The WebGL canvas is inert to assistive tech**, so `SupportersPage` also
  renders an `sr-only` list of every supporter (named + "Anonymous"). Keep it
  in sync with the scene.
- **Theme:** the scene follows `useResolvedTheme()` + `settings.accentColor`;
  both theme variants and all six accents must stay valid.
- **Disposal:** imperatively-created textures (tab tapes, the shadow blob) are
  disposed on unmount — follow that pattern for any new
  texture/geometry. `useGLTF` geometries are cached by drei; do not dispose them.
- Anonymous supporters get the same bins with a localized "Anonymous" tape —
  equal, not visually second-class.
- **Recency degrades quietly:** the fallback and legacy records carry no
  `joinedAt`, so "joined this month", the sparkline, and the newest glow simply
  don't render until real dated data loads (each has its own reveal threshold).
  Never assume a bin has a date.
- **Messages are public-only and auto-published:** a message is stored only
  alongside a public name (`is_public`), passed through `filterMessage` (length
  cap + the shared content filter), and shown with no manual review. An opted-out
  supporter surfaces neither name nor message.
- **Find-your-bin can't find the anonymous:** opted-out supporters have no stored
  name, so the search reports "can't be searched" for them — keep that empty state.
- The only Ko-fi door is the DOM CTA (`kofi_clicked`,
  `source: 'supporters_page'`).
- After any generator change that should be reflected here, re-bake:
  `pnpm run gen:supporters-meshes`.

## Wiring (outside this slice)

- Route detection + navigation: `src/shared/hooks/useSupportersRouting.ts`.
- Render gate, SEO meta, command-palette disable: `src/App.tsx` (mirrors `/baseplate`).
- Entry points: `AttributionFooter` link, command palette (`view-supporters`).
- Mesh bake script: `scripts/gen-supporters-meshes.ts` (headless OCCT, same
  init path as the generator scenario tests).
