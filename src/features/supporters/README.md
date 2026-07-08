# Supporters

Standalone `/supporters` thank-you page: an immersive, orbitable WebGL scene
(react-three-fiber) where each Ko-fi supporter is a bin seated on a baseplate.
No amounts, no tiers — every bin is equal, order shuffled per load.

## Key files

- `data/supporters.json` — backfilled display names + `anonymousCount`. **Names only; never store emails or amounts.**
- `utils/supportersData.ts` — `buildSupporterBins(rng?)` (shuffled bins), `getSupporterCount()`.
- `utils/supportersLayout.ts` — pure socket-grid layout math (positions on the baseplate).
- `utils/labelText.ts` — pure name word-wrap/truncation (unit-tested; feeds the label texture).
- `scene/palette.ts` — bespoke dark/light palette (independent of the shared `THREE_COLORS`).
- `scene/labelTexture.ts` — renders a name to a `CanvasTexture` in the **system font** (no font file, CSP-safe).
- `components/SupportersScene/` — the R3F scene: camera assembly, lighting, baseplate, cursor-reactive bins, ambient dust, baked shadow. Internal sub-components (one component file).
- `components/SupportersPage/` — DOM orchestrator: `<Canvas>`, hero count-up, CTA + celebration burst, grain/vignette, reduced-motion + mobile gating, and the accessible fallback list.

## Gotchas

- **Bundle boundary:** the whole page is lazy-loaded by `App.tsx`, keeping three/drei out of the main bundle. Keep heavy imports inside this slice.
- **No real shadow maps.** `Canvas` runs without `shadows`; depth comes from directional lighting + a baked `ShadowBlob`. Enabling shadow maps pulls in three's `WebGLShadowMap` and grows the shared three chunk — avoid.
- **The WebGL canvas is inert to assistive tech**, so `SupportersPage` also renders an `sr-only` list of every supporter (named + "Anonymous"). Keep it in sync with the scene.
- **Theme:** the scene reads `useResolvedTheme()` and swaps the palette; both dark and light variants must stay valid.
- **Disposal:** imperatively-created textures (`createLabelTexture`, the shadow blob) are disposed on unmount — follow that pattern for any new texture/geometry.
- Anonymous supporters render as equal frosted bins (no label), not a collapsed count.
- The CTA fires `kofi_clicked` with `source: 'supporters_page'`.

## Wiring (outside this slice)

- Route detection + navigation: `src/shared/hooks/useSupportersRouting.ts`.
- Render gate, SEO meta, command-palette disable: `src/App.tsx` (mirrors `/baseplate`).
- Entry points: `AttributionFooter` link, command palette (`view-supporters`).
