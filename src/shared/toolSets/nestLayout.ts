import { ringBounds, type OutlineBounds, type OutlineRing } from '@/shared/utils/cutoutOutline';

export interface NestItem {
  /** The item's outline in its own frame, running from x = 0 to x = `length`. */
  readonly ring: OutlineRing;
  readonly length: number;
}

export interface NestPlacement {
  /** Where the item's centre (x = length / 2, y = 0 in its frame) lands. */
  readonly cx: number;
  readonly cy: number;
  /** Turned half a turn about its centre, so the box end points right. */
  readonly flipped: boolean;
}

const COARSE_STEP_MM = 2;
const REFINE_STEPS = 10;
/** Rows further back than this cannot reach a new row past its neighbours. */
const NEIGHBOUR_ROWS = 3;

export function placeRing(ring: OutlineRing, length: number, p: NestPlacement): OutlineRing {
  const half = length / 2;
  return ring.map(([x, y]) => {
    const u = x - half;
    return p.flipped ? [p.cx - u, p.cy - y] : [p.cx + u, p.cy + y];
  });
}

function segmentDistance(
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
  [px, py]: [number, number]
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(ax + t * dx - px, ay + t * dy - py);
}

function segmentsCross(
  [ax, ay]: [number, number],
  [bx, by]: [number, number],
  [cx, cy]: [number, number],
  [dx, dy]: [number, number]
): boolean {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

function contains(ring: OutlineRing, [px, py]: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function segmentBounds([ax, ay]: [number, number], [bx, by]: [number, number]): OutlineBounds {
  return {
    minX: Math.min(ax, bx),
    minY: Math.min(ay, by),
    maxX: Math.max(ax, bx),
    maxY: Math.max(ay, by),
  };
}

function boundsApart(a: OutlineBounds, b: OutlineBounds, gap: number): boolean {
  return (
    a.minX - b.maxX >= gap ||
    b.minX - a.maxX >= gap ||
    a.minY - b.maxY >= gap ||
    b.minY - a.maxY >= gap
  );
}

/** Whether two rings come closer than `gap`, overlapping included. */
export function closerThan(a: OutlineRing, b: OutlineRing, gap: number): boolean {
  const boundsB = ringBounds(b);
  if (boundsApart(ringBounds(a), boundsB, gap)) return false;
  if (contains(a, b[0]) || contains(b, a[0])) return true;
  for (let i = 0; i < a.length; i++) {
    const a1 = a[i];
    const a2 = a[(i + 1) % a.length];
    const segA = segmentBounds(a1, a2);
    if (boundsApart(segA, boundsB, gap)) continue;
    for (let j = 0; j < b.length; j++) {
      const b1 = b[j];
      const b2 = b[(j + 1) % b.length];
      if (boundsApart(segA, segmentBounds(b1, b2), gap)) continue;
      if (segmentsCross(a1, a2, b1, b2)) return true;
      if (segmentDistance(a1, a2, b1) < gap || segmentDistance(b1, b2, a1) < gap) return true;
    }
  }
  return false;
}

function halfHeight(ring: OutlineRing): number {
  return Math.max(...ring.map(([, y]) => Math.abs(y)));
}

/**
 * Stacks items head to tail: every other item turns half a turn and shifts
 * `oddShift` along x, and each row moves up to the rows before it until it is
 * `gapMm` from them. Row 0 sits at y = 0 and later rows go toward -y. A shift
 * of about a head's length lets each head sit beside the next row's handle.
 */
export function nestHeadToTail(
  items: readonly NestItem[],
  gapMm: number,
  oddShift = 0
): NestPlacement[] {
  const placements: NestPlacement[] = [];
  const placed: OutlineRing[] = [];

  items.forEach((item, i) => {
    const flipped = i % 2 === 1;
    const cx = flipped ? oddShift : 0;
    if (i === 0) {
      const first = { cx, cy: 0, flipped };
      placements.push(first);
      placed.push(placeRing(item.ring, item.length, first));
      return;
    }

    const prev = placements[i - 1];
    const neighbours = placed.slice(Math.max(0, i - NEIGHBOUR_ROWS));
    const fits = (cy: number): boolean => {
      const ring = placeRing(item.ring, item.length, { cx, cy, flipped });
      return neighbours.every((other) => !closerThan(other, ring, gapMm));
    };

    // Rows only move apart from here, so the first fit found going down is
    // the closest one, to within the refine step.
    const loose = prev.cy - (halfHeight(items[i - 1].ring) + halfHeight(item.ring) + gapMm);
    let tight = prev.cy;
    let ok = tight - COARSE_STEP_MM;
    while (ok > loose && !fits(ok)) {
      tight = ok;
      ok -= COARSE_STEP_MM;
    }
    ok = Math.max(ok, loose);
    for (let step = 0; step < REFINE_STEPS; step++) {
      const mid = (tight + ok) / 2;
      if (fits(mid)) ok = mid;
      else tight = mid;
    }

    const placement = { cx, cy: ok, flipped };
    placements.push(placement);
    placed.push(placeRing(item.ring, item.length, placement));
  });

  return placements;
}

export interface NestResult {
  readonly placements: NestPlacement[];
  readonly width: number;
  readonly depth: number;
}

function measure(items: readonly NestItem[], placements: NestPlacement[]): NestResult {
  const box = ringBounds(
    items.flatMap((item, i) => placeRing(item.ring, item.length, placements[i]))
  );
  return { placements, width: box.maxX - box.minX, depth: box.maxY - box.minY };
}

/**
 * The head-to-tail stack with the smallest footprint, trying shifts of the odd
 * rows from none to a little more than the widest head, both ways. Staying
 * within `maxWidth` (the print bed) matters most, then `accept`, then size.
 */
export function nestHeadToTailCompact(
  items: readonly NestItem[],
  gapMm: number,
  maxWidth = Infinity,
  accept: (result: NestResult) => boolean = () => true
): NestResult {
  const widest = Math.max(0, ...items.map((item) => halfHeight(item.ring) * 2));
  const shifts = [0, 0.5, 1, 1.5].flatMap((k) => (k === 0 ? [0] : [k * widest, -k * widest]));
  const results = shifts
    .map((shift) => measure(items, nestHeadToTail(items, gapMm, shift)))
    .sort((a, b) => a.width * a.depth - b.width * b.depth);
  const fitsBed = (r: NestResult): boolean => r.width <= maxWidth;
  return (
    results.find((r) => fitsBed(r) && accept(r)) ??
    results.find(fitsBed) ??
    results.find(accept) ??
    results.at(0) ?? { placements: [], width: 0, depth: 0 }
  );
}
