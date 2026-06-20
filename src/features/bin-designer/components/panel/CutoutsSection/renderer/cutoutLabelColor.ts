/**
 * Contrast colors for cutout labels drawn on the 2D editor surface.
 *
 * Lives apart from the `CutoutLabel3D` component so the renderer file only
 * exports components (react-refresh / fast-refresh requirement).
 */

import * as THREE from 'three';

/** Same darkening `CutoutShapeMesh` applies to the bin color for the cut floor. */
const CUT_FILL_DARKEN = 0.7;

/** Glyph fill + the contrasting outline drawn behind it as a halo. */
export interface CutoutLabelColors {
  /** Best-contrast glyph fill against the darkened cutout fill. */
  readonly fill: string;
  /** Opposite of `fill` — a halo so glyphs read on busy/mid-tone fills too. */
  readonly outline: string;
}

/** Per-channel sRGB → linear for WCAG relative luminance. */
function linearize(channel: number): number {
  return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of an sRGB triple in [0,1]. */
function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG contrast ratio between two relative luminances (order-independent). */
function contrastRatio(l1: number, l2: number): number {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Black-or-white glyph fill (plus its inverse as an outline) for legibility
 * against the cutout fill.
 *
 * The label renders on the darkened cutout floor (`binColor × CUT_FILL_DARKEN`,
 * matching `CutoutShapeMesh`). Rather than threshold raw luminance — which
 * misjudges mid-tone filament colors because luminance is non-linear — we pick
 * whichever of black/white yields the higher WCAG contrast ratio against that
 * fill, then use the other as a halo so the text never dissolves into a busy or
 * borderline background.
 */
export function cutoutLabelColors(binColor: string): CutoutLabelColors {
  // getHexString returns sRGB bytes regardless of three's color management.
  const hex = new THREE.Color(binColor).getHexString();
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;

  // CutoutShapeMesh darkens the cut floor with THREE.Color.multiplyScalar, which
  // scales LINEAR components — so the factor belongs in linear space. Relative
  // luminance is already the linearized weighted sum, so scaling it by
  // CUT_FILL_DARKEN equals linearize → ×0.7 → re-encode → linearize again, and
  // keeps the contrast decision aligned with the actual displayed fill.
  const fillLum = CUT_FILL_DARKEN * relativeLuminance(r, g, b);
  const whiteContrast = contrastRatio(fillLum, 1);
  const blackContrast = contrastRatio(fillLum, 0);

  return whiteContrast >= blackContrast
    ? { fill: '#ffffff', outline: '#000000' }
    : { fill: '#000000', outline: '#ffffff' };
}
