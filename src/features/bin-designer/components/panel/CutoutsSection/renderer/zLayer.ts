/**
 * Stacking maths for cutout shapes in the 2D editor (issue #3053).
 *
 * The editor draws with `depthTest: false`, which splits stacking into two
 * independent channels:
 *   - scene Z decides which shape wins the click (raycast distance),
 *   - `renderOrder` decides which fill draws on top.
 * They have to move together, or "bring to front" looks right and clicks wrong.
 *
 * Shared by all four shape renderers (SDF, path, polygon, mesh footprint) so a
 * new shape kind can't silently opt out of z-ordering — which is how the SDF
 * renderer ended up as the only one anybody would have patched.
 */

import { Z_LAYER_MAX, Z_LAYER_RENDER_STEP, Z_LAYER_STEP } from './constants';

/** Clamped stacking layer for a cutout. Absent `zIndex` is the bottom (0). */
export function zLayerOf(zIndex: number | undefined): number {
  return Math.min(Math.max(zIndex ?? 0, 0), Z_LAYER_MAX);
}

/**
 * Scene Z for a shape's quad.
 *
 * Explicit z-order dominates; the original smaller-shape-wins heuristic is kept
 * as the tiebreaker, since it is what lets you click a small shape sitting on a
 * large one before anyone has touched the ordering. `Z_LAYER_STEP` exceeds the
 * tiebreaker's 0.01 ceiling so the two can never fight.
 */
export function shapePosZ(zIndex: number | undefined, area: number): number {
  return 0.02 + zLayerOf(zIndex) * Z_LAYER_STEP + 0.01 / Math.max(area, 1);
}

/**
 * `renderOrder` for a shape, offset within its band.
 *
 * The offset stays below 1 (see `Z_LAYER_MAX`), so a shape in `SHAPES` (10)
 * can never bleed into `GROUP_FILL` (11).
 */
export function shapeRenderOrder(band: number, zIndex: number | undefined): number {
  return band + zLayerOf(zIndex) * Z_LAYER_RENDER_STEP;
}
