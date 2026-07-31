/**
 * Pure geometry for the cutout editor's taper-band overlay.
 *
 * Split out of `TaperBand3D` so the clamping rules can be asserted without a
 * WebGL canvas — the same split as `shapeGeometry` / `cutoutLabelFit`.
 */

import type { TaperBandSides } from '@/features/bin-designer/utils/binDimensions';

/** The un-banded rectangle, in editor mm (origin = front-left interior corner). */
export interface TaperBandInnerRect {
  readonly x0: number;
  readonly x1: number;
  readonly y0: number;
  readonly y1: number;
}

/** True when any side actually reserves a strip. */
export function hasTaperBand(band: TaperBandSides): boolean {
  return band.left + band.right + band.front + band.back > 0;
}

/**
 * The rectangle a full-depth cutout still has to itself.
 *
 * Each side is clamped to half the span before the opposite side is applied, so
 * a flare wider than the bin collapses the rect to a degenerate line at the
 * centre rather than inverting it — an inverted hole would punch the ring
 * inside out and paint the whole interior as band.
 */
export function taperBandInnerRect(
  binWidth: number,
  binDepth: number,
  band: TaperBandSides
): TaperBandInnerRect {
  const x0 = Math.min(Math.max(0, band.left), binWidth / 2);
  const x1 = Math.max(binWidth - Math.max(0, band.right), x0);
  const y0 = Math.min(Math.max(0, band.front), binDepth / 2);
  const y1 = Math.max(binDepth - Math.max(0, band.back), y0);
  return { x0, x1, y0, y1 };
}

/** A degenerate rect must not be punched as a hole. */
export function innerRectIsDrawable(rect: TaperBandInnerRect): boolean {
  return rect.x1 > rect.x0 && rect.y1 > rect.y0;
}
