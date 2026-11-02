/**
 * Every tool in a segmented mask, as one raw outer contour each.
 *
 * Holes are not traced, so a piece lying inside another's outline (something
 * resting in a wrench's ring) is dropped: kept, it would become a pocket inside
 * a pocket. Specks under 1% of the largest piece go too.
 */

import type { Mask, Point } from './types';
import { labelComponents } from './components';
import { traceContour } from './contour';
import { fillPolygon } from './colorSegment';

/** Pieces smaller than this share of the largest are specks, not tools. */
const SPECK_SHARE = 0.01;

export interface ToolBlob {
  /** Outer contour through boundary pixel centres, image pixels. */
  readonly contour: readonly Point[];
  readonly areaPx: number;
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
  const box = keep.map(() => ({ x0: width, y0: height, x1: -1, y1: -1 }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = slot.get(labels[y * width + x]);
      if (i === undefined) continue;
      const b = box[i];
      if (x < b.x0) b.x0 = x;
      if (x > b.x1) b.x1 = x;
      if (y < b.y0) b.y0 = y;
      if (y > b.y1) b.y1 = y;
    }
  }
  const kept = keep
    .map((c, i) => {
      const b = box[i];
      // A blank pixel all round, so the trace never runs off the crop.
      const w = b.x1 - b.x0 + 3;
      const h = b.y1 - b.y0 + 3;
      const data = new Uint8Array(w * h);
      for (let y = b.y0; y <= b.y1; y++) {
        for (let x = b.x0; x <= b.x1; x++) {
          if (labels[y * width + x] === c.label) data[(y - b.y0 + 1) * w + (x - b.x0 + 1)] = 1;
        }
      }
      const local = traceContour(
        { width: w, height: h, data },
        { x: c.start.x - b.x0 + 1, y: c.start.y - b.y0 + 1 }
      );
      const contour = local.map((p) => ({ x: p.x + b.x0 - 1, y: p.y + b.y0 - 1 }));
      return { start: c.start, areaPx: c.area, contour };
    })
    .sort((a, b) => b.areaPx - a.areaPx);
  // Off the pixel grid, so the ray never grazes a contour vertex. A pixel of
  // another piece is at least two pixels from this contour, so the nudge
  // cannot carry it across. No area test: a thin ring holds fewer pixels than
  // a solid piece lying in its hole.
  const inside = (p: Point, contour: readonly Point[]) =>
    pointInPolygon({ x: p.x + 0.25, y: p.y + 0.25 }, contour);
  return kept
    .filter((c) => !kept.some((o) => o !== c && inside(c.start, o.contour)))
    .map(({ contour, areaPx }) => ({ contour, areaPx }));
}

/**
 * The point inside `poly` farthest from its edge, as a 0 to 1 fraction of the
 * frame: where a tap-prompted segmenter is surest to land on the tool, even an
 * L-shaped one whose centroid lies outside it.
 */
export function interiorSeed(poly: readonly Point[], width: number, height: number): Point {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x0 = Math.floor(Math.min(...xs)) - 1;
  const y0 = Math.floor(Math.min(...ys)) - 1;
  const w = Math.ceil(Math.max(...xs)) - x0 + 2;
  const h = Math.ceil(Math.max(...ys)) - y0 + 2;
  const fill = fillPolygon(
    poly.map((p) => ({ x: p.x - x0, y: p.y - y0 })),
    w,
    h
  );
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
