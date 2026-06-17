/**
 * Contrast color for cutout labels drawn on the 2D editor surface.
 *
 * Lives apart from the `CutoutLabel3D` component so the renderer file only
 * exports components (react-refresh / fast-refresh requirement).
 */

import * as THREE from 'three';

/** Same darkening `CutoutShapeMesh` applies to the bin color for the cut floor. */
const CUT_FILL_DARKEN = 0.7;

/**
 * Black or white label color for legibility against the cutout fill.
 *
 * The label renders on the darkened cutout floor (`binColor × CUT_FILL_DARKEN`,
 * matching `CutoutShapeMesh`), so contrast is computed from that fill's relative
 * luminance — NOT the theme. Keying off the theme is what made white labels
 * vanish over a light filament color.
 */
export function cutoutLabelColor(binColor: string): string {
  const fill = new THREE.Color(binColor).multiplyScalar(CUT_FILL_DARKEN);
  const luminance = 0.2126 * fill.r + 0.7152 * fill.g + 0.0722 * fill.b;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}
