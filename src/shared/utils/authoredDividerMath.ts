/**
 * Pure math for authored (custom-layout) removable dividers.
 *
 * Turns a set of wall segments (from deriveWallSegments over the overhang-
 * expanded interior) into printable removable pieces: each piece's length,
 * cross-lap notch positions, retention class, and seated placement. Shared
 * between the generation worker (BREP) and the bin-designer editor (seat hints,
 * numbered assembly map), so it has no brepjs/Three.js dependencies.
 *
 * Coordinates are bin-interior mm: x from the left wall, y from the front wall.
 * A vertical segment sits at a column boundary and runs along y (seating in the
 * front/back walls); a horizontal segment runs along x (left/right walls).
 */

import type { WallSegment } from './compartmentGeometry';
import { tabEngagement } from './slotMath';

/**
 * How a piece is held in place:
 * - 'wall': at least one end seats in a bin-wall slot (rigid).
 * - 'crossing': no wall end, but it interlocks a perpendicular divider via a
 *   cross-lap notch (positively located, not rigid against pull-out).
 * - 'friction': both ends merely abut perpendicular walls with no notch — held
 *   only by friction, and can slide along the abutting faces.
 */
export type DividerRetention = 'wall' | 'crossing' | 'friction';

export interface AuthoredDividerPiece {
  readonly orientation: 'horizontal' | 'vertical';
  /** Total printed length in mm (includes wall tabs, shortened at abut ends). */
  readonly length: number;
  /** Cross-lap notch centers along the run axis, relative to the piece center. */
  readonly notchOffsets: number[];
  /** Cross-lap side: vertical pieces notch from the top, horizontal from the
   *  bottom, so every perpendicular crossing interlocks. */
  readonly fromTop: boolean;
  readonly retention: DividerRetention;
  /** 1-based assembly number (reading order), also drives the export label. */
  readonly index: number;
  readonly label: string;
  /** Perpendicular position: x for vertical pieces, y for horizontal (mm). */
  readonly pos: number;
  /** Physical extent along the run axis in mm (may go <0 into a wall slot). */
  readonly start: number;
  readonly end: number;
}

interface Axis {
  readonly pos: number; // perpendicular position (x for vertical, y for horizontal)
  readonly a0: number; // low end along run axis
  readonly a1: number; // high end along run axis
}

/** A vertical segment runs along y at x=pos; horizontal runs along x at y=pos. */
function toAxis(s: WallSegment): Axis {
  return s.orientation === 'vertical'
    ? { pos: s.x, a0: s.y, a1: s.y + s.length }
    : { pos: s.y, a0: s.x, a1: s.x + s.length };
}

const EPS = 1e-6;

/**
 * Compute removable divider pieces from wall segments.
 *
 * @param segments Wall segments in interior mm (from deriveWallSegments)
 * @param innerW Overhang-expanded interior width in mm
 * @param innerD Overhang-expanded interior depth in mm
 * @param thickness Divider wall thickness in mm
 * @param wallSlotDepth Depth of the slot cut into the bin wall in mm
 * @param clearance Fit tolerance in mm
 */
export function computeAuthoredDividers(
  segments: readonly WallSegment[],
  innerW: number,
  innerD: number,
  thickness: number,
  wallSlotDepth: number,
  clearance: number
): AuthoredDividerPiece[] {
  const tab = tabEngagement(wallSlotDepth, clearance);
  const half = thickness / 2;

  const verticals = segments.filter((s) => s.orientation === 'vertical');
  const horizontals = segments.filter((s) => s.orientation === 'horizontal');

  // Reading order for stable assembly numbers: front-to-back (y), then
  // left-to-right (x). WallSegment.x/y is the start corner for both orientations.
  const ordered = [...segments].sort((a, b) => a.y - b.y || a.x - b.x);

  return ordered.map((seg, i): AuthoredDividerPiece => {
    const axis = toAxis(seg);
    const runMax = seg.orientation === 'vertical' ? innerD : innerW;

    // Crossings: perpendicular segments that pass strictly through this one.
    const perp = seg.orientation === 'vertical' ? horizontals : verticals;
    const crossings: number[] = [];
    for (const p of perp) {
      const pa = toAxis(p);
      // p.pos is along THIS piece's run axis; this piece's pos is along p's.
      if (
        pa.pos > axis.a0 + EPS &&
        pa.pos < axis.a1 - EPS &&
        axis.pos > pa.a0 + EPS &&
        axis.pos < pa.a1 - EPS
      ) {
        crossings.push(pa.pos);
      }
    }
    // Sort so notch offsets are deterministic regardless of segment order.
    crossings.sort((a, b) => a - b);

    const a0IsWall = axis.a0 <= EPS;
    const a1IsWall = axis.a1 >= runMax - EPS;
    // Wall ends extend a tab into the slot; abut ends stop at the perpendicular
    // wall's near face (shortened by half the divider thickness).
    const start = a0IsWall ? axis.a0 - tab : axis.a0 + half;
    const end = a1IsWall ? axis.a1 + tab : axis.a1 - half;
    const center = (start + end) / 2;

    const retention: DividerRetention =
      a0IsWall || a1IsWall ? 'wall' : crossings.length > 0 ? 'crossing' : 'friction';

    return {
      orientation: seg.orientation,
      length: end - start,
      notchOffsets: crossings.map((c) => c - center),
      fromTop: seg.orientation === 'vertical',
      retention,
      index: i + 1,
      label: `divider-${String(i + 1).padStart(2, '0')}`,
      pos: axis.pos,
      start,
      end,
    };
  });
}
