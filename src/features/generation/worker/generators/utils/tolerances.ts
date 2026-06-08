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
 * - Lip bins: tight to preserve chamfer profile at corner junctions, but
 *   relaxed on large bins so a giant hex-riddled wall isn't meshed at
 *   near-export fidelity just to keep a 2.6mm rim chamfer smooth — cutting the
 *   preview mesh weight (memory/transfer/GPU), not the generation time itself
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
    // The chamfer needs fine tessellation, but only at the rim — pinning the
    // whole solid at a flat 0.06 ceiling bloated the preview triangle count on
    // large hex bins (wall area, not the lip, dominates the face count). Let the
    // tolerance grow with size, capped at 0.15mm (the coarse tier's floor) so the
    // chamfer stays acceptable while large walls shed triangles. Normal bins
    // (<300mm) are unaffected: maxDimension/5000 stays ≤0.06 below that.
    return {
      tolerance: Math.min(0.15, Math.max(0.03, maxDimension / 5000)),
      angularTolerance: maxDimension > 200 ? 12 : 8,
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
