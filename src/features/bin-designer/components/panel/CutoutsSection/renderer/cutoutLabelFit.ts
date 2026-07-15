/**
 * Auto-fit font sizing for the 2D cutout-label preview.
 *
 * Mirrors the worker's `buildTextSolid` sizing so the on-screen label tracks
 * the printed engraving: fit to the available band, then let an explicit
 * `fontSizeOverride` cap (never grow) the result. Kept out of the R3F component
 * file so it can be unit-tested without rendering (react-refresh forbids
 * non-component exports there).
 */

import type { TextStyleDefaults } from '@/features/bin-designer/types';
import type { CutoutLabelPlacement } from '@/shared/utils/cutoutLabel';

/** Approximate width of a glyph relative to font size for drei's SDF font. */
const CHAR_WIDTH_RATIO = 0.6;

/**
 * Largest font size (mm) whose estimated bbox fits the band, clamped to the
 * design's min/max and then capped by `fontSizeOverride` when set. Returns
 * `null` when even the floor overflows — matching the worker, which skips the
 * engraving rather than shrink it illegibly.
 */
export function fitLabelFontSize(
  label: string,
  placement: CutoutLabelPlacement,
  textDefaults: TextStyleDefaults,
  fontSizeOverride: number | undefined
): number | null {
  const availW = placement.availW - 2 * textDefaults.margin;
  const availD = placement.availD - 2 * textDefaults.margin;
  if (availW <= 0 || availD <= 0) return null;
  const widthLimited = availW / (label.length * CHAR_WIDTH_RATIO);
  const fitted = Math.min(widthLimited, availD);
  if (fitted < textDefaults.minFontSize) return null;
  const autoFit = Math.min(fitted, textDefaults.maxFontSize);
  // Cap at the override, floored at minFontSize (autoFit is already ≥ it) so a
  // crafted sub-floor override still renders legibly — matches the worker.
  return fontSizeOverride !== undefined
    ? Math.min(autoFit, Math.max(textDefaults.minFontSize, fontSizeOverride))
    : autoFit;
}
