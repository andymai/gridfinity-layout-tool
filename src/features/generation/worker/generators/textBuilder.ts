/**
 * Engraved-text geometry builder.
 *
 * Materializes user text as a 3D solid that the host (label tab, cutout
 * surround) booleans against. Three modes:
 *  - `engrave` — extrude downward into the host (caller cuts)
 *  - `emboss`  — extrude upward above the host (caller fuses)
 *  - `through-cut` — extrude downward through the full host depth (caller cuts)
 *
 * Auto-fits font size via `textMetrics` so we never materialize geometry just
 * to measure. Fonts are loaded once at worker init; if the requested family
 * isn't in the registry, the builder returns `null` so the host generation
 * still completes.
 *
 * Through-cut auto-swaps to `allerta-stencil` regardless of the user's font
 * pick: non-stencil glyphs have free-floating counter islands (O, A, D…)
 * that fall out of a printed cutout.
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
import type { TextFontFamily, TextMode } from '@/shared/types/bin';

export interface FitResult {
  /** Rendered font size in mm; `min` if even the smallest size overflows. */
  readonly fontSize: number;
  /** Whether the chosen size honors both width and depth constraints. */
  readonly fits: boolean;
}

/**
 * Pick the largest font size whose rendered bbox fits the given width/depth
 * budget, clamped to [min, max]. Returns `{ fits: false }` if even `min`
 * overflows.
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
  // fontSize so a ratio-based shortcut is possible, but the bounded loop
  // (14 iterations) stays correct if metrics ever become non-linear
  // (e.g. hinting changes between sizes).
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
 * Whether the host should `cut` or `fuse` the returned solid. Engrave and
 * through-cut both cut; emboss fuses.
 */
export type TextOp = 'cut' | 'fuse';

export interface TextSolidResult {
  readonly solid: Shape3D;
  readonly op: TextOp;
}

export interface BuildTextSolidOptions {
  readonly text: string;
  readonly fontFamily: TextFontFamily;
  readonly mode: TextMode;
  /** Total available width for auto-fit, in mm (margin not yet subtracted). */
  readonly availW: number;
  /** Total available depth for auto-fit, in mm (margin not yet subtracted). */
  readonly availD: number;
  /** Visual centroid X for the text bbox in the host's local frame. */
  readonly centerX: number;
  /** Visual centroid Y for the text bbox in the host's local frame. */
  readonly centerY: number;
  /** Z of the host's top face in the local frame; sketch origin sits here. */
  readonly topZ: number;
  /** Engrave/emboss depth in mm. */
  readonly depth: number;
  /**
   * Total host thickness in mm. Through-cut extrudes through `hostThickness +
   * 2·EPSILON` to guarantee clean both-face exits; engrave/emboss ignore it.
   */
  readonly hostThickness: number;
  /** Padding to host edge for auto-fit, in mm. */
  readonly margin: number;
  /** Auto-fit floor in mm. */
  readonly minFontSize: number;
  /** Auto-fit ceiling in mm. */
  readonly maxFontSize: number;
}

/** Lift sketches above the host top face so booleans don't touch coincident
 *  surfaces (an OCCT fragility point that occasionally produces nullspace
 *  results). 0.01mm is below any printable feature. Exported so tests can
 *  assert against the same tolerance the runtime uses instead of duplicating
 *  the magic number. */
export const TEXT_BOOLEAN_EPSILON = 0.01;

/**
 * Apply the stencil-font auto-swap for through-cut mode. The user's font
 * pick is honored for engrave/emboss; through-cut always uses
 * `allerta-stencil` so glyph counters survive as connected islands.
 */
export function resolveEffectiveFont(font: TextFontFamily, mode: TextMode): TextFontFamily {
  return mode === 'through-cut' ? 'allerta-stencil' : font;
}

/**
 * Build a text solid placed in the host's local frame and ready for the
 * caller to apply via the returned `op` (`cut` or `fuse`).
 *
 * Returns `null` when text is empty/whitespace, the resolved font isn't
 * loaded, or the auto-fit floor would exceed `minFontSize`.
 */
export function buildTextSolid(
  scope: DisposalScope,
  options: BuildTextSolidOptions
): TextSolidResult | null {
  const trimmed = options.text.trim();
  if (!trimmed) return null;

  const fontFamily = resolveEffectiveFont(options.fontFamily, options.mode);
  if (!getFont(fontFamily)) return null;

  const availW = options.availW - 2 * options.margin;
  const availD = options.availD - 2 * options.margin;
  const fit = fitFontSize(
    trimmed,
    fontFamily,
    availW,
    availD,
    options.minFontSize,
    options.maxFontSize
  );
  if (!fit.fits) return null;

  const metrics = textMetrics(trimmed, { fontSize: fit.fontSize, fontFamily });
  if (!isOk(metrics)) return null;

  // Sketch origin: engrave/through-cut start just above the top face and
  // extrude DOWN; emboss starts at the top face and extrudes UP.
  const sketchOriginZ =
    options.mode === 'emboss' ? options.topZ : options.topZ + TEXT_BOOLEAN_EPSILON;
  const extrusion =
    options.mode === 'emboss'
      ? options.depth
      : options.mode === 'through-cut'
        ? -(options.hostThickness + 2 * TEXT_BOOLEAN_EPSILON)
        : -(options.depth + TEXT_BOOLEAN_EPSILON);

  const sketches = sketchText(
    trimmed,
    { fontSize: fit.fontSize, fontFamily },
    { plane: 'XY' as PlaneName, origin: [0, 0, sketchOriginZ] }
  );
  const extruded = scope.register(sketches.extrude(extrusion));

  // textMetrics: width is total advance; vertical bbox spans descender..ascender.
  // Visual centroid in the sketch frame = (width/2, (ascender + descender)/2).
  const visualCenterX = metrics.value.width / 2;
  const visualCenterY = (metrics.value.ascender + metrics.value.descender) / 2;
  const solid = scope.register(
    translate(extruded, [options.centerX - visualCenterX, options.centerY - visualCenterY, 0])
  );

  return { solid, op: options.mode === 'emboss' ? 'fuse' : 'cut' };
}

/**
 * @deprecated Prefer `buildTextSolid` which supports all 3 modes. Kept as a
 * thin wrapper so existing callers (and tests) that only need engrave keep
 * working without churn.
 */
export function buildEngraveCutSolid(
  scope: DisposalScope,
  options: Omit<BuildTextSolidOptions, 'mode' | 'hostThickness'>
): Shape3D | null {
  const result = buildTextSolid(scope, { ...options, mode: 'engrave', hostThickness: 0 });
  return result ? result.solid : null;
}
