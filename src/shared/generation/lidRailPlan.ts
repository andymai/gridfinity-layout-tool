/**
 * Re-exports the lid rail plan for cross-feature use.
 *
 * The plan sits beside the worker's rail builder and is brepjs-free, so the
 * designer panel can name a wall the bin dip left without a rail without
 * pulling the WASM kernel into the main bundle.
 */

export { railSidesLostToBinDip } from '@/features/generation/worker/generators/lidRailPlan';
