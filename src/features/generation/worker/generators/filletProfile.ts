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
 * The profile is a small right triangle with the hypotenuse replaced by
 * a concave arc. Both legs equal the clamped radius — keeping the fillet
 * compact to preserve bin interior volume.
 *
 * Coordinate system (looking from front):
 * ```
 * (0, 0) ──── (-R, 0)     shelf underside
 *   |              ╲
 *   |    concave    ╲
 * (0, -R) ──────────╱
 * ```
 *
 * @param radius - Fillet arc radius in mm (controls size of the support)
 * @param height - Available vertical space below the shelf in mm
 * @returns Closed 2D Drawing suitable for extrusion
 */
export function buildFilletProfile(radius: number, height: number): Drawing {
  const maxR = height - HEIGHT_CLEARANCE;
  if (maxR < MIN_RADIUS)
    return draw([0, 0]).lineTo([-MIN_RADIUS, 0]).lineTo([0, -MIN_RADIUS]).close();
  const safeR = Math.max(MIN_RADIUS, Math.min(radius, maxR));
  const depth = safeR;

  // Sagitta for a gentle concave curve on the hypotenuse.
  // For equal legs, chord = R * sqrt(2). A sagitta of ~15% of chord
  // gives a subtle scoop — enough to look concave without deep undercut.
  const chord = safeR * Math.sqrt(2);
  const sagitta = chord * 0.15;

  // Draw: shelf tip → origin → wall bottom → arc back to shelf tip.
  // Negative sagitta curves toward the origin (concave scoop).
  return draw([-depth, 0])
    .lineTo([0, 0])
    .lineTo([0, -safeR])
    .sagittaArc(-depth, safeR, -sagitta)
    .close();
}
