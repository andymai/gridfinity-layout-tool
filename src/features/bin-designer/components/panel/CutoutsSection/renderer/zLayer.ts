/**
 * Stacking maths for cutout shapes in the 2D editor.
 *
 * The editor draws with `depthTest: false`, which splits stacking into two
 * independent channels:
 *   - scene Z decides which shape wins the click (raycast distance),
 *   - `renderOrder` decides which fill draws on top.
 *
 * Both are derived from the SAME ordering key — layer first, then smaller-area
 * first — so what you see on top is what you click. Feeding only one channel
 * the tiebreaker is how a shape could paint above its neighbour while the click
 * went to the other one.
 *
 * Shared by all four shape renderers (SDF, path, polygon, mesh footprint) so a
 * new shape kind can't silently opt out of z-ordering.
 */

import { Z_LAYER_MAX, Z_LAYER_RENDER_STEP, Z_LAYER_STEP } from './constants';

/** Scene-Z span reserved for the within-layer tiebreaker. */
const AREA_Z_SPAN = 0.01;
/**
 * `renderOrder` span for the same tiebreaker. Strictly less than
 * {@link Z_LAYER_RENDER_STEP} so a tiebreak can never promote a shape past the
 * next layer.
 */
const AREA_RENDER_SPAN = 0.0009;

/** Clamped stacking layer for a cutout. Absent `zIndex` is the bottom (0). */
export function zLayerOf(zIndex: number | undefined): number {
  return Math.min(Math.max(zIndex ?? 0, 0), Z_LAYER_MAX);
}

/**
 * Within-layer rank in `(0, 1]`: smaller shapes rank higher.
 *
 * This is the original smaller-shape-wins heuristic, and it is worth keeping —
 * it is what lets you click a small shape sitting on a large one before anyone
 * has touched the ordering. Explicit z-order simply outranks it.
 */
function areaRank(area: number): number {
  return 1 / Math.max(area, 1);
}

/**
 * Scene Z for a shape's quad. Higher is closer to the camera, so it wins the
 * raycast. `Z_LAYER_STEP` exceeds {@link AREA_Z_SPAN} so an explicit layer
 * always beats the area tiebreaker.
 */
export function shapePosZ(zIndex: number | undefined, area: number): number {
  return 0.02 + zLayerOf(zIndex) * Z_LAYER_STEP + AREA_Z_SPAN * areaRank(area);
}

/**
 * `renderOrder` for a shape, offset within its band by the same key
 * {@link shapePosZ} uses.
 *
 * The total offset stays below 1 (see `Z_LAYER_MAX`), so a shape in `SHAPES`
 * (10) can never bleed into `GROUP_FILL` (11).
 */
export function shapeRenderOrder(band: number, zIndex: number | undefined, area: number): number {
  return band + zLayerOf(zIndex) * Z_LAYER_RENDER_STEP + AREA_RENDER_SPAN * areaRank(area);
}
