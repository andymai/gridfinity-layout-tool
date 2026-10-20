/**
 * Re-exports the per-piece screw site check for the plate-level pad decision
 * in the baseplate feature, which must site every screw exactly as the build
 * will before it can say whether the plate needs a floor pad.
 */
export { pieceScrewsNeedFloor } from '@/features/generation/worker/generators/baseplateScrews';
