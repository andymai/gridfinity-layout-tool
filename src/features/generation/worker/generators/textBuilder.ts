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
  rotate,
  getFont,
  type Shape3D,
  type DisposalScope,
  type PlaneName,
} from 'brepjs';
import { isOk } from '@/core/result';
import type { TextFontFamily, TextMode } from '@/shared/types/bin';
import { getTextSolid, setTextSolid, textSolidKey } from './textSolidCache';

export interface FitResult {
  /** Rendered font size in mm; `0` if `fits` is false. */
  readonly fontSize: number;
  /** Whether the chosen size honors both width and depth constraints. */
  readonly fits: boolean;
}

/** Reference size for the single linear measurement in `fitFontSize`. 1mm keeps
 *  the per-unit-size width/height directly readable from the bbox. */
const FIT_REFERENCE_SIZE = 1;
/** Slack on the fit verification so float drift can't reject an exact fit. */
const FIT_EPSILON = 1e-6;

type Metrics = ReturnType<typeof textMetrics>;

/** Memoize `textMetrics` — it's pure given (text, fontSize, fontFamily) and is
 *  the dominant cost of auto-fit. Keyed on the exact size so a cache hit always
 *  returns metrics for the size requested (the auto-fit verify and
 *  `buildTextSolid`'s follow-up measurement use the same size, and uniform tabs
 *  produce identical sizes for the same text). Bounded so a long session can't
 *  grow it without limit. MUST be cleared when fonts (re)load or the kernel
 *  switches — see `clearTextMetricsMemo`, wired into `clearAllCaches`. */
const metricsMemo = new Map<string, Metrics>();
const METRICS_MEMO_MAX = 512;

function measureText(text: string, fontSize: number, fontFamily: TextFontFamily): Metrics {
  const key = `${fontFamily}|${fontSize}|${text}`;
  const cached = metricsMemo.get(key);
  if (cached) return cached;
  const result = textMetrics(text, { fontSize, fontFamily });
  // Simple bounded eviction: drop the oldest entry once at capacity. Insertion
  // order is preserved by Map, so the first key is the oldest.
  if (metricsMemo.size >= METRICS_MEMO_MAX) {
    const oldest = metricsMemo.keys().next().value;
    if (oldest !== undefined) metricsMemo.delete(oldest);
  }
  metricsMemo.set(key, result);
  return result;
}

/** Drop all memoized text metrics. Call when the font registry changes (font
 *  (re)load, kernel switch) — `textMetrics` results depend on the loaded font. */
export function clearTextMetricsMemo(): void {
  metricsMemo.clear();
}

/**
 * Pick the largest font size whose rendered bbox fits the given width/depth
 * budget, clamped to [min, max]. Returns `{ fits: false }` if even `min`
 * overflows.
 *
 * `textMetrics` scales EXACTLY linearly with fontSize for the pinned brepjs
 * build (width = glyph advance width, vertical metrics scale by
 * `fontSize / unitsPerEm`; no hinting in this code path), so one measurement at
 * a reference size yields the ideal size directly — no search needed. A single
 * verify call confirms the pick fits; if it doesn't (clamp-to-min overflow, or
 * hypothetically non-linear metrics) or a measurement isn't `isOk`, we fall back
 * to the robust binary search rather than dropping the text. Re-verify the
 * linearity assumption on brepjs bumps.
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
  const ref = measureText(text, FIT_REFERENCE_SIZE, fontFamily);
  if (!isOk(ref) || ref.value.width <= 0 || ref.value.height <= 0) {
    // Degenerate measurement (missing glyphs, all-whitespace) — avoid dividing
    // by zero and defer to the search, which has its own min-overflow guard.
    return fitFontSizeBisect(text, fontFamily, availW, availD, min, max);
  }
  // width(s) = ref.width · s / FIT_REFERENCE_SIZE → solve each axis for its
  // limiting size, take the smaller, then clamp to [min, max].
  const sizeForW = (availW * FIT_REFERENCE_SIZE) / ref.value.width;
  const sizeForH = (availD * FIT_REFERENCE_SIZE) / ref.value.height;
  const size = Math.min(max, Math.max(min, Math.min(sizeForW, sizeForH)));

  const check = measureText(text, size, fontFamily);
  const fits =
    isOk(check) &&
    check.value.width <= availW + FIT_EPSILON &&
    check.value.height <= availD + FIT_EPSILON;
  if (fits) return { fontSize: size, fits: true };
  // The linear pick didn't verify as fitting. With exactly-linear metrics this
  // only happens when `size` was clamped to `min` and `min` itself overflows.
  // Defer to the search either way: it returns fits:false for that clamp case
  // (matching the old behavior) and, were metrics ever non-linear, would still
  // find a smaller fitting size instead of dropping the text. Costs nothing on
  // the common path (the early return above).
  return fitFontSizeBisect(text, fontFamily, availW, availD, min, max);
}

/**
 * Robust fallback: binary search to ~0.05mm precision. Reached when the linear
 * pick doesn't verify as fitting or a measurement isn't `isOk` (a font edge
 * case) — kept so the builder degrades gracefully rather than producing
 * geometry from an unverified size.
 */
function fitFontSizeBisect(
  text: string,
  fontFamily: TextFontFamily,
  availW: number,
  availD: number,
  min: number,
  max: number
): FitResult {
  const minMetrics = measureText(text, min, fontFamily);
  if (!isOk(minMetrics) || minMetrics.value.width > availW || minMetrics.value.height > availD) {
    return { fontSize: 0, fits: false };
  }
  let lo = min;
  let hi = max;
  let best = min;
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2;
    const m = measureText(text, mid, fontFamily);
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
  /**
   * Optional rotation in degrees about the text's own center (the visual
   * centroid placed at `centerX`/`centerY`). Default 0 (upright). The sign
   * matches the cutout-rotation convention (negated about +Z) so a label tracks
   * the 2D editor preview. Auto-fit still measures the unrotated glyph run.
   */
  readonly angleDeg?: number;
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

  // Reuses the memo entry from `fitFontSize`'s verify call at this exact size.
  const metrics = measureText(trimmed, fit.fontSize, fontFamily);
  if (!isOk(metrics)) return null;

  // All three modes need the EPSILON lift to avoid coplanar boolean fragility:
  //  - engrave / through-cut: sketch sits ABOVE topZ, extrudes DOWN through it
  //  - emboss: sketch sits BELOW topZ, extrudes UP through it
  // Either way the solid penetrates the host's top face by EPSILON so the
  // fuse/cut surfaces overlap instead of being coincident.
  const sketchOriginZ =
    options.mode === 'emboss'
      ? options.topZ - TEXT_BOOLEAN_EPSILON
      : options.topZ + TEXT_BOOLEAN_EPSILON;
  const extrusion =
    options.mode === 'emboss'
      ? options.depth + TEXT_BOOLEAN_EPSILON
      : options.mode === 'through-cut'
        ? -(options.hostThickness + 2 * TEXT_BOOLEAN_EPSILON)
        : -(options.depth + TEXT_BOOLEAN_EPSILON);

  // Reuse the canonical glyph solid (sketched at Z=0) when another compartment
  // already built this exact text. The Z lift onto the host face is folded into
  // the translate below — building at Z=0 then translating by `sketchOriginZ` is
  // identical to sketching there, but the geometry is placement-independent and
  // therefore shareable across compartments.
  const canonical = getOrBuildCanonicalTextSolid(
    scope,
    trimmed,
    fontFamily,
    options.mode,
    fit.fontSize,
    options.depth,
    options.hostThickness,
    extrusion
  );

  // textMetrics: width is total advance; vertical bbox spans descender..ascender.
  // Visual centroid in the sketch frame = (width/2, (ascender + descender)/2).
  const visualCenterX = metrics.value.width / 2;
  const visualCenterY = (metrics.value.ascender + metrics.value.descender) / 2;

  const angle = options.angleDeg ?? 0;
  let solid: Shape3D;
  if (angle === 0) {
    solid = scope.register(
      translate(canonical, [
        options.centerX - visualCenterX,
        options.centerY - visualCenterY,
        sketchOriginZ,
      ])
    );
  } else {
    // Rotate about the glyph's own center: recenter at the origin, spin about
    // +Z (negated to match the cutout-rotation convention), then place at the
    // target center. Intermediates are scope-registered for disposal.
    const centered = scope.register(translate(canonical, [-visualCenterX, -visualCenterY, 0]));
    const rotated = scope.register(rotate(centered, -angle, { axis: [0, 0, 1] }));
    solid = scope.register(translate(rotated, [options.centerX, options.centerY, sketchOriginZ]));
  }

  return { solid, op: options.mode === 'emboss' ? 'fuse' : 'cut' };
}

/**
 * Build the canonical glyph solid (sketch origin at Z=0) for the given text, or
 * return a clone of the cached one. The returned shape is registered in `scope`
 * so the caller can translate it and let the scope dispose it; an independent
 * clone is what lives in the cache (never scope-registered — see textSolidCache).
 */
function getOrBuildCanonicalTextSolid(
  scope: DisposalScope,
  text: string,
  fontFamily: TextFontFamily,
  mode: TextMode,
  fontSize: number,
  depth: number,
  hostThickness: number,
  extrusion: number
): Shape3D {
  const key = textSolidKey(text, fontFamily, mode, fontSize, depth, hostThickness);
  const hit = getTextSolid(key);
  if (hit) return scope.register(hit);

  const sketches = sketchText(
    text,
    { fontSize, fontFamily },
    { plane: 'XY' as PlaneName, origin: [0, 0, 0] }
  );
  const extruded = sketches.extrude(extrusion);
  // Cache an independent clone before handing the built shape to the scope.
  setTextSolid(key, extruded);
  return scope.register(extruded);
}
