/**
 * The measuring strip: a row of the calibration sheet's markers printed on a
 * strip of paper and laid across the top of a tool, so the photo is measured
 * at the tool's own height rather than the table's. The geometry here is the
 * one source for the detector and the printable page.
 *
 * The strip covers part of the tool, so where it crosses an edge the outline
 * is bridged across it, and the tool is flagged for the user to check.
 */

import type { ImageDataLike, Mask, Point } from './types';
import { fillPolygon } from './colorSegment';
import { binarize, type SoftMask } from './softContour';
import { toGrayscale, computeOtsuThreshold } from './mask';
import { findQuadBlobs, quadArea, type BlobScanOptions, type CellQuad } from './latticeBlobs';
import { pointInPolygon } from './toolBlobs';
import { CALIBRATION_MARKER_MM, CALIBRATION_PITCH_MM } from './calibrationGrid';

export const STRIP_MARKER_COUNTS = [3, 4, 5] as const;
/** White paper beyond the markers on every side, mm. */
export const STRIP_MARGIN_MM = 6;

export function stripSizeMm(markers: number): { readonly length: number; readonly width: number } {
  const border = CALIBRATION_MARKER_MM + 2 * STRIP_MARGIN_MM;
  return { length: (markers - 1) * CALIBRATION_PITCH_MM + border, width: border };
}

export interface SceneStrip {
  readonly a: Point;
  readonly b: Point;
  /** From the first marker's centre to the last's. */
  readonly lengthMm: number;
  readonly markers: readonly CellQuad[];
  /** The strip's paper, in image pixels. */
  readonly paper: readonly [Point, Point, Point, Point];
}

const SCAN: BlobScanOptions = {
  minAreaFraction: 0.0002,
  maxAreaFraction: 0.05,
  minQuadFitness: 0.7,
  minQuadFill: 0.75,
  maxEdgeRatio: 1.7,
  dark: true,
};

/** As in the sheet's detector: a second, darker cut for paper the table's tone pulls under Otsu. */
const DARK_PASS_FRACTION = 0.55;
/** How far a marker's spacing or size may stray from the printed ones, as a share. */
const SLACK = 0.2;
/** A strip whose markers sit further than this from an even, straight row is not one (mm). */
const MAX_RMS_MM = 0.6;

const side = (quad: CellQuad): number => Math.sqrt(quadArea(quad));
const dist = (p: Point, q: Point): number => Math.hypot(p.x - q.x, p.y - q.y);

interface Blob {
  readonly corners: CellQuad;
  readonly center: Point;
  readonly side: number;
}

function nextAlong(blobs: readonly Blob[], from: Blob, step: Point): Blob | null {
  const want = { x: from.center.x + step.x, y: from.center.y + step.y };
  const reach = SLACK * Math.hypot(step.x, step.y);
  let best: Blob | null = null;
  for (const b of blobs) {
    if (Math.abs(b.side / from.side - 1) > SLACK) continue;
    const d = dist(b.center, want);
    if (d <= reach && (!best || d < dist(best.center, want))) best = b;
  }
  return best;
}

/**
 * Whether `row` reads as a printed strip: markers of the printed size for
 * its spacing, evenly along a straight line.
 */
function isStrip(row: readonly Blob[]): boolean {
  const a = row[0].center;
  const b = row[row.length - 1].center;
  const pxPerMm = dist(a, b) / ((row.length - 1) * CALIBRATION_PITCH_MM);
  const markerMm = row.reduce((s, m) => s + m.side, 0) / row.length / pxPerMm;
  return (
    Math.abs(markerMm / CALIBRATION_MARKER_MM - 1) <= SLACK && rowRmsMm(row, pxPerMm) <= MAX_RMS_MM
  );
}

/**
 * The longest row of markers two marker widths apart that reads as a strip.
 * Each row is checked before it is ranked, so a bent longer one cannot hide
 * a straight shorter one.
 */
function bestRow(blobs: readonly Blob[]): Blob[] | null {
  let best: Blob[] | null = null;
  const most = STRIP_MARKER_COUNTS[STRIP_MARKER_COUNTS.length - 1];
  for (const first of blobs) {
    for (const second of blobs) {
      if (first === second || Math.abs(second.side / first.side - 1) > SLACK) continue;
      const pitch =
        (CALIBRATION_PITCH_MM / CALIBRATION_MARKER_MM) * ((first.side + second.side) / 2);
      if (Math.abs(dist(first.center, second.center) / pitch - 1) > SLACK) continue;
      const step = { x: second.center.x - first.center.x, y: second.center.y - first.center.y };
      // Only rows read from their first marker, so each is found once.
      const back = { x: -step.x, y: -step.y };
      if (nextAlong(blobs, first, back)) continue;
      const row = [first, second];
      for (let next = nextAlong(blobs, second, step); next && row.length < most + 1;) {
        row.push(next);
        next = nextAlong(blobs, next, step);
      }
      if (row.length > most || row.length < STRIP_MARKER_COUNTS[0] || !isStrip(row)) continue;
      if (!best || row.length > best.length) best = row;
    }
  }
  return best;
}

function rowRmsMm(row: readonly Blob[], pxPerMm: number): number {
  const a = row[0].center;
  const b = row[row.length - 1].center;
  let sum = 0;
  for (let i = 0; i < row.length; i++) {
    const t = i / (row.length - 1);
    const want = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    sum += dist(row[i].center, want) ** 2;
  }
  return Math.sqrt(sum / row.length) / pxPerMm;
}

function paperAround(a: Point, b: Point, pxPerMm: number): [Point, Point, Point, Point] {
  const length = dist(a, b);
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const reach = (CALIBRATION_MARKER_MM / 2 + STRIP_MARGIN_MM) * pxPerMm;
  const at = (along: number, across: number): Point => ({
    x: (along < 0 ? a.x : b.x) + ux * along - uy * across,
    y: (along < 0 ? a.y : b.y) + uy * along + ux * across,
  });
  return [at(-reach, -reach), at(reach, -reach), at(reach, reach), at(-reach, reach)];
}

/**
 * A measuring strip in the photo, or null. Markers inside `exclude` (a
 * calibration sheet's, which line up the same way) are passed over.
 */
export function detectMarkerStrip(
  image: ImageDataLike,
  exclude: readonly (readonly Point[])[] = []
): SceneStrip | null {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return null;
  const gray = toGrayscale(image);
  const otsu = computeOtsuThreshold(gray);
  for (const threshold of [otsu, Math.round(otsu * DARK_PASS_FRACTION)]) {
    if (threshold <= 0) continue;
    const blobs = findQuadBlobs(gray, width, height, threshold, SCAN)
      .filter((blob) => !exclude.some((poly) => pointInPolygon(blob.center, poly)))
      .map((blob) => ({ ...blob, side: side(blob.corners) }));
    const row = bestRow(blobs);
    if (!row) continue;
    const a = row[0].center;
    const b = row[row.length - 1].center;
    const lengthMm = (row.length - 1) * CALIBRATION_PITCH_MM;
    const pxPerMm = dist(a, b) / lengthMm;
    return {
      a,
      b,
      lengthMm,
      markers: row.map((m) => m.corners),
      paper: paperAround(a, b, pxPerMm),
    };
  }
  return null;
}

/**
 * `mask` with each tool the strip crosses joined across it. Along the strip,
 * every line across it that finds tool just past both long edges is filled
 * between them, so the outline runs straight under the paper.
 */
export function bridgeAcrossStrip(mask: Mask, strip: SceneStrip): Mask {
  const { width, height } = mask;
  const data = Uint8Array.from(mask.data);
  const [p0, p1, , p3] = strip.paper;
  const along = { x: p1.x - p0.x, y: p1.y - p0.y };
  const across = { x: p3.x - p0.x, y: p3.y - p0.y };
  const length = Math.hypot(along.x, along.y);
  const span = Math.hypot(across.x, across.y);
  if (!(length > 0 && span > 0)) return mask;
  const ux = across.x / span;
  const uy = across.y / span;
  // Just past the paper's edge, clear of the excluded band round it.
  const past = Math.max(3, span * 0.15);
  const at = (x: number, y: number): number => {
    const px = Math.round(x);
    const py = Math.round(y);
    return px >= 0 && py >= 0 && px < width && py < height ? py * width + px : -1;
  };
  const isTool = (i: number): boolean => i >= 0 && mask.data[i] === 1;
  for (let s = 0; s <= length; s += 0.5) {
    const ox = p0.x + (along.x / length) * s;
    const oy = p0.y + (along.y / length) * s;
    if (!isTool(at(ox - ux * past, oy - uy * past))) continue;
    if (!isTool(at(ox + ux * (span + past), oy + uy * (span + past)))) continue;
    for (let t = -past; t <= span + past; t += 0.5) {
      const i = at(ox + ux * t, oy + uy * t);
      if (i >= 0) data[i] = 1;
    }
  }
  return { width, height, data };
}

/**
 * The model's soft mask with the strip's paper taken out and the tool joined
 * across it, as `bridgeAcrossStrip` does for the colour pass. Without it, a
 * redraw keeps only the larger piece the strip leaves visible.
 */
export function bridgeSoftAcrossStrip(soft: SoftMask, strip: SceneStrip): SoftMask {
  const { width, height } = soft;
  const paper = fillPolygon(strip.paper, width, height);
  const outside = Float32Array.from(soft.data, (v, i) => (paper[i] === 1 ? 0 : v));
  const bridged = bridgeAcrossStrip(binarize({ width, height, data: outside }), strip);
  return {
    width,
    height,
    // Only the pixels the bridge adds change: the model's own values place the
    // edges everywhere else, to a fraction of a pixel.
    data: Float32Array.from(outside, (v, i) => (v < 0.5 && bridged.data[i] === 1 ? 1 : v)),
  };
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  const side = (p: Point, q: Point, r: Point): number =>
    (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;
}

/** Whether an outline reaches the strip's paper, so part of it may lie under the strip. */
export function touchesStrip(points: readonly Point[], strip: SceneStrip): boolean {
  const [p0, p1, p2, p3] = strip.paper;
  const c = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  const grow = (p: Point): Point => ({ x: c.x + (p.x - c.x) * 1.08, y: c.y + (p.y - c.y) * 1.08 });
  const reach = [grow(p0), grow(p1), grow(p2), grow(p3)];
  if (points.some((p) => pointInPolygon(p, reach))) return true;
  // A simplified outline can run straight under the strip with no point on it.
  return points.some((a, i) => {
    const b = points[(i + 1) % points.length];
    return reach.some((q, k) => segmentsCross(a, b, q, reach[(k + 1) % reach.length]));
  });
}
