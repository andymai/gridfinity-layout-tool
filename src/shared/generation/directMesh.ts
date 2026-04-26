/**
 * Re-exports the procedural direct-mesh baseplate generator for cross-feature use.
 *
 * The canonical implementation lives in features/generation. This barrel
 * lets the baseplate feature (and any future feature) consume it without
 * a cross-feature import boundary violation.
 *
 * The direct-mesh path is a synchronous, WASM-free fallback that produces a
 * geometrically equivalent placeholder in <100 ms — used to render an
 * orbitable preview while the BREP pipeline catches up.
 */
export { generateBaseplateDirect } from '@/features/generation/worker/generators/baseplateDirectMesh';
