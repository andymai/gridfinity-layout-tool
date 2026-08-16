/**
 * Shared 2D helpers for the printable calibration coupons
 * (connector fit sample, label-plate fit sample).
 */

import type { Drawing } from 'brepjs';
import { draw } from 'brepjs';
import { NOZZLE_BASELINE } from '@/shared/printSettings/connectorScaling';

/**
 * JetBrains Mono metrics, measured from the shipped Regular TTF (unitsPerEm 1000)
 * for the glyphs the fit-offset labels use (digits, sign, and the decimal point):
 *  - the thinnest digit stem is ~0.086·fontSize (the printability-limiting
 *    feature — the sign and "." are chunkier),
 *  - the digits' ink is ~0.75·fontSize tall (they carry no descenders, so they
 *    set the label's ink height), and
 *  - every glyph advances 0.6·fontSize (monospace).
 * The coupon generators size their labels from these so the raised strokes stay
 * printable and the text still fits the coupon.
 */
export const JBM_DIGIT_STEM_PER_FONT = 0.086;
export const JBM_DIGIT_INK_PER_FONT = 0.75;
export const JBM_ADVANCE_PER_GLYPH = 0.6;

/**
 * A raised label stroke narrower than one nozzle bead is dropped by the slicer,
 * which is why the fit-sample coupons sliced blank on a 0.4mm nozzle — their
 * digit stems were ~0.21mm, about half a bead. Target the thinnest
 * stem at ~1.1 beads: a hair above one line so the slicer keeps it after XY
 * (contour) compensation.
 */
const LABEL_STROKE_BEAD_MARGIN = 1.1;
/** Legibility floor so a sub-baseline nozzle still gets readable text (mm). */
const LABEL_LEGIBLE_MIN_FONT = 3.5;

/**
 * Smallest JetBrains Mono font size (mm) whose digit stems still lay down as a
 * full nozzle bead, so an embossed fit-offset label survives slicing (issue
 *). Grows with the nozzle (a wider bead needs a bigger stem), floored at
 * {@link LABEL_LEGIBLE_MIN_FONT} so a sub-baseline nozzle still gets readable
 * text. Unlike the connector-feature scalers, it isn't clamped to the 0.4mm
 * baseline — a finer nozzle can carry a smaller (but still legible) label. A
 * non-finite or non-positive nozzle falls back to the baseline.
 */
export function minPrintableLabelFontMm(nozzleSizeMm: number | undefined): number {
  const nozzle =
    typeof nozzleSizeMm === 'number' && Number.isFinite(nozzleSizeMm) && nozzleSizeMm > 0
      ? nozzleSizeMm
      : NOZZLE_BASELINE;
  return Math.max(
    LABEL_LEGIBLE_MIN_FONT,
    (LABEL_STROKE_BEAD_MARGIN * nozzle) / JBM_DIGIT_STEM_PER_FONT
  );
}

/**
 * Signed fit-offset label, e.g. "+0.05", "-0.10", "0.00" (zero is unsigned).
 * NOT used by the label-plate coupon: labelFitSample keeps a zero-SIGNED
 * variant on purpose, so every label has the same glyph count and coupon
 * volumes stay strictly ordered by pocket size (asserted in its scenario test).
 */
export function formatOffset(v: number): string {
  const s = v.toFixed(2);
  return v > 0 ? `+${s}` : s;
}

export function roundedRect(cx: number, cy: number, w: number, h: number, r: number): Drawing {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  return draw([cx, y0])
    .lineTo([x1, y0])
    .customCorner(r)
    .lineTo([x1, y1])
    .customCorner(r)
    .lineTo([x0, y1])
    .customCorner(r)
    .lineTo([x0, y0])
    .customCorner(r)
    .close();
}
