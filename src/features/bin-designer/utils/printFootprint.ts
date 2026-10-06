/**
 * The outline a socketless bin's shell is priced on: a rounded rectangle, or a
 * custom shape's mask outline, mirroring how the body builder draws each.
 */

import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { maskToPolygon, type CellMask, type MaskLoop } from '@/shared/utils/cellMask';

/** The body builder's corner-radius cap, as a fraction of the shorter side. */
const SECTION_RADIUS_FRACTION = 0.4;

/** A mask outline whose clamped radius falls below this is drawn sharp. */
const MIN_ARC_RADIUS_MM = 0.05;

export type RailSide = 'front' | 'back' | 'left' | 'right';

export interface ShellFootprint {
  /**
   * Section area `inset` inside the clearance outline, corners rounded to
   * `radius`; a custom shape's holes grow by the same inset at the box radius.
   */
  readonly section: (inset: number, radius: number) => number;
  /** The same without the holes: the outline a tray's lid wraps. */
  readonly outerSection: (inset: number, radius: number) => number;
  /** Outer loop length at the clearance outline. */
  readonly outerPerimeter: number;
  /** Every loop's length at the clearance outline: the lip rings the holes too. */
  readonly lipPerimeter: number;
  /** Net corner turns over four, which is one fewer per hole. */
  readonly turning: number;
  /** Straight runs a click rail may take, each before its corner allowance. */
  readonly railEdges: ReadonlyArray<{ readonly side: RailSide; readonly length: number }>;
  /** A custom shape, which the lid builder gives no relief, magnets or overhang. */
  readonly polygon: boolean;
}

export function roundedRectArea(w: number, d: number, r: number): number {
  return Math.max(0, w) * Math.max(0, d) - (4 - Math.PI) * r * r;
}

export function rectFootprint(outerW: number, outerD: number): ShellFootprint {
  const section = (inset: number, radius: number): number => {
    const w = outerW - 2 * inset;
    const d = outerD - 2 * inset;
    const r = Math.max(0, Math.min(radius, SECTION_RADIUS_FRACTION * Math.min(w, d)));
    return Math.max(0, roundedRectArea(w, d, r));
  };
  const perimeter = 2 * (outerW + outerD);
  return {
    section,
    outerSection: section,
    outerPerimeter: perimeter,
    lipPerimeter: perimeter,
    turning: 1,
    railEdges: [
      { side: 'front', length: outerW },
      { side: 'back', length: outerW },
      { side: 'left', length: outerD },
      { side: 'right', length: outerD },
    ],
    polygon: false,
  };
}

interface Loop {
  readonly area: number;
  readonly perimeter: number;
  readonly lengths: readonly number[];
  /** Per edge, the sum of its two end turns: +1 convex, -1 reflex. */
  readonly endTurns: readonly number[];
}

/** A CCW loop in mm, with what an axis-aligned inset does to each edge. */
function toLoop(points: MaskLoop, unitX: number, unitY: number): Loop {
  const pts = points.map((p) => ({ x: p.x * unitX, y: p.y * unitY }));
  const n = pts.length;
  const turn = (i: number): number => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    return Math.sign((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x));
  };
  let area = 0;
  const lengths: number[] = [];
  const endTurns: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    area += a.x * b.y - b.x * a.y;
    lengths.push(Math.abs(b.x - a.x) + Math.abs(b.y - a.y));
    endTurns.push(turn(i) + turn((i + 1) % n));
  }
  return {
    area: Math.abs(area) / 2,
    perimeter: lengths.reduce((s, l) => s + l, 0),
    lengths,
    endTurns,
  };
}

/**
 * A loop moved `offset` inward (negative grows it), its corners rounded as the
 * mask drawing rounds them: to `radius`, clamped to half the shortest edge, and
 * sharp below the arc floor. Rounding takes a convex corner's tip and fills a
 * reflex one's, and a simple loop turns four times more convex than reflex.
 */
function offsetLoopArea(loop: Loop, offset: number, radius: number): number {
  let shortest = Infinity;
  loop.lengths.forEach((len, i) => {
    shortest = Math.min(shortest, len - offset * loop.endTurns[i]);
  });
  const clamped = Math.min(radius, shortest / 2 - 0.01);
  const r = clamped < MIN_ARC_RADIUS_MM ? 0 : clamped;
  return loop.area - loop.perimeter * offset + 4 * offset * offset - (4 - Math.PI) * r * r;
}

/** A CCW loop keeps its material left of each edge, so the edge's wall faces right. */
function sideFacing(dx: number, dy: number): RailSide | null {
  if (dx > 0 && dy === 0) return 'front';
  if (dx < 0 && dy === 0) return 'back';
  if (dx === 0 && dy > 0) return 'right';
  if (dx === 0 && dy < 0) return 'left';
  return null;
}

export function maskFootprint(mask: CellMask, unitX: number, unitY: number): ShellFootprint {
  const [outerPoints, ...holePoints] = maskToPolygon(mask);
  const outer = toLoop(outerPoints, unitX, unitY);
  // Holes come back filled-on-left; reversed, each is the cavity it encloses.
  const holes = holePoints.map((h) => toLoop([...h].reverse(), unitX, unitY));
  const clearance = GRIDFINITY.TOLERANCE / 2;
  const box = GRIDFINITY.BOX_CORNER_RADIUS;

  const outerSection = (inset: number, radius: number): number =>
    Math.max(0, offsetLoopArea(outer, clearance + inset, Math.max(radius, MIN_ARC_RADIUS_MM)));
  const section = (inset: number, radius: number): number =>
    Math.max(
      0,
      outerSection(inset, radius) -
        holes.reduce((s, h) => s + offsetLoopArea(h, -(clearance + inset), box), 0)
    );

  const railEdges: { side: RailSide; length: number }[] = [];
  for (let i = 0; i < outerPoints.length; i++) {
    const a = outerPoints[i];
    const b = outerPoints[(i + 1) % outerPoints.length];
    const side = sideFacing(b.x - a.x, b.y - a.y);
    if (side) railEdges.push({ side, length: outer.lengths[i] });
  }

  const outerPerimeter = outer.perimeter - 8 * clearance;
  return {
    section,
    outerSection,
    outerPerimeter,
    lipPerimeter: holes.reduce((s, h) => s + h.perimeter + 8 * clearance, outerPerimeter),
    turning: 1 - holes.length,
    railEdges,
    polygon: true,
  };
}
