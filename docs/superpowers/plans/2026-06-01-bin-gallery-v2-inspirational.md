# Bin Gallery v2 — Inspirational Recuration + Live 3D

**Goal:** Reframe the example gallery from "practical starting points" to an **inspirational showcase of the bin designer's full capabilities** — hero-heavy, selectively colored, with a live rotatable 3D preview powered by pre-generated meshes.

**Approved decisions (this session):**

- Curate for visual interest; cut "plain bin" examples (12 cuts approved).
- ~34 total: ~8 mono primers + ~26 colored heroes; cohesive ~3-accent palette over graphite.
- Make hidden features read via: **color**, **per-example camera angle**, **exploded views**.
- Add capabilities: **wall patterns** (new technique), standalone **lid**, **handles**, **engraved text**, more **custom shapes** (T/U/O).
- **Live rotatable 3D preview** in the overlay, using **pre-generated GLB** meshes (no runtime WASM). Cards stay static colored thumbnails. Orbit + gentle auto-spin. Thumbnail shows first, cross-fades to 3D.

## Architecture

### Data model (`types/exampleGallery.ts`)

Add optional presentation overrides to `ExampleDesign`:

```ts
readonly camera?: { azimuth?: number; elevation?: number; zoom?: number }; // thumbnail + initial 3D pose
readonly explode?: number;     // 0..1 lid/explode amount for the render
readonly colored?: boolean;    // whether this example uses feature colors (selective color)
```

Add `'wallPattern'` to `ExampleTechnique` + `TECHNIQUE_CONFIG` (+ i18n label).
Color lives in `params.featureColors` (per-zone) on the colored heroes, using the shared palette.

### Palette (`data/examples/palette.ts`)

A small cohesive set (graphite body + ~3 accents). Helpers to build `featureColors` patches so heroes stay consistent.

### Pre-generated assets

Per example, committed under `data/examples/`:

- `thumbnails/<id>.png` — static card image (colored, chrome-free, per-example camera/explode).
- `meshes/<id>.glb` — geometry for the live viewer (exported in-browser via Three `GLTFExporter`).

`DevThumbnailRoute` extensions:

- Apply `example.params` (incl. featureColors), `camera`, `explode` before capture.
- Expose `window.__captureThumbnail()` (PNG) **and** `window.__exportGlb()` (ArrayBuffer→base64) so the Playwright gen script writes both.

`scripts/gen-example-thumbnails.ts`:

- For each (or `EXAMPLE_ID`-filtered) example: write PNG **and** GLB.

### Live viewer (`components/ExampleGallery/Example3DViewer.tsx`)

- Lazy-load the example's GLB via `import.meta.glob('./meshes/*.glb', { query:'?url' })` (non-eager).
- R3F canvas + `OrbitControls`, gentle `autoRotate`. Graphite background matching thumbnails.
- Show the static thumbnail until the GLB is loaded, then cross-fade.
- Used inside `ExamplePreviewOverlay` (replaces the static `<img>` there; card keeps the `<img>`).

### Resolution helpers (`data/examples/assets.ts`)

`thumbnailUrl(id)` (exists) + `meshUrl(id)` (new, lazy glob). Catalog integrity test asserts both resolve per example.

## Build order (pipeline-first)

1. Schema + palette + `wallPattern` technique + i18n label.
2. GLB export in `DevThumbnailRoute` + gen script (+ `meshUrl` glob + `Example3DViewer`).
3. Prove on 2–3 heroes (color + camera + explode + GLB + live viewer); visual-verify PNG and that GLB loads/orbits. **Checkpoint.**
4. Author full catalog (~34): cut the 12, keep/improve, add heroes + new techniques; cohesive palette; per-example camera/explode.
5. Regenerate ALL thumbnails + meshes.
6. i18n: rename/remove/add keys across en.ts + all locales; regen en.json; pass all 4 i18n checks.
7. Update integrity test (thumbnail + mesh bundled per example; unique ids; validateBinParams; metrics).
8. Update `bin-designer/README.md` gallery section (live viewer + meshes + palette).
9. Full gate: typecheck, lint, boundaries, knip, full suite, size (watch GLB/PNG footprint), e2e (open preview → 3D loads), visual spot check.

## Risks

- **GLTFExporter color fidelity:** multicolor zones must survive export (vertex colors or per-group materials). Verify on a colored hero in step 3.
- **Bundle/repo size:** ~34 GLB + PNG. GLBs lazy-loaded (non-eager glob) so they don't hit the main/modal chunk eagerly; still watch repo size. `pnpm run size` in step 9.
- **Feature legibility:** confirm scoop/label/pattern read with the chosen camera/color in step 3 before scaling.
- **`validateBinParams` gaps:** cutouts/scoop/walls/lid/pattern not validated — rely on visual verification of rendered output.
