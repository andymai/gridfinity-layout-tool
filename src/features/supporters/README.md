# Supporters

Standalone `/supporters` thank-you page: an orbitable WebGL workshop scene
(react-three-fiber) where each Ko-fi supporter is a **real generated Gridfinity
bin** (stacking lip, base feet, label tab) seated on a real socketed baseplate.
No amounts, no tiers — every bin is equal, order shuffled per load.

## Key files

- `data/supporters.json` — backfilled display names + `anonymousCount`. **Names only; never store emails or amounts.**
- `data/meshes/*.glb` + `data/meshMeta.json` — Draco GLBs of the real 1×1×3
  label-tab bin and 1×1 baseplate tile, baked by `scripts/gen-supporters-meshes.ts`
  from the production OCCT generators (scene units: Y-up, 1 unit = 42mm, bottom
  at Y=0). `meshMeta.json` records the label-tab rectangle measured from the
  `LABEL_TAB` face group so name tapes land exactly on the shelf. **Re-run the
  script instead of editing these by hand.**
- `data/meshes.ts` — resolves the GLBs to bundled hashed URLs (`import.meta.glob` + `?url`).
- `utils/supportersData.ts` — `buildSupporterBins(rng?)` (shuffled bins), `getSupporterCount()`.
- `utils/supportersLayout.ts` — pure layout math: bin seats on exact 42mm pitch,
  a one-socket empty margin ring, the reserved front ghost socket, and
  `computeCameraFrame()` (aspect-aware auto-framing that scales with supporter count).
- `utils/labelText.ts` — pure name word-wrap/truncation (unit-tested; feeds the tab texture).
- `scene/palette.ts` — dual workshop palettes (dark = evening workshop, light =
  daylit workbench) + the per-theme matte-PLA `filament` mix and `filamentColorFor()`.
- `scene/labelTexture.ts` — renders a name as a printed label-tape strip
  (`CanvasTexture`, **system font**, no font file, CSP-safe) for the tab shelf.
- `components/SupportersScene/` — the R3F scene: all bins as ONE `InstancedMesh`
  with per-instance filament colors, instanced socket tiles, per-bin label-tape
  planes that mirror instance transforms each frame, constrained `OrbitControls`
  with idle auto-drift, intro dolly, magnetic cursor bins, the clickable ghost
  bin, baked shadow, and single-draw-call dust points.
- `components/SupportersPage/` — DOM orchestrator: `<Canvas>`, hero count-up,
  CTA + celebration burst, grain/vignette, reduced-motion + mobile gating, and
  the accessible fallback list.

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
- **Theme:** the scene reads `useResolvedTheme()` and swaps the palette; both
  workshop variants must stay valid.
- **Disposal:** imperatively-created textures (tab tapes, the shadow blob, dust
  geometry) are disposed on unmount — follow that pattern for any new
  texture/geometry. `useGLTF` geometries are cached by drei; do not dispose them.
- Anonymous supporters get the same filament-mix bins with a localized
  "Anonymous" tape — equal, not visually second-class.
- The translucent ghost bin on the front margin row is a second Ko-fi door:
  clicking it fires `kofi_clicked` with `source: 'supporters_page_ghost_bin'`;
  the DOM CTA uses `source: 'supporters_page'`.
- After any generator change that should be reflected here, re-bake:
  `pnpm run gen:supporters-meshes`.

## Wiring (outside this slice)

- Route detection + navigation: `src/shared/hooks/useSupportersRouting.ts`.
- Render gate, SEO meta, command-palette disable: `src/App.tsx` (mirrors `/baseplate`).
- Entry points: `AttributionFooter` link, command palette (`view-supporters`).
- Mesh bake script: `scripts/gen-supporters-meshes.ts` (headless OCCT, same
  init path as the generator scenario tests).
