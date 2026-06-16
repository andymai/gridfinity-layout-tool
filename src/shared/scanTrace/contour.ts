/**
 * Stage 3: Moore-neighbor boundary tracing of a single connected region.
 *
 * Walks the outer contour clockwise from the topmost-leftmost pixel, yielding
 * an ordered loop of pixel coordinates. Interior holes are ignored — only the
 * outer silhouette is traced, which is what a drop-in pocket wants.
 */

import type { Mask, Point } from './types';

/** Moore neighborhood offsets in clockwise order, starting top-left. */
const RING: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];

function ringIndex(dx: number, dy: number): number {
  for (let i = 0; i < 8; i++) {
    if (RING[i][0] === dx && RING[i][1] === dy) return i;
  }
  return 0;
}

export function traceContour(mask: Mask, start: Point): Point[] {
  const { width, height, data } = mask;
  const isFg = (x: number, y: number): boolean =>
    x >= 0 && x < width && y >= 0 && y < height && data[y * width + x] === 1;

  const points: Point[] = [{ x: start.x, y: start.y }];

  let p = { x: start.x, y: start.y };
  let b = { x: start.x - 1, y: start.y };
  let dir = (ringIndex(b.x - p.x, b.y - p.y) + 1) % 8;
  let c = { x: p.x + RING[dir][0], y: p.y + RING[dir][1] };

  const maxIter = width * height * 8 + 8;
  let spins = 0;

  for (let iter = 0; iter < maxIter; iter++) {
    if (c.x === start.x && c.y === start.y) break;

    if (isFg(c.x, c.y)) {
      points.push({ x: c.x, y: c.y });
      b = { x: p.x, y: p.y };
      p = { x: c.x, y: c.y };
      dir = (ringIndex(b.x - p.x, b.y - p.y) + 1) % 8;
      c = { x: p.x + RING[dir][0], y: p.y + RING[dir][1] };
      spins = 0;
    } else {
      dir = (dir + 1) % 8;
      c = { x: p.x + RING[dir][0], y: p.y + RING[dir][1] };
      if (++spins >= 8) break; // isolated pixel — no foreground neighbor
    }
  }

  return points;
}
