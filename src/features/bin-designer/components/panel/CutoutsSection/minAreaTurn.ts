/**
 * The turn that fits a cutout into the smallest box the board measures it by.
 *
 * The smallest box around a convex outline has one side lying along an edge of
 * it, so only the hull's edge directions need trying. The winner is turned
 * landscape (wider than deep), which is what row packing fills best, and the
 * angle is reported in (−90°, 90°].
 */

import type { Cutout } from '@/features/bin-designer/types';
import { getCutoutOutline } from './cutoutOutline';

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Text reads in its own direction and a knife slot is set square to its wall. */
const FIXED_SHAPES: readonly Cutout['shape'][] = ['text', 'knifeSlot'];

/**
 * Boxes within this share of the smallest count as equally small, so a shape
 * already this close to its best is not turned for a gain no print would show.
 */
const AREA_TIE = 0.001;

function cross(o: Pt, a: Pt, b: Pt): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** Monotone-chain convex hull, counter-clockwise, without repeated points. */
export function convexHull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  if (pts.length < 3) return pts;
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * What the board measures a cutout by (`getCutoutBounds`): a path by its
 * outline, anything else by its turned box. Fitting the same thing keeps a
 * packed shape from reading as off the board.
 */
function measuredOutline(c: Cutout): Pt[] | null {
  if (c.shape === 'path') {
    const rings = getCutoutOutline({ ...c, rotation: 0 });
    return rings ? rings.flat() : null;
  }
  if (c.width <= 0 || c.depth <= 0) return null;
  return [
    { x: 0, y: 0 },
    { x: c.width, y: 0 },
    { x: c.width, y: c.depth },
    { x: 0, y: c.depth },
  ];
}

/** Into (−90°, 90°]: a box turned half a turn is the same box. */
function normalise(deg: number): number {
  const r = ((deg % 180) + 180) % 180;
  const half = r > 90 ? r - 180 : r;
  return Math.round(half * 1000) / 1000 || 0;
}

/** Distance between two box turns, half a turn apart being the same. */
function turnGap(a: number, b: number): number {
  const d = Math.abs(normalise(a) - normalise(b));
  return Math.min(d, 180 - d);
}

/**
 * The rotation that puts the cutout in its smallest landscape box, or null
 * when it keeps its own: text, knife slots, repeats, and outlines too
 * degenerate to measure. Of equally small boxes, the one nearest the
 * cutout's current turn wins, so a shape already at its best stays put.
 */
export function minAreaTurn(cutout: Cutout): number | null {
  if (FIXED_SHAPES.includes(cutout.shape) || cutout.array) return null;
  const outline = measuredOutline(cutout);
  const hull = outline ? convexHull(outline) : [];
  if (hull.length < 3) return null;

  // A cutout turned by `r` draws its own direction `a` at `a - r`, so a turn
  // equal to a direction's angle lays that direction flat; a quarter more
  // stands it up.
  const boxAlong = (angle: number): { area: number; turn: number } => {
    const ux = Math.cos((angle * Math.PI) / 180);
    const uy = Math.sin((angle * Math.PI) / 180);
    let minU = Infinity;
    let maxU = -Infinity;
    let minV = Infinity;
    let maxV = -Infinity;
    for (const h of hull) {
      const u = h.x * ux + h.y * uy;
      const v = h.y * ux - h.x * uy;
      minU = Math.min(minU, u);
      maxU = Math.max(maxU, u);
      minV = Math.min(minV, v);
      maxV = Math.max(maxV, v);
    }
    const along = maxU - minU;
    const across = maxV - minV;
    return { area: along * across, turn: along >= across ? angle : angle + 90 };
  };

  const candidates = [boxAlong(cutout.rotation)];
  for (let i = 0; i < hull.length; i++) {
    const p = hull[i];
    const q = hull[(i + 1) % hull.length];
    if (Math.hypot(q.x - p.x, q.y - p.y) < 1e-9) continue;
    candidates.push(boxAlong((Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI));
  }

  const smallest = Math.min(...candidates.map((c) => c.area));
  let best: number | null = null;
  for (const c of candidates) {
    if (c.area > smallest * (1 + AREA_TIE)) continue;
    if (best === null || turnGap(c.turn, cutout.rotation) < turnGap(best, cutout.rotation)) {
      best = c.turn;
    }
  }
  if (best === null) return null;
  // Already at a turn that gives this box: keep the stored angle as it is.
  return turnGap(best, cutout.rotation) < 1e-3 ? cutout.rotation : normalise(best);
}
