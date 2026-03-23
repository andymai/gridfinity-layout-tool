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
    return { tolerance: 0.01, angularTolerance: 5 };
  }
  if (hasLip) {
    return {
      tolerance: Math.min(0.1, Math.max(0.05, maxDimension / 2500)),
      angularTolerance: 10,
    };
  }
  if (maxDimension <= 200) {
    return {
      tolerance: Math.min(0.4, Math.max(0.15, maxDimension / 600)),
      angularTolerance: 12,
    };
  }
  return {
    tolerance: Math.min(1.0, Math.max(0.3, maxDimension / 300)),
    angularTolerance: 25,
  };
}
