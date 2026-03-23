/**
 * Mesh conversion utilities and helpers for the bin generation pipeline.
 *
 * Core implementations have moved to utils/ modules. This file re-exports
 * them for backwards compatibility with existing imports.
 *
 * @see utils/abort.ts — checkCancelled (isAbortError available via direct import)
 * @see utils/mesh.ts — toIndexedMeshData
 */

import type { Drawing, PlaneName, SketchInterface, BooleanOptions } from 'brepjs';

// Re-exports from utils/ (backwards compat)
export { checkCancelled } from './utils/abort';
export { toIndexedMeshData } from './utils/mesh';

/** Progress callback for reporting generation stages */
export type ProgressFn = (stage: string, progress: number) => void;
/** Boolean operation options including AbortSignal for cancellation. */
export type BooleanOpts = BooleanOptions;

/**
 * Sketch a drawing on a plane, narrowing to SketchInterface.
 * All our drawings are single closed wires, so SketchInterface is always the
 * correct runtime type. This eliminates repeated `as SketchInterface` casts.
 */
export function sketch(drawing: Drawing, plane?: PlaneName, origin?: number): SketchInterface {
  return drawing.sketchOnPlane(plane, origin) as SketchInterface;
}
