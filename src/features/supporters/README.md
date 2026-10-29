# Supporters

Standalone `/supporters` page, staged as the end credits of a game. A first
visit opens on a victory title card, then supporters roll up a credits column
beside a baseplate that starts empty: each supporter's bin drops into their
department's zone as their name passes, and the roll ends on the full plate
with one glowing empty socket ("The end? your bin here"). Return visits
(remembered per browser) and reduced motion open on that finale.

Every supporter is a **real generated Gridfinity bin** (stacking lip, base feet,
label tab) on a real socketed baseplate, styled like the app: THREE_COLORS
backgrounds, the #d4d8dc preview plastic, the user's accent. No amounts and no
tiers are ever shown, and credit order is shuffled per load. The only
per-person distinction is the newest supporter's glow and "just joined" tag.

Departments are joke Gridfinity departments ("Spaghetti Incident Response"),
one of eight per named supporter, assigned by the server and stable across
renames. Anonymous supporters roll last in the Department of [REDACTED], one
redaction bar each. A public message gets its own credit line beside the name.

## Supporter benefits

Supporting is recognized in the app, and the recognition is deliberately
**cosmetic only** — nothing functional is ever gated, so "free, ad-free" stays
literally true. Two things:

- **A supporter badge** beside the author name on community cards, design
  detail, and print reports (`@/shared/components/SupporterBadge`). Public by
  default with an off switch, and clickable — the gallery is the most-viewed
  surface in the app and /supporters is a destination almost nobody navigates
  to, so every badge is also a door to the ask.
- **Self-service control of your own bin**: rename it, rewrite or clear your
  message, or go anonymous, from the panel on this page. This replaces the
  manual "email me to change your name" queue the opt-out line used to be.

Recognition is independent of anonymity: an opted-out supporter is still keyed
by `deriveDonorId`, so they get their badge without ever appearing on the wall.

**How an account is matched** — salted hashes of provider-verified emails only,
never a typed address. The security reasoning (no enumeration oracle, no
takeover of someone else's bin) and the Redis shapes live in `api/README.md`
under "Supporter recognition"; do not re-derive them here.

## Data flow

Redis is the source of truth. `api/kofi-webhook.ts` receives each Ko-fi payment,
verifies it, and writes the supporter to the `supporters:donors` hash as a
compact JSON record (`{n: name, t: joinedAt, m?: message}`; legacy bare-name
values are still parsed). The payment amount is folded into a **collect-only**
per-currency `supporters:totals` counter, never tied to a person and never
served. `api/supporters.ts` serves the list, adding a credits `department` to
each named supporter: a hash of their donor field, so it survives a rename and
the field itself never leaves the server. `hooks/useSupportersData.ts` fetches it.

Ko-fi has **no read API and no webhook replay**, so the live feed only ever sees
payments made after it went live. Historical supporters (dates, messages,
totals) are backfilled once from a manually-exported Ko-fi transaction CSV via
`pnpm seed-supporters --csv <Transaction_All.csv>` — see `api/README.md` for the
ingest rules. `data/supporters.json` is only the offline fallback (see below).

## The roll

- **One clock drives everything.** `utils/creditsClock.ts` is the only playhead:
  the DOM roll's offset, which bins are seated, and the camera's zone are all
  read from it, so rewinding lifts bins back out with no extra code. Put new
  motion on the clock, not on a timer of its own.
- **Pacing comes from reading time.** `CreditsRoll` measures the rendered
  credits (again on resize, and when the pixel font swaps in), and
  `utils/rollSchedule.ts` turns those positions into a `utils/rollTimeline.ts`
  table whose speed dips inside each quote's reading window. The untouched
  length follows from the messages, not a target duration.
- **The camera shares the screen** by shifting the projection
  (`setViewOffset`) into the space the credits leave, never by resizing the
  canvas. `supportersSceneCamera.tsx` owns it until the finale framing settles,
  then enables OrbitControls; disabled controls never update, so they cannot
  fight it.
- **Input** (`hooks/useRollScrub.ts`): wheel and drag scrub by distance, arrows
  hold to fast-forward or rewind, Space pauses, End skips. Any control that
  takes its own wheel or keys needs `data-no-scrub`.
- **Extras ride the same clock.** Achievements (`hooks/useAchievements.ts`)
  are a per-browser keepsake; "sat through" needs the clock's `played` end,
  which a seek, skip or held fast-forward never reports. A shared
  `?credit=<name>` link (`utils/creditLink.ts`) lands from `CreditsRoll`'s
  ready callback, because seeking needs the roll measured. Pokes and the
  post-credits guest (`postCreditsPose.ts`) live only in the scene.
- **Sound is opt-in and synthesised** (`audio/`): an original tune on a chip
  synth, no audio file. `CreditsSoundtrack` gives the tune its own playhead
  moving at the clock's rate, so a fast-forward speeds it up, a pause muffles
  it and a rewind warbles. No Web Audio exists until sound is on.

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
- `utils/supportersData.ts`: `buildSupporterBins(data?, rng?)` (shuffled bins,
  flags the newest by `joinedAt`), `getSupporterCount(data?)`,
  `joinedThisMonth()`, `FALLBACK_SUPPORTERS`, and `isSupportersData()` (the API
  response is untrusted input, so narrow it).
- `utils/creditsPlan.ts`: departments, the roll's items (message lines spread
  between name blocks, gag cards), and each bin's zone and slot.
- `utils/supportersLayout.ts`: `computeZonedLayout()` (equal zones three
  across, one-socket aisles, a label row in front of each zone, the vacant
  socket) and `computeCameraFrame()`.
- `scene/palette.ts`: app-matched palette, with per-theme accent hexes mirroring
  `src/shell/styles/themes.css` (**keep in lockstep**).
- `scene/labelTexture.ts`: name tapes and department strips as `CanvasTexture`s
  in the **system font** (no font file, CSP-safe).
- `components/SupportersScene/`: the R3F scene, split by part (plate and
  labels, bins, camera, vacant socket). All bins are ONE `InstancedMesh` whose
  drop progress follows the clock; `CameraFocus.tsx` flies to a found bin in
  the finale.
- `components/CreditsRoll/`, `CreditsTitleCard/`, `CreditsControls/`,
  `CreditsFinale/`: the DOM side of the credits. Headings use the self-hosted
  Press Start 2P (`@fontsource`); names and quotes stay in the app font so
  every script renders.
- `components/SupportersPage/`: the orchestrator (phase, clock, find, panel,
  scrims), plus `hooks/useProfileOverlay.ts`, which shows a profile save at
  once although `/api/supporters` is edge-cached.
- `components/SupporterPanel/`: the benefits and self-service sheet; a bottom
  sheet on mobile.
- `api/supporterClient.ts` + `hooks/useSupporterStatus.ts`: the caller's own
  record. Never throws: an anonymous visitor, an expired session, and a failed
  request all mean the same thing to the page (show the ask).
- `constants.ts`: client mirrors of the server's name/message caps and
  department count, pinned to `api/lib/supporters.ts` by `constants.test.ts`;
  the server is the authority.

## Gotchas

- **Departments are permanent.** Changing `SUPPORTER_DEPARTMENT_COUNT` or the
  order of `DEPARTMENT_TITLE_KEYS` reassigns almost every supporter. The
  bundled fallback carries no departments, so the client hashes names there.
- **Bundle boundary:** the whole page is lazy-loaded by `App.tsx`, keeping
  three/drei and the pixel font out of the main bundle. The GLBs load via
  `useGLTF` with the **self-hosted** Draco decoder in `public/draco/` (CSP
  forbids the default CDN).
- **Scale:** bin bodies are one draw call at any count, and zones grow with the
  largest department. Label tapes are one small plane per bin, fine to ~500.
- **No real shadow maps.** Depth comes from directional lighting and a baked
  `ShadowBlob`; shadow maps grow the shared three chunk.
- **The credits are the accessible list.** They are real text, kept in the
  document (faded, not removed) after the roll, so screen readers always have
  every supporter; redaction bars are labelled "Anonymous".
- **jsdom lays nothing out**, so a roll measures as zero length. Tests that need
  one stub `offsetTop`, `offsetHeight` and `clientHeight` (see `CreditsRoll`).
- **Theme:** the scene follows `useResolvedTheme()` + `settings.accentColor`;
  both themes and all six accents must stay valid.
- **Disposal:** imperatively-created textures (tapes, strips, the shadow blob)
  are disposed on unmount; `useGLTF` geometries are cached by drei, so never
  dispose those.
- **Recency degrades quietly:** the fallback and legacy records carry no
  `joinedAt`, so "joined this month" and the newest glow simply don't render.
  Never assume a bin has a date.
- **Messages are public-only and auto-published:** stored only alongside a
  public name (`is_public`), passed through `filterMessage` (length cap + the
  shared content filter), shown with no manual review. The self-service edit is
  a **second door onto the same text** and re-runs the identical server-side
  gauntlet.
- **Find-your-bin can't find the anonymous:** a bin is located by NAME, the only
  handle the public list carries, so the search reports "can't be searched" and
  the panel's "show me my bin" is absent for them.
- **The panel waits for the status read** rather than guessing a branch and
  showing a supporter the ask.
- **Sign-in from here stashes a return path** (`saveAuthReturnPath('/supporters')`),
  restored by `useCommunityLikeReturn` ABOVE its community feature-flag gate.
- Ko-fi doors (`kofi_clicked` sources): `supporters_credits` (the quiet button
  during the roll), `supporters_page` (the finale), `supporters_socket` (the
  vacant socket), `supporters_panel` (the panel).
- After any generator change that should show here, re-bake:
  `pnpm run gen:supporters-meshes`.

## Wiring (outside this slice)

- Route detection + navigation: `src/shared/hooks/useSupportersRouting.ts`.
- Render gate, SEO meta, command-palette disable: `src/App.tsx` (mirrors `/baseplate`).
- Entry points: `AttributionFooter` link, command palette (`view-supporters`), and
  every supporter badge in the community gallery (`supporters_page_opened`).
- Badge component: `src/shared/components/SupporterBadge/` (shared, because both
  this slice and `features/community` render it).
- Match + badge storage: `api/lib/supporterLink.ts`, wired into the OAuth
  callback, `api/supporters/me.ts`, the community list/detail/prints responses,
  and the account-deletion cascade.
- Mesh bake script: `scripts/gen-supporters-meshes.ts` (headless OCCT, same
  init path as the generator scenario tests).
