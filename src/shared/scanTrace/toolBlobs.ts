/**
 * Every tool in a segmented mask, as one raw outer contour each, with the
 * holes the surface shows through and whether it lies in another's hole.
 *
 * A hole is a background region that never reaches the frame's edge, labelled
 * 4-connected against the pieces' 8 so a diagonal gap cannot leak it out.
 * Specks go: pieces under 1% of the largest, holes under 0.1% of their piece.
 */

import type { Mask, Point } from './types';
import { labelComponents } from './components';
import { traceContour } from './contour';
import { fillPolygon } from './colorSegment';

/** Pieces smaller than this share of the largest are specks, not tools. */
const SPECK_SHARE = 0.01;
/** Holes smaller than this share of their piece are specks too. */
const HOLE_SHARE = 0.001;
/** And so is any hole under this many pixels. */
const MIN_HOLE_PX = 4;

export interface ToolBlob {
  /** Outer contour through boundary pixel centres, image pixels. */
  readonly contour: readonly Point[];
  readonly areaPx: number;
  /** Each hole's contour, through the centres of its own edge pixels. */
  readonly holes: readonly (readonly Point[])[];
  /**
   * Lies in another piece's hole, such as something resting in a ring. Kept
   * only when holes are, or it would be a pocket inside a pocket.
   */
  readonly inHole: boolean;
}

export function pointInPolygon(p: Point, poly: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

interface Region {
  readonly label: number;
  readonly area: number;
  readonly start: Point;
  readonly box: { x0: number; y0: number; x1: number; y1: number };
}

/** 4-connected background regions, with which of them reach the frame's edge. */
function labelBackground(mask: Mask): { labels: Int32Array; regions: Region[]; open: Set<number> } {
  const { width, height, data } = mask;
  const n = width * height;
  const labels = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const regions: Region[] = [];
  const open = new Set<number>();
  for (let seed = 0; seed < n; seed++) {
    if (data[seed] === 1 || labels[seed] !== -1) continue;
    const label = regions.length;
    const sx = seed % width;
    const box = { x0: sx, y0: (seed - sx) / width, x1: sx, y1: (seed - sx) / width };
    let sp = 0;
    let area = 0;
    stack[sp++] = seed;
    labels[seed] = label;
    while (sp > 0) {
      const q = stack[--sp];
      area++;
      const x = q % width;
      const y = (q - x) / width;
      if (x < box.x0) box.x0 = x;
      if (x > box.x1) box.x1 = x;
      if (y > box.y1) box.y1 = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) open.add(label);
      const push = (r: number) => {
        if (data[r] === 0 && labels[r] === -1) {
          labels[r] = label;
          stack[sp++] = r;
        }
      };
      if (x > 0) push(q - 1);
      if (x < width - 1) push(q + 1);
      if (y > 0) push(q - width);
      if (y < height - 1) push(q + width);
    }
    regions.push({ label, area, start: { x: sx, y: box.y0 }, box });
  }
  return { labels, regions, open };
}

/** One labelled region's contour, traced in its own padded crop. */
function traceRegion(labels: Int32Array, width: number, region: Region): Point[] {
  const b = region.box;
  // A blank pixel all round, so the trace never runs off the crop.
  const w = b.x1 - b.x0 + 3;
  const h = b.y1 - b.y0 + 3;
  const data = new Uint8Array(w * h);
  for (let y = b.y0; y <= b.y1; y++) {
    for (let x = b.x0; x <= b.x1; x++) {
      if (labels[y * width + x] === region.label) data[(y - b.y0 + 1) * w + (x - b.x0 + 1)] = 1;
    }
  }
  const local = traceContour(
    { width: w, height: h, data },
    { x: region.start.x - b.x0 + 1, y: region.start.y - b.y0 + 1 }
  );
  return local.map((p) => ({ x: p.x + b.x0 - 1, y: p.y + b.y0 - 1 }));
}

/** The mask's tools, largest first. */
export function findToolBlobs(mask: Mask, minAreaPx: number): ToolBlob[] {
  const { width, height } = mask;
  const { labels, components } = labelComponents(mask);
  const largest = components.reduce((m, c) => Math.max(m, c.area), 0);
  const floor = Math.max(minAreaPx, largest * SPECK_SHARE);
  const keep = components.filter((c) => c.area >= floor);
  // One pass for every kept piece's bounds, so each is traced in its own crop
  // rather than a full-frame copy per piece.
  const slot = new Map(keep.map((c, i) => [c.label, i]));
  const boxes = keep.map(() => ({ x0: width, y0: height, x1: -1, y1: -1 }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = slot.get(labels[y * width + x]);
      if (i === undefined) continue;
      const b = boxes[i];
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
    }
  }

  // A hole's topmost row has its owner directly above it: anything else up
  // there would be background joined to the hole, or a piece touching the owner.
  const background = labelBackground(mask);
  const holes = keep.map((): Point[][] => []);
  for (const region of background.regions) {
    if (background.open.has(region.label)) continue;
    const owner = slot.get(labels[(region.start.y - 1) * width + region.start.x]);
    if (owner === undefined) continue;
    if (region.area < Math.max(MIN_HOLE_PX, keep[owner].area * HOLE_SHARE)) continue;
    holes[owner].push(traceRegion(background.labels, width, region));
  }

  const kept = keep
    .map((c, i) => ({
      start: c.start,
      areaPx: c.area,
      contour: traceRegion(labels, width, {
        label: c.label,
        area: c.area,
        start: c.start,
        box: boxes[i],
      }),
      holes: holes[i],
    }))
    .sort((a, b) => b.areaPx - a.areaPx);
  // Off the pixel grid, so the ray never grazes a contour vertex. A pixel of
  // another piece is at least two pixels from this contour, so the nudge
  // cannot carry it across. No area test: a thin ring holds fewer pixels than
  // a solid piece lying in its hole.
  const inside = (p: Point, contour: readonly Point[]) =>
    pointInPolygon({ x: p.x + 0.25, y: p.y + 0.25 }, contour);
  return kept.map(({ start, contour, areaPx, holes: own }) => ({
    contour,
    areaPx,
    holes: own,
    inHole: kept.some((o) => o.contour !== contour && inside(start, o.contour)),
  }));
}

/**
 * The point inside `poly` farthest from its edge, as a 0 to 1 fraction of the
 * frame: where a tap-prompted segmenter is surest to land on the tool, even an
 * L-shaped one whose centroid lies outside it.
 */
export function interiorSeed(
  poly: readonly Point[],
  width: number,
  height: number,
  holes: readonly (readonly Point[])[] = []
): Point {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x0 = Math.floor(Math.min(...xs)) - 1;
  const y0 = Math.floor(Math.min(...ys)) - 1;
  const w = Math.ceil(Math.max(...xs)) - x0 + 2;
  const h = Math.ceil(Math.max(...ys)) - y0 + 2;
  const local = (ring: readonly Point[]) => ring.map((p) => ({ x: p.x - x0, y: p.y - y0 }));
  const fill = fillPolygon(local(poly), w, h);
  // The tool's own material: a ring's seed belongs on the ring, not in its hole.
  for (const hole of holes) {
    const gap = fillPolygon(local(hole), w, h);
    for (let i = 0; i < fill.length; i++) if (gap[i] === 1) fill[i] = 0;
  }
  // Two-pass chessboard distance to the nearest outside pixel.
  const dist = new Int32Array(w * h);
  const big = w + h;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (fill[i] === 0) continue;
      let d = big;
      if (y > 0) {
        d = Math.min(d, dist[i - w] + 1);
        if (x > 0) d = Math.min(d, dist[i - w - 1] + 1);
        if (x < w - 1) d = Math.min(d, dist[i - w + 1] + 1);
      }
      if (x > 0) d = Math.min(d, dist[i - 1] + 1);
      dist[i] = d;
    }
  }
  let best = -1;
  let bestD = 0;
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (fill[i] === 0) continue;
      let d = dist[i];
      if (y < h - 1) {
        d = Math.min(d, dist[i + w] + 1);
        if (x > 0) d = Math.min(d, dist[i + w - 1] + 1);
        if (x < w - 1) d = Math.min(d, dist[i + w + 1] + 1);
      }
      if (x < w - 1) d = Math.min(d, dist[i + 1] + 1);
      dist[i] = d;
      if (d >= bestD) {
        bestD = d;
        best = i;
      }
    }
  }
  if (best === -1) {
    const cx = xs.reduce((s, v) => s + v, 0) / xs.length;
    const cy = ys.reduce((s, v) => s + v, 0) / ys.length;
    return { x: cx / width, y: cy / height };
  }
  const bx = best % w;
  return { x: (bx + x0) / width, y: ((best - bx) / w + y0) / height };
}
