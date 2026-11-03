import { polylineCrosses } from './outlineSegments';

interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Where edges a0-a1 and b0-b1 cross strictly inside both, if they do. */
function crossing(a0: Pt, a1: Pt, b0: Pt, b1: Pt): Pt | null {
  const rx = a1.x - a0.x;
  const ry = a1.y - a0.y;
  const sx = b1.x - b0.x;
  const sy = b1.y - b0.y;
  const den = rx * sy - ry * sx;
  if (den === 0) return null;
  const t = ((b0.x - a0.x) * sy - (b0.y - a0.y) * sx) / den;
  const u = ((b0.x - a0.x) * ry - (b0.y - a0.y) * rx) / den;
  if (t <= 0 || t >= 1 || u <= 0 || u >= 1) return null;
  return { x: a0.x + t * rx, y: a0.y + t * ry };
}

function area(ring: readonly Pt[]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += (ring[j].x - ring[i].x) * (ring[j].y + ring[i].y);
  }
  return Math.abs(sum / 2);
}

/** Every pair of non-adjacent edges that cross, found on a grid of cells. */
function crossings(points: readonly Pt[]): { i: number; j: number; x: Pt }[] {
  const n = points.length;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const cell = Math.max(Math.hypot(maxX - minX, maxY - minY) / Math.sqrt(n), 1e-9);
  const cells = new Map<string, number[]>();
  for (let e = 0; e < n; e++) {
    const a = points[e];
    const b = points[(e + 1) % n];
    for (
      let cx = Math.floor((Math.min(a.x, b.x) - minX) / cell);
      cx <= Math.floor((Math.max(a.x, b.x) - minX) / cell);
      cx++
    ) {
      for (
        let cy = Math.floor((Math.min(a.y, b.y) - minY) / cell);
        cy <= Math.floor((Math.max(a.y, b.y) - minY) / cell);
        cy++
      ) {
        const key = `${cx},${cy}`;
        const list = cells.get(key);
        if (list) list.push(e);
        else cells.set(key, [e]);
      }
    }
  }
  const found = new Map<string, { i: number; j: number; x: Pt }>();
  for (const list of cells.values()) {
    for (let u = 0; u < list.length; u++) {
      for (let v = u + 1; v < list.length; v++) {
        const i = Math.min(list[u], list[v]);
        const j = Math.max(list[u], list[v]);
        if (j - i < 2 || (i === 0 && j === n - 1) || found.has(`${i},${j}`)) continue;
        const x = crossing(points[i], points[i + 1], points[j], points[(j + 1) % n]);
        if (x) found.set(`${i},${j}`, { i, j, x });
      }
    }
  }
  return [...found.values()];
}

/**
 * A closed polyline with each small loop it makes by crossing itself cut out
 * at the crossing. A trace's fold, or rounding that pushes a near-touching
 * zigzag across itself, leaves loops like these, and the builder cuts an
 * outline that crosses itself as its bounding box. A loop of `maxArea` or more
 * is a real part of the shape and is left, crossing and all.
 *
 * `at` makes the point the loop is cut at, from the one before it.
 */
export function withoutTinyLoops<T extends Pt>(
  ring: readonly T[],
  maxArea: number,
  at: (x: number, y: number, from: T) => T
): T[] {
  let points = [...ring];
  for (let pass = 0; pass < ring.length && polylineCrosses(points); pass++) {
    let next: T[] | null = null;
    for (const { i, j, x } of crossings(points)) {
      const cutAt = at(x.x, x.y, points[i]);
      // Either side of the crossing can be the loop. A side that crosses
      // itself can hide large lobes whose areas cancel, so only a simple one
      // is measured; the loops inside it come out on their own.
      const inner = points.slice(i + 1, j + 1);
      const outer = [...points.slice(j + 1), ...points.slice(0, i + 1)];
      for (const [loop, kept] of [
        [inner, outer],
        [outer, inner],
      ] as const) {
        const closed = [x, ...loop];
        if (area(closed) < maxArea && !polylineCrosses(closed)) {
          next =
            loop === inner
              ? [...points.slice(0, i + 1), cutAt, ...points.slice(j + 1)]
              : [cutAt, ...kept];
          break;
        }
      }
      if (next) break;
    }
    if (!next) break;
    points = next;
  }
  return points;
}
