/**
 * Tessellation tolerance selection for the generation pipeline.
 *
 * Centralizes the quality-tier logic used by tessellateStage
 * and export functions.
 */

export interface TessellationTolerances {
  readonly tolerance: number;
  readonly angularTolerance: number;
}

/**
 * Single source of truth for the tessellation quality used by every export
 * pass. `generateBin(_, _, forExport=true)` and `exportSTL` must walk the
 * same `mesh()` (brepjs caches by shape+tolerance), otherwise the
 * per-triangle faceGroups captured at generation time misalign with the
 * triangles `exportSTL` writes.
 */
export const EXPORT_TOLERANCE = 0.01;
export const EXPORT_ANGULAR_TOLERANCE = 5;

/**
 * Select tessellation tolerances based on export mode and bin dimensions.
 *
 * Quality tiers:
 * - Export: fine (0.01mm) for STL/STEP accuracy
 * - Lip bins: tight to preserve chamfer profile at corner junctions
 * - Small bins (≤200mm): moderate quality
 * - Large bins (>200mm): coarser for preview speed
 */
export function computeTessellationTolerances(
  forExport: boolean,
  hasLip: boolean,
  maxDimension: number
): TessellationTolerances {
  if (forExport) {
    return { tolerance: EXPORT_TOLERANCE, angularTolerance: EXPORT_ANGULAR_TOLERANCE };
  }
  if (hasLip) {
    return {
      tolerance: Math.min(0.06, Math.max(0.03, maxDimension / 5000)),
      angularTolerance: 8,
    };
  }
  if (maxDimension <= 200) {
    return {
      tolerance: Math.min(0.2, Math.max(0.08, maxDimension / 1200)),
      angularTolerance: 10,
    };
  }
  return {
    tolerance: Math.min(0.5, Math.max(0.15, maxDimension / 600)),
    angularTolerance: 15,
  };
}
