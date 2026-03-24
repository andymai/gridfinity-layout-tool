/**
 * Barrel re-export for interior feature builders.
 *
 * This file previously contained all feature builders (~1356 lines).
 * It has been decomposed into focused modules:
 *
 * - compartmentBuilder.ts — Compartment divider walls, shared helpers
 * - insertBuilder.ts — Insert cavity cuts
 * - cutoutBuilder.ts — Solid-mode cutout cuts with adaptive fillets
 * - labelTabBuilder.ts — Label tabs with gusset/solid supports
 * - scoopRampBuilder.ts — Finger scoop ramps
 * - wallCutoutBuilder.ts — Wall cutouts (u-shape, scoop, funnel)
 *
 * All exports are re-exported here so existing imports continue to work unchanged.
 */

export { buildCompartmentWalls } from './compartmentBuilder';
export { buildInsertCuts } from './insertBuilder';
export { buildCutoutCuts } from './cutoutBuilder';
export { buildLabelTabs } from './labelTabBuilder';
export { buildScoopRamps } from './scoopRampBuilder';
export { buildWallCutoutCuts, buildSingleCutout } from './wallCutoutBuilder';
export { buildHandleHoles } from './handleBuilder';
