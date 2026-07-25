/**
 * The floor pattern's window rule (#2816) — the geometry that makes the feature
 * safe, isolated from the planner so the designer can share it.
 *
 * A drainage hole must leave the bin through a foot's FLAT UNDERSIDE, never
 * through the tapered flank that mates with the baseplate. That underside is
 * inset {@link INSET_BOT} from the cell edge, so every hole is confined to a
 * window inset by at least that much — and, on an outermost cell, by enough to
 * leave the wall a solid rim to bond to.
 *
 * Kept brepjs-free and dependency-light on purpose: `@/shared/generation/
 * floorPatternMetrics` re-exports it into the main bundle for the panel's fit
 * prediction and the print estimate, so neither has to re-derive the rule.
 */

import { CUTOUT_BORDER_WIDTH } from './wallPatterns';
import { CLEARANCE, INSET_BOT } from './generatorConstants';

/**
 * Solid margin held around every window edge and obstruction (mm).
 *
 * The same 1.5mm the wall pattern holds around a cut. Unlike the divider
 * junction zones it is NOT widened by the element radius: a stamp calculator
 * bounds its centres so every element lies strictly inside the fill area, so
 * the window edge already is the material edge.
 */
export const FLOOR_PATTERN_BORDER = CUTOUT_BORDER_WIDTH;

/**
 * Inset from a socket cell's edge to its pattern window (mm).
 *
 * One inset for every edge of every cell — the interior ribs it leaves are the
 * cheapest way to guarantee neither the foot rule nor the wall rule is violated
 * on any cell, without tracking which cells are outermost.
 */
export function floorWindowInset(wallThickness: number): number {
  return FLOOR_PATTERN_BORDER + Math.max(INSET_BOT, wallThickness);
}

/** Window extent (mm) on one axis of a socket cell `cellUnits` grid units wide. */
export function floorWindowSpan(cellUnits: number, pitch: number, wallThickness: number): number {
  return Math.max(0, cellUnits * pitch - CLEARANCE - 2 * floorWindowInset(wallThickness));
}
