/**
 * Thin a loop down to the outline model's vertex ceiling.
 *
 * A flattened bezier or a traced curve easily runs to thousands of points,
 * which `validateOutline` rejects outright. Dropping points the shape does not
 * need is better than refusing the file — but it is reported, because a
 * silently thinned perimeter is a perimeter that no longer matches the drawer.
 */

import type { OutlineVertex } from '@/core/types';
import { BULGE_EPS } from '@/shared/utils/drawerOutlineGeometry';
import { OUTLINE_MAX_VERTICES } from '@/shared/utils/drawerOutline';

/** Perpendicular distance from `p` to the segment `a`–`b`. */
function pointLineDistance(p: OutlineVertex, a: OutlineVertex, b: OutlineVertex): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
}

/**
 * Douglas-Peucker over one run of vertices, keeping both endpoints.
 *
 * Iterative rather than recursive: a run can be tens of thousands of points
 * long, which is enough to overflow the stack.
 */
function simplifyRun(run: readonly OutlineVertex[], tolerance: number): OutlineVertex[] {
  if (run.length < 3) return [...run];
  const keep = new Uint8Array(run.length);
  keep[0] = 1;
  keep[run.length - 1] = 1;
  const stack: [number, number][] = [[0, run.length - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop() as [number, number];
    if (hi - lo < 2) continue;
    let worst = -1;
    let worstD = tolerance;
    for (let i = lo + 1; i < hi; i++) {
      const d = pointLineDistance(run[i], run[lo], run[hi]);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst === -1) continue;
    keep[worst] = 1;
    stack.push([lo, worst], [worst, hi]);
  }
  return run.filter((_, i) => keep[i] === 1);
}

export interface SimplifiedLoop {
  readonly vertices: OutlineVertex[];
  /** Vertices removed to reach the ceiling; 0 when nothing was dropped. */
  readonly removed: number;
}

/**
 * Reduce `vertices` to at most `OUTLINE_MAX_VERTICES`, or leave them alone if
 * they already fit.
 *
 * Arc vertices are pinned and split the loop into runs that simplify
 * independently: a bulge describes the segment leaving its vertex, so dropping
 * either end of an arc would silently re-aim the curve at a different point.
 * The tolerance escalates until the result fits, so a loop that resists
 * thinning at a fine tolerance still converges instead of failing.
 */
export function simplifyLoop(
  vertices: readonly OutlineVertex[],
  limit = OUTLINE_MAX_VERTICES
): SimplifiedLoop {
  if (vertices.length <= limit) return { vertices: [...vertices], removed: 0 };

  const pinned = vertices.map(
    (v, i) =>
      Math.abs(v.bulge ?? 0) >= BULGE_EPS ||
      Math.abs(vertices[(i - 1 + vertices.length) % vertices.length].bulge ?? 0) >= BULGE_EPS
  );

  let tolerance = 0.05;
  let best = [...vertices];
  for (let attempt = 0; attempt < 24 && best.length > limit; attempt++) {
    const out: OutlineVertex[] = [];
    let run: OutlineVertex[] = [];
    const flushRun = (): void => {
      if (run.length === 0) return;
      out.push(...simplifyRun(run, tolerance));
      run = [];
    };
    for (let i = 0; i < vertices.length; i++) {
      if (pinned[i]) {
        flushRun();
        out.push(vertices[i]);
        continue;
      }
      run.push(vertices[i]);
    }
    flushRun();
    best = out;
    tolerance *= 1.8;
  }

  return { vertices: best, removed: vertices.length - best.length };
}
