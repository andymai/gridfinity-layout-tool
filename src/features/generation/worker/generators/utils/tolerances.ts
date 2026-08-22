/**
 * Tessellation tolerance selection for the generation pipeline.
 *
 * Centralizes the quality-tier logic used by tessellateStage
 * and export functions.
 *
 * Both numbers reach OCCT through brepjs's `mesh()`, and they are in DIFFERENT
 * units: `tolerance` is a chord height in mm, `angularToleranceRad` is an angle
 * in RADIANS. brepjs's own presets run 0.5 / 0.1 / 0.05 and OCCT defaults to
 * 0.5, so any value at or above 0.5 leaves the angular criterion inert — which
 * is what a degrees-shaped number silently buys.
 */

export interface TessellationTolerances {
  readonly tolerance: number;
  /** Radians. See the unit note above. */
  readonly angularToleranceRad: number;
}

/**
 * Single source of truth for the tessellation quality used by every export
 * pass. `generateBin(_, _, forExport=true)` and `exportSTL` must walk the
 * same `mesh()` (brepjs caches by shape+tolerance), otherwise the
 * per-triangle faceGroups captured at generation time misalign with the
 * triangles `exportSTL` writes.
 */
export const EXPORT_TOLERANCE = 0.01;

/**
 * Tighter than OCCT's 0.5 default, so a small-radius feature cannot be facetted
 * to whatever the 0.01mm chord height alone allows — chord height scales with
 * the square root of the radius, so it is the tightest on big arcs and loosest
 * exactly where a fillet is smallest.
 */
export const EXPORT_ANGULAR_TOLERANCE_RAD = 0.3;

/**
 * OCCT's own default, used for every preview tier. The angular criterion is a
 * floor on curve smoothness, not a size dial: the `tolerance` tiers below carry
 * the size scaling, and tightening this instead costs roughly a third more
 * triangles at preview chord heights for no visible gain.
 */
export const PREVIEW_ANGULAR_TOLERANCE_RAD = 0.5;

/**
 * Select tessellation tolerances based on export mode and bin dimensions.
 *
 * Quality tiers (all on `tolerance`, the chord height):
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
    return { tolerance: EXPORT_TOLERANCE, angularToleranceRad: EXPORT_ANGULAR_TOLERANCE_RAD };
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
      angularToleranceRad: PREVIEW_ANGULAR_TOLERANCE_RAD,
    };
  }
  if (maxDimension <= 200) {
    return {
      tolerance: Math.min(0.2, Math.max(0.08, maxDimension / 1200)),
      angularToleranceRad: PREVIEW_ANGULAR_TOLERANCE_RAD,
    };
  }
  return {
    tolerance: Math.min(0.5, Math.max(0.15, maxDimension / 600)),
    angularToleranceRad: PREVIEW_ANGULAR_TOLERANCE_RAD,
  };
}
