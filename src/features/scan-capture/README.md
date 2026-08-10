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

## Perspective + scale (the size reference)

Something of known real-world size has to be in frame. `traceScene` finds it,
recovers the image→mm homography from it, and rectifies the tool outline
through that. This removes keystone distortion **and** pins true millimetres in
one step, so the shot can be taken from any angle and the desktop receives a
correctly-sized outline (no manual scale step).

`detectReference` tries three, and the order is an **accuracy** ranking rather
than a convenience one:

| Reference                 | Points                     | Verifiable?                              |
| ------------------------- | -------------------------- | ---------------------------------------- |
| Printed calibration sheet | ~18 markers, 72 corners    | Yes — its own 100mm bar                  |
| Gridfinity baseplate      | Every visible socket       | No — see below                           |
| Wallet card               | 4 corners, off to one side | Card stock is accurate to well under 1mm |

**Why more points matter.** Four points determine a homography _exactly_: the
fit is zero-residual by construction, so any corner-detection error is absorbed
silently into the map and then amplified across the frame — small at the
reference, several millimetres at the tool (#3038). A lattice spanning the whole
scanned area is over-determined, so a bad corner averages out instead of
dominating, and the fit can report how well it agrees with itself. Ranging over
the whole area matters as much as the count: the card sits off to one side, so
the tool is solved by extrapolation, while ring markers bracket it.

**Why the baseplate ranks below paper.** It is the same kind of lattice and the
same solve, but a 3D-printed baseplate is not a length standard: its true pitch
carries the owner's own shrinkage and flow calibration — the same uncalibrated
process the scan exists to work around — and nothing on the part reveals the
error. Paper printed at 100% carries a bar you can put calipers on. The phone
says so, once, when the baseplate is what sized the scan.

### The lattice references (sheet + baseplate)

`latticeFit.ts` does the solve and is blind to which reference produced the
cells; `latticeBlobs.ts` finds square-ish blobs for either. Two front ends
supply candidates:

- `gridDetect.ts` — the printed sheet. Markers are ink on paper, so the polarity
  is known ("darker than the threshold", unconditionally — **not** `buildMask`,
  whose border-inferred polarity flips on a dark table). The extent is known
  too, so only the transposed one is tried (a sheet photographed sideways).
  Each marker contributes all **four corners**.
- `baseplateDetect.ts` — a baseplate. Contrast is shading rather than ink, so
  both polarities and several thresholds are swept; the visible extent is
  discovered by fitting every plausible one. Sockets are rounded squares, whose
  extracted corners sit inside the true ones by the corner radius — a bias that
  would land straight in the pitch — so only the **centre** is used, which
  symmetry leaves unbiased.

The printable itself is `scanImport/calibrationSheetSvg.ts`, built from the same
constants (A4 page, also inside US Letter; 5×6 ring of 14mm markers at
Gridfinity's 42mm pitch, so the sheet's lattice and a baseplate's are the same
lattice).

**Two traps worth knowing about**, both in `latticeFit.ts`:

1. **Every integer multiple of a lattice fits it exactly.** A 4×4 socket grid
   fitted against a 7×7 trial pins its corners to nodes 0 and 6, so every socket
   lands on an even node with _zero residual, at twice the true scale_ — and it
   assigns more cells than the correct fit, so it wins on count. Residual, span
   and cell-count checks all pass. The cure is `medianGap`: the fitted lattice
   must be the finest one consistent with the data (median gap between occupied
   columns and rows = 1). Occlusion survives it; doubling does not.
2. **A rotated cell poisons the fit invisibly.** Corner _i_ is paired with slot
   _i_, which is right almost always; when it is wrong the four correspondences
   are individually plausible and jointly rotated, which least squares cannot
   see as an outlier. Each point is checked against its own slot instead.

### The card

Detection is purely **geometric** — it never reads numbers, logos, or the chip.
It picks the cleanest quadrilateral whose perspective-corrected aspect ratio is
≈1.586, so a rectangular tool isn't mistaken for it. That ratio is the **ISO/IEC
7810 ID-1** format (85.6 × 53.98 mm), which virtually every wallet card shares —
bank/credit, transit, ID, driver's licence, gift, hotel key — so any of them work
as the reference, with or without printing on the front.

Those millimetres are an assumption, and the review screen lets you replace it
with a measurement (`CardSizeEditor` → `cardSize.ts`, persisted per device). The
entered size feeds `CardDetectOptions.widthMm/heightMm`, which steers both the
aspect ratio detection looks for and the metric map, so a non-ID-1 reference
works too. Because the card's corners are already solved by the time the editor
is on screen, an edit only re-solves the homography (`withCardSize`) — it never
re-detects or re-segments, so the measured size updates as you type.

With no reference at all, the outline falls back to pixels and the desktop asks
for one real dimension. The card must be a _separate_ object beside the tool
(not underneath it) — unlike the sheet and the baseplate, which the tool sits
on. When a card is found but the shot is steeply tilted (`cardPerspectiveSkew`
above `STEEP_CARD_SKEW`), the phone cautions that sizing accuracy degrades and to
shoot flatter.

**Classical-path limit.** Only DETECTED reference cells are excluded from the
Otsu tool mask, and a cell the tool half-covers is never detected — it merges
with the tool, and its uncovered sliver reads as part of the silhouette. This
bites hardest on a baseplate, where the tool necessarily sits on the sockets;
they cannot be blanked wholesale either, because the tool occupies the same
pixels. The ML path is unaffected (its mask comes from the segmenter), and the
sheet asks you to lay the tool inside the marker frame partly for this reason.

## Segmentation

The tool is isolated with MediaPipe's **Interactive Segmenter** ("Magic Touch", on-device).
On capture an auto-seed (the largest non-reference blob's centroid, via `computeAutoSeed`) drives
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
(`detectCard` + the `finishTrace` tail in `traceScene.ts`). The ML path traces the segmenter's
**soft confidence mask** sub-pixel via marching squares (`softContour.ts`); the classical path
boundary-traces a binary mask. The faceted outline is then **smoothed by Bézier curve fitting**
(`curveFit.ts`, via `fit-curve`) into clean arcs with crisp corners, and a symmetric tool's outline
is **auto-symmetrized** when it scores high enough (`symmetry.ts`). Both are `smooth`-gated — tests
pass `smooth: false` to assert exact card-scale geometry.

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
- `cardSize.ts` — the reference card's real dimensions (long/short, not width/height,
  because that is what `cardHomography` consumes), validated and remembered per device.
  The sheet and the baseplate have no equivalent: their sizes are printed or moulded in,
  so `withCardSize` is a no-op on a lattice-sized scene.
- `components/CardSizeEditor/` — collapsed readout + caliper entry for that size, shown on
  the review screen only when a card was actually detected.

In `@/shared/scanTrace`, for the lattice references:

- `latticeFit.ts` — the reference-agnostic solve (bootstrap → label → least-squares refit,
  plus the span, `medianGap` and residual gates).
- `latticeBlobs.ts` — square-ish blob scan, parameterised by size band and polarity.
- `calibrationGrid.ts` — the printed sheet's lattice (5×6 ring, 42mm pitch, 14mm markers).
- `gridDetect.ts` / `baseplateDetect.ts` — the two front ends.
- `perspective.ts` — `solveHomographyLeastSquares` (Hartley-normalized DLT) and
  `homographyRmsError`, which is what lets a fit be judged at all.

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
