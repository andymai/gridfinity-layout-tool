/**
 * Shared concave fillet profile builder.
 *
 * Generates a closed 2D Drawing (brepjs) representing a small concave
 * fillet under a shelf. The fillet is kept minimal to maximize interior
 * bin volume while providing structural support for the shelf.
 *
 * Used by both handle ledges and label tab fillet supports.
 */

import { draw } from 'brepjs';
import type { Drawing } from 'brepjs';

/** Minimum clamped radius to avoid degenerate geometry. */
const MIN_RADIUS = 0.5;

/** Clearance below the fillet so it never fully occupies the vertical space. */
const HEIGHT_CLEARANCE = 0.1;

/**
 * Build a concave fillet profile in the XY plane.
 *
 * The profile is a right triangle with the hypotenuse replaced by a
 * concave arc. The height leg equals the clamped radius. The depth leg
 * defaults to the radius but can be overridden to match the shelf depth.
 *
 * Coordinate system (looking from front):
 * ```
 * (0, 0) ──── (-R, 0)     shelf underside
 *   |              ╲
 *   |    concave    ╲
 * (0, -R) ──────────╱
 * ```
 *
 * @param radius - Fillet arc radius in mm (controls curvature of the support)
 * @param height - Available vertical space below the shelf in mm
 * @param depth - Horizontal depth of the profile in mm (defaults to clamped radius)
 * @returns Closed 2D Drawing suitable for extrusion
 */
export function buildFilletProfile(radius: number, height: number, depth?: number): Drawing {
  const maxR = height - HEIGHT_CLEARANCE;
  const fallbackDepth = depth ?? MIN_RADIUS;
  if (maxR < MIN_RADIUS)
    return draw([0, 0]).lineTo([-fallbackDepth, 0]).lineTo([0, -MIN_RADIUS]).close();
  const safeR = Math.max(MIN_RADIUS, Math.min(radius, maxR));
  const effectiveDepth = depth ?? safeR;

  // Sagitta for a gentle concave curve on the hypotenuse.
  // Chord length between the two endpoints of the arc.
  // A sagitta of ~15% of chord gives a subtle scoop.
  const chord = Math.sqrt(effectiveDepth ** 2 + safeR ** 2);
  const sagitta = chord * 0.15;

  // Draw: shelf tip → origin → wall bottom → arc back to shelf tip.
  // Negative sagitta curves toward the origin (concave scoop).
  return draw([-effectiveDepth, 0])
    .lineTo([0, 0])
    .lineTo([0, -safeR])
    .sagittaArc(-effectiveDepth, safeR, -sagitta)
    .close();
}
