# scan-capture

Mobile capture page for the "scan a tool with your phone" flow (`/scan/:token`).

## What it does

The desktop bin designer shows a QR code (see `bin-designer/.../scanImport`). Scanning
it opens this page on the phone. The user photographs a tool; the tool is segmented to a
2D silhouette **in the browser**, the user confirms (and can tap the tool to redo the
outline), and the outline SVG is uploaded to the scan session the desktop is polling. The
desktop then drops it in as a cutout.

The photo never leaves the device — segmentation runs locally and only the traced outline
SVG is uploaded. The segmentation **model asset** is fetched from our own origin (see
"Segmentation" below); the photo is never sent anywhere.

## Perspective + scale (the card)

If a bank card (ISO 85.6 × 53.98 mm) is in frame next to the tool, `traceScene`
detects it, recovers the image→mm homography from its four corners, and rectifies
the tool outline through it. This removes keystone distortion **and** pins true
millimetres in one step, so the shot can be taken from any angle and the desktop
receives a correctly-sized outline (no manual scale step). The card is identified
by an angle-invariant aspect-ratio check (≈1.586), so a rectangular tool isn't
mistaken for it. With no card, the outline falls back to pixels and the desktop
asks for one real dimension. The card must be a _separate_ object beside the tool
(not underneath it).

## Segmentation

The tool is isolated with MediaPipe's **Interactive Segmenter** ("Magic Touch", on-device).
On capture an auto-seed (the largest non-card blob's centroid, via `computeAutoSeed`) drives
a first pass; the user can **tap the tool** to re-segment around that point. This replaced
the old global Otsu threshold + "adjust outline" slider, which had no notion of _which_
object was the tool and frequently traced the background, the card, or a sub-region.

The model + WASM runtime are **lazy-imported** in `interactiveSegment.ts` (dynamic
`import('@mediapipe/tasks-vision')`), so they never enter the eager scan bundle. Assets are
self-hosted under `/models/` — the model `magic_touch.tflite` is committed; the
tasks-vision WASM is copied from the pinned npm package at build by
`scripts/vite-plugin-mediapipe-assets.ts`. If the model can't load, `ScanPage` silently
falls back to the classical `traceScene` (Otsu) path so the feature still works.

Card detection, homography, and the contour/simplify tail are shared by both paths
(`detectCard` + `buildToolTrace` in `traceScene.ts`). The faceted outline is **Chaikin-smoothed**
(`smooth.ts`) into curves (a `buildToolTrace` option; tests pass `smooth: false` to assert exact
card-scale geometry).

The traced outline is the tool's **exact silhouette** — FDM fit (clearance, entry chamfer, scoop)
is **not** baked here. It's applied at generation time as adjustable `Cutout` fields, exactly like
parametric cutouts: scanned outlines import with a default `clearance` + `chamferWidth` (see
`scanImport/useScanImport.ts`), and the generator offsets the flattened path outline for the
clearance/chamfer and fillets its bottom edges for the scoop. This keeps the phone pipeline simple
and the fit fully tunable on the desktop.

## Pieces

- `scanRouting.ts` — pure `/scan/:token` path helpers (`isScanPath`, `getScanToken`).
  Imported by `main.tsx` (cheap route detection) and `shell/scanBoot.tsx`.
- `components/ScanPage.tsx` — the capture UI: guided capture → segment → review (tap to
  redo) → upload. App-like full-bleed layout with safe-area handling and a fixed action bar.

## Boot path & bundle isolation

This route is **not** mounted inside the editor. `main.tsx` detects `/scan/:token` and
dynamically imports `shell/scanBoot.tsx`, which mounts only `ScanPage` under
`LocaleProvider`. This keeps the page off the 3D/generation bundle and skips the
layout/library store hydration.

Do not import `three`, `@react-three/*`, `bin-designer`, or `baseplate` from here. MediaPipe
must stay **lazy-imported** (never a static top-level import) so it doesn't anchor the eager
scan bundle.

## Dependencies

- Segmentation: `@/shared/scanTrace` (`decodeImageToCanvas` + `computeAutoSeed` +
  `segmentAt` + `traceSceneSegmented`, classical `traceScene` fallback).
- Handoff endpoint: `POST /api/scan-session/:token` (see `api/scan-session/[token].ts`).
- A Vercel rewrite maps `/scan/:token` → `/` (`vercel.json`).
