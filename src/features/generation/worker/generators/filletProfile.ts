/**
 * Shared concave fillet profile builder.
 *
 * Generates a closed 2D Drawing (brepjs) representing a concave quarter-circle
 * fillet. When extruded, this creates a smooth structural support curve between
 * a horizontal shelf and a vertical wall — replacing the 45-degree triangular
 * gusset used by label tabs with a concave arc.
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
 * Build a concave quarter-circle fillet profile in the XY plane.
 *
 * Coordinate system (looking from front):
 * ```
 * (0, 0) ────────── (-depth, 0)     shelf underside (top edge)
 *   |                     |
 *   |           concave   |
 *   |            arc    ╱
 * (0, -height) ─────╱
 * ```
 *
 * The profile is a closed shape with:
 * 1. Top edge: horizontal line along the shelf underside
 * 2. Right edge: vertical line along the wall face
 * 3. Hypotenuse: concave sagittaArc replacing the diagonal
 *
 * @param radius - Fillet arc radius in mm (clamped to fit within height)
 * @param height - Available vertical space below the shelf in mm
 * @returns Closed 2D Drawing suitable for extrusion
 */
export function buildFilletProfile(radius: number, height: number): Drawing {
  // Clamp radius: must fit within available height, with a minimum for valid geometry.
  const maxR = height - HEIGHT_CLEARANCE;
  if (maxR < MIN_RADIUS)
    return draw([0, 0]).lineTo([-MIN_RADIUS, 0]).lineTo([0, -MIN_RADIUS]).close();
  const safeR = Math.max(MIN_RADIUS, Math.min(radius, maxR));
  const depth = safeR;

  // The three corner points of the right triangle:
  //   origin  = (0, 0)        — wall-shelf junction
  //   tip     = (-depth, 0)   — shelf tip
  //   bottom  = (0, -safeR)   — wall bottom
  //
  // The arc replaces the hypotenuse from tip to bottom.
  // Chord length = sqrt(depth^2 + safeR^2). For equal legs: depth = safeR,
  // so chord = safeR * sqrt(2).
  //
  // For a quarter-circle arc inscribed in a right triangle with equal legs,
  // sagitta = R * (1 - 1/sqrt(2)) ≈ R * 0.2929.
  // The sagitta is the perpendicular distance from chord midpoint to the arc.
  const sagitta = safeR * (1 - 1 / Math.sqrt(2));

  // Draw: start at shelf tip, go right along shelf to origin, down the wall
  // to bottom, then arc back to shelf tip (concave, curving toward origin).
  //
  // sagittaArc takes relative dx, dy from current point to endpoint.
  // From (0, -safeR) to (-depth, 0): dx = -depth, dy = safeR.
  // Travel direction is upper-left (direction vector (-1, +1) normalized).
  // "Left" of this travel direction points toward the third quadrant (away
  // from origin). Positive sagitta therefore curves the arc away from the
  // origin, producing the desired concave shape (bulging away from the
  // wall-shelf junction).
  return draw([-depth, 0])
    .lineTo([0, 0])
    .lineTo([0, -safeR])
    .sagittaArc(-depth, safeR, sagitta)
    .close();
}
