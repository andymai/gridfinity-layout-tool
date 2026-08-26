/**
 * Auto-fit font sizing for the 2D cutout-label preview.
 *
 * Mirrors the worker's `buildTextSolid` sizing so the on-screen label tracks
 * the printed engraving: fit to the available band, then let an explicit
 * `fontSizeOverride` cap (never grow) the result — or, when the per-cutout
 * style pins `sizeMode: 'fixed'`, render the asked-for size and shrink only
 * when the band cannot hold it. Kept out of the R3F component
 * file so it can be unit-tested without rendering (react-refresh forbids
 * non-component exports there).
 */

import type { TextStyleDefaults, TextStyleOverride } from '@/features/bin-designer/types';
import { cutoutWorldAabb, hasExplicitLabelSize } from '@/shared/utils/cutoutLabel';
import type { CutoutAabb, CutoutLabelPlacement } from '@/shared/utils/cutoutLabel';

/** Approximate width of a glyph relative to font size for drei's SDF font. */
const CHAR_WIDTH_RATIO = 0.6;

/**
 * Largest font size (mm) whose estimated bbox fits the band, clamped to the
 * design's min/max and then shaped by the per-cutout style: an explicit fixed
 * size is a target the band no longer caps (the caller hands the widened band
 * in), a `fontSizeOverride` caps (never grows) the auto-fit. Returns
 * `null` when even the floor overflows — matching the worker, which skips the
 * engraving rather than shrink it illegibly.
 */
export function fitLabelFontSize(
  label: string,
  placement: CutoutLabelPlacement,
  textDefaults: TextStyleDefaults,
  textStyle: TextStyleOverride | undefined
): number | null {
  const availW = placement.availW - 2 * textDefaults.margin;
  const availD = placement.availD - 2 * textDefaults.margin;
  if (availW <= 0 || availD <= 0) return null;
  const widthLimited = availW / (label.length * CHAR_WIDTH_RATIO);
  const fitted = Math.min(widthLimited, availD);
  if (hasExplicitLabelSize(textStyle)) {
    // Matches the worker's fixed path: the asked-for size is honoured whenever
    // it fits (uncapped by maxFontSize, unfloored by minFontSize), and shrinks
    // only to fit — with the legibility floor applying to the shrink alone.
    const target = textStyle?.fixedSize ?? textDefaults.fixedSize;
    if (target <= fitted) return target;
    return fitted >= textDefaults.minFontSize ? fitted : null;
  }
  if (fitted < textDefaults.minFontSize) return null;
  const autoFit = Math.min(fitted, textDefaults.maxFontSize);
  const fontSizeOverride = textStyle?.fontSizeOverride;
  // Cap at the override, floored at minFontSize (autoFit is already ≥ it) so a
  // crafted sub-floor override still renders legibly — matches the worker.
  return fontSizeOverride !== undefined
    ? Math.min(autoFit, Math.max(textDefaults.minFontSize, fontSizeOverride))
    : autoFit;
}

/**
 * Estimated world AABB of a rendered label, from the same glyph-width
 * approximation the size fit uses, rotation-aware like a cutout footprint.
 * Drives the overlap warning for explicit-size labels; an estimate is enough,
 * because the warning flags a placement decision, not a measurement.
 */
export function estimateLabelAabb(
  label: string,
  fontSize: number,
  centerX: number,
  centerY: number,
  angleDeg: number
): CutoutAabb {
  const width = label.length * CHAR_WIDTH_RATIO * fontSize;
  return cutoutWorldAabb(
    {
      x: centerX - width / 2,
      y: centerY - fontSize / 2,
      width,
      depth: fontSize,
      rotation: angleDeg,
    },
    0,
    0
  );
}

export function aabbsIntersect(a: CutoutAabb, b: CutoutAabb): boolean {
  return a.minX < b.maxX && b.minX < a.maxX && a.minY < b.maxY && b.minY < a.maxY;
}
