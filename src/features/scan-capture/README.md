# scan-capture

Mobile capture page for the "scan a tool with your phone" flow (`/scan/:token`).

## What it does

The desktop bin designer shows a QR code (see `bin-designer/.../scanImport`). Scanning
it opens this page on the phone. The user photographs a tool; the photo is traced to a
2D silhouette **in the browser**, the user confirms/adjusts it, and the outline SVG is
uploaded to the scan session the desktop is polling. The desktop then drops it in as a
cutout.

The photo never leaves the device — only the traced outline SVG is uploaded.

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

## Pieces

- `scanRouting.ts` — pure `/scan/:token` path helpers (`isScanPath`, `getScanToken`).
  Imported by `main.tsx` (cheap route detection) and `shell/scanBoot.tsx`.
- `components/ScanPage.tsx` — the capture UI: take photo → trace → review (with a
  threshold slider) → upload.

## Boot path & bundle isolation

This route is **not** mounted inside the editor. `main.tsx` detects `/scan/:token` and
dynamically imports `shell/scanBoot.tsx`, which mounts only `ScanPage` under
`LocaleProvider`. This keeps the page off the 3D/generation bundle and skips the
layout/library store hydration.

Do not import `three`, `@react-three/*`, `bin-designer`, or `baseplate` from here.

## Dependencies

- Tracing: `@/shared/scanTrace` (`decodeImageToImageData` + `traceToPoints`).
- Handoff endpoint: `POST /api/scan-session/:token` (see `api/scan-session/[token].ts`).
- A Vercel rewrite maps `/scan/:token` → `/` (`vercel.json`).
