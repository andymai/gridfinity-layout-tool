/**
 * Engraved text geometry builder.
 *
 * Renders user-supplied strings as 3D solids that can be booleaned into a
 * host (label tab, cutout, etc.). Auto-fits the font size to a constrained
 * area using `textMetrics` — much cheaper than the "build, measure, scale"
 * pattern because metrics never materialize geometry.
 *
 * Fonts are loaded once at worker init by `wasmInstantiator.loadEmbeddedFonts`;
 * if loading failed (network failure, non-OCCT kernel), this module returns
 * `null` rather than throwing so the host generation still completes.
 */

import {
  sketchText,
  textMetrics,
  translate,
  getFont,
  type Shape3D,
  type DisposalScope,
  type PlaneName,
} from 'brepjs';
import { isOk } from '@/core/result';
import type { TextFontFamily } from '@/shared/types/bin';

/** Result of binary-search auto-fit. */
export interface FitResult {
  /** Rendered font size in mm; 0 if even `min` doesn't fit. */
  readonly fontSize: number;
  /** Whether the chosen size honors both width and depth constraints. */
  readonly fits: boolean;
}

/**
 * Pick the largest font size whose rendered bounding box fits the given
 * width/depth budget, clamped to [min, max]. Returns `{ fits: false }`
 * if even the minimum size overflows.
 */
export function fitFontSize(
  text: string,
  fontFamily: TextFontFamily,
  availW: number,
  availD: number,
  min: number,
  max: number
): FitResult {
  if (!text || availW <= 0 || availD <= 0 || min <= 0 || max < min) {
    return { fontSize: 0, fits: false };
  }
  const minMetrics = textMetrics(text, { fontSize: min, fontFamily });
  if (!isOk(minMetrics) || minMetrics.value.width > availW || minMetrics.value.height > availD) {
    return { fontSize: 0, fits: false };
  }
  // Binary search to ~0.05mm precision. textMetrics scales linearly with
  // fontSize, so we could short-circuit with a ratio — but the binary loop
  // is bounded at 14 iterations and stays correct if metrics ever become
  // non-linear (e.g. hinting changes between sizes).
  let lo = min;
  let hi = max;
  let best = min;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const m = textMetrics(text, { fontSize: mid, fontFamily });
    if (!isOk(m)) break;
    if (m.value.width <= availW && m.value.height <= availD) {
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 0.05) break;
  }
  return { fontSize: best, fits: true };
}

/**
 * Build an engrave-cut text solid sized for the host area and translated so
 * its visual bbox is centered on `(centerX, centerY)`. The solid extends
 * downward from `topZ` by `depth + EPSILON` and is intended to be boolean-cut
 * from the host.
 *
 * Returns `null` if the font isn't loaded, the text is empty, or the auto-fit
 * floor would be below `minFontSize`.
 */
export function buildEngraveCutSolid(
  scope: DisposalScope,
  options: {
    text: string;
    fontFamily: TextFontFamily;
    availW: number;
    availD: number;
    centerX: number;
    centerY: number;
    topZ: number;
    depth: number;
    margin: number;
    minFontSize: number;
    maxFontSize: number;
  }
): Shape3D | null {
  const trimmed = options.text.trim();
  if (!trimmed) return null;
  if (!getFont(options.fontFamily)) return null;

  const availW = options.availW - 2 * options.margin;
  const availD = options.availD - 2 * options.margin;
  const fit = fitFontSize(
    trimmed,
    options.fontFamily,
    availW,
    availD,
    options.minFontSize,
    options.maxFontSize
  );
  if (!fit.fits) return null;

  const metrics = textMetrics(trimmed, { fontSize: fit.fontSize, fontFamily: options.fontFamily });
  if (!isOk(metrics)) return null;

  // Lift the sketch slightly above the host top face so the cut starts cleanly
  // (avoids coincident-face fragility in the OCCT boolean).
  const EPSILON = 0.01;
  const sketches = sketchText(
    trimmed,
    { fontSize: fit.fontSize, fontFamily: options.fontFamily },
    { plane: 'XY' as PlaneName, origin: [0, 0, options.topZ + EPSILON] }
  );
  const solid = scope.register(sketches.extrude(-(options.depth + EPSILON)));

  // textMetrics: width is total advance, vertical bbox spans descender..ascender.
  // Visual centroid in the sketch frame = (width/2, (ascender + descender)/2).
  const visualCenterX = metrics.value.width / 2;
  const visualCenterY = (metrics.value.ascender + metrics.value.descender) / 2;
  return scope.register(
    translate(solid, [options.centerX - visualCenterX, options.centerY - visualCenterY, 0])
  );
}
