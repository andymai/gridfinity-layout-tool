/**
 * Shared 2D helpers for the printable calibration coupons
 * (connector fit sample, label-plate fit sample).
 */

import type { Drawing } from 'brepjs';
import { draw } from 'brepjs';

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
