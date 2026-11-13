/**
 * A plain sheet of office paper lying under the tools, found by itself.
 *
 * The sheet is the near-white region whose hull is a clean quadrilateral
 * with all four corners in frame. Which sheet it is comes from
 * its shape alone: A4 and US Letter differ by 9% in aspect, so a quad that
 * reads as neither is not taken for paper at all. That also keeps a wallet
 * card (1.586) from being read as a sheet.
 *
 * Corners come from a line fitted to each side, not from the outline's
 * extreme points, so a dog-eared corner or a tool lying across an edge does
 * not move them.
 */

import type { ImageDataLike, Point } from './types';
import { computeOtsuThreshold, usesAlphaMask } from './mask';
import { labelComponents, maskFromLabel } from './components';
import { traceContour } from './contour';
import { contourToQuad } from './quad';
import { convexHull } from './minAreaRect';
import { lensRange, PAPER_SIZES, sidesThroughCamera, type PaperSize } from './manualReference';

export interface PaperSheet {
  /** Ordered [TL, TR, BR, BL] in image pixels. */
  readonly corners: readonly [Point, Point, Point, Point];
  readonly size: PaperSize;
  /** Each white piece's own quad, when a tool across the sheet cut it into several. */
  readonly parts: readonly (readonly Point[])[];
}

/** A sheet smaller than this share of the frame is too small to size tools by. */
const MIN_AREA_SHARE = 0.08;
const MIN_QUAD_FITNESS = 0.7;
/** White pieces this share of the largest can be part of the same sheet. */
const PIECE_SHARE = 0.02;
/** The white pieces must fill this much of the quad, or they are not one sheet. */
const MIN_SHEET_FILL = 0.6;
/** Mean max−min of RGB over the sheet; above this it is coloured, not paper. */
const MAX_MEAN_CHROMA = 40;
/** Half the gap between A4 and Letter, less a margin: nearer than this to one is that one. */
const ASPECT_TOLERANCE = 0.04;
/** Lens-range ends must agree this closely when the quad gives no focal length. */
const ASPECT_AGREEMENT = 0.02;
/** The part of each side, by length, that a line is fitted to, clear of the corners. */
const SIDE_SPAN = [0.1, 0.9] as const;
/** Share of a side's length that must lie on its fitted line. */
const MIN_SIDE_SUPPORT = 0.25;
const LINE_INLIER_PX = 1.5;

interface Line {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
}

function fitLine(points: readonly Point[]): Line | null {
  const n = points.length;
  if (n < 2) return null;
  let mx = 0;
  let my = 0;
  for (const p of points) {
    mx += p.x;
    my += p.y;
  }
  mx /= n;
  my /= n;
  let sxx = 0;
  let sxy = 0;
  let syy = 0;
  for (const p of points) {
    sxx += (p.x - mx) ** 2;
    sxy += (p.x - mx) * (p.y - my);
    syy += (p.y - my) ** 2;
  }
  const angle = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  return { x: mx, y: my, dx: Math.cos(angle), dy: Math.sin(angle) };
}

const offLine = (p: Point, l: Line): number => (p.x - l.x) * l.dy - (p.y - l.y) * l.dx;

function meet(a: Line, b: Line): Point | null {
  const det = a.dx * b.dy - a.dy * b.dx;
  if (Math.abs(det) < 1e-9) return null;
  const t = ((b.x - a.x) * b.dy - (b.y - a.y) * b.dx) / det;
  return { x: a.x + t * a.dx, y: a.y + t * a.dy };
}

/**
 * The line along the side from `a` to `b`, fitted to the contour points near
 * it and moved half a pixel away from `centre`: the contour runs through the
 * centres of the sheet's outermost pixels, and the edge is half a pixel past.
 */
function sideLine(
  contour: readonly Point[],
  a: Point,
  b: Point,
  centre: Point,
  width: number,
  height: number
): Line | null {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 8) return null;
  const ux = (b.x - a.x) / length;
  const uy = (b.y - a.y) / length;
  const reach = Math.max(3, 0.02 * length);
  const near = contour.filter((p) => {
    if (p.x <= 0 || p.y <= 0 || p.x >= width - 1 || p.y >= height - 1) return false;
    const along = ((p.x - a.x) * ux + (p.y - a.y) * uy) / length;
    const off = (p.x - a.x) * uy - (p.y - a.y) * ux;
    return along >= SIDE_SPAN[0] && along <= SIDE_SPAN[1] && Math.abs(off) <= reach;
  });
  const rough = fitLine(near);
  if (!rough) return null;
  const inliers = near.filter((p) => Math.abs(offLine(p, rough)) <= LINE_INLIER_PX);
  // A diagonal side has 1/√2 contour points per pixel of length.
  if (inliers.length < MIN_SIDE_SUPPORT * length * Math.SQRT1_2) return null;
  const line = fitLine(inliers);
  if (!line) return null;
  const out = offLine(centre, line) > 0 ? -0.5 : 0.5;
  return { ...line, x: line.x + out * line.dy, y: line.y - out * line.dx };
}

function quadArea(corners: readonly Point[]): number {
  let area = 0;
  for (let i = 0; i < corners.length; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % corners.length];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** The sheet's long side over its short side, or null when the photo cannot say. */
function sheetAspect(
  corners: readonly [Point, Point, Point, Point],
  frame: { readonly width: number; readonly height: number }
): number | null {
  const view = sidesThroughCamera(corners, frame);
  if (!view) return null;
  const at = (f2: number): number => {
    const [top, left] = view.at(f2);
    const ratio = Math.sqrt(top / left);
    return ratio >= 1 ? ratio : 1 / ratio;
  };
  if (view.focal2 !== null) return at(view.focal2);
  const [wide, tele] = lensRange(frame).map(at);
  return Math.abs(wide - tele) <= ASPECT_AGREEMENT ? (wide + tele) / 2 : null;
}

function sizeOf(aspect: number): PaperSize | null {
  let best: PaperSize | null = null;
  let least = ASPECT_TOLERANCE;
  for (const size of Object.keys(PAPER_SIZES) as PaperSize[]) {
    const miss = Math.abs(aspect - PAPER_SIZES[size].longMm / PAPER_SIZES[size].shortMm);
    if (miss <= least) {
      least = miss;
      best = size;
    }
  }
  return best;
}

/** The sheet of A4 or US Letter paper in `image`, or null when there is none to go by. */
export function findPaper(image: ImageDataLike): PaperSheet | null {
  const { width, height, data } = image;
  const n = width * height;
  if (n === 0 || usesAlphaMask(image)) return null;

  // The darkest channel: high only where a pixel is both bright and uncoloured.
  const white = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    white[i] = Math.min(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
  }
  const threshold = computeOtsuThreshold(white);
  const mask = { width, height, data: new Uint8Array(n) };
  for (let i = 0; i < n; i++) mask.data[i] = white[i] >= threshold ? 1 : 0;

  const labeled = labelComponents(mask);
  const largest = labeled.components.reduce<Piece | null>(
    (most, c) => (!most || c.area > most.area ? c : most),
    null
  );
  if (!largest) return null;
  // A tool lying right across the sheet cuts it in two, so the white pieces
  // are tried together first: half an A4 sheet has the shape of a whole one.
  // Pieces that make no sheet together, such as two sheets set apart, leave
  // the largest to be tried alone.
  const pieces = labeled.components.filter((c) => c.area >= PIECE_SHARE * largest.area);
  const tries = pieces.length > 1 ? [pieces, [largest]] : [[largest]];
  for (const candidate of tries) {
    const sheet = sheetFrom(image, labeled.labels, candidate);
    if (sheet) return sheet;
  }
  return null;
}

type Piece = ReturnType<typeof labelComponents>['components'][number];

/** The sheet that the white `pieces` make up together, or null when they make none. */
function sheetFrom(
  image: ImageDataLike,
  labels: Int32Array,
  pieces: readonly Piece[]
): PaperSheet | null {
  const { width, height, data } = image;
  const n = width * height;
  const area = pieces.reduce((sum, c) => sum + c.area, 0);
  if (area < MIN_AREA_SHARE * n) return null;

  const ofSheet = new Set(pieces.map((c) => c.label));
  let chroma = 0;
  for (let i = 0; i < n; i++) {
    if (!ofSheet.has(labels[i])) continue;
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    chroma += Math.max(r, g, b) - Math.min(r, g, b);
  }
  if (chroma / area > MAX_MEAN_CHROMA) return null;

  const contours = pieces.map((c) =>
    traceContour(maskFromLabel(labels, c.label, width, height), c.start)
  );
  const contour = contours.flat();
  // Judged on the hull: a tool across an edge notches the outline, and the
  // side lines below already ask each side for an edge of its own.
  const quad = contourToQuad(convexHull(contour));
  if (!quad || quad.fitness < MIN_QUAD_FITNESS) return null;
  if (area < MIN_SHEET_FILL * quadArea(quad.corners)) return null;

  const rough = quad.corners;
  const centre = {
    x: (rough[0].x + rough[1].x + rough[2].x + rough[3].x) / 4,
    y: (rough[0].y + rough[1].y + rough[2].y + rough[3].y) / 4,
  };
  const sides: Line[] = [];
  for (let i = 0; i < 4; i++) {
    const line = sideLine(contour, rough[i], rough[(i + 1) % 4], centre, width, height);
    if (!line) return null;
    sides.push(line);
  }
  // A corner out of frame is a sheet the photo cut off, with no length to read.
  const inFrame = (p: Point | null): p is Point =>
    p !== null && p.x >= 0 && p.y >= 0 && p.x <= width - 1 && p.y <= height - 1;
  const [tl, tr, br, bl] = [0, 1, 2, 3].map((i) => meet(sides[(i + 3) % 4], sides[i]));
  if (!inFrame(tl) || !inFrame(tr) || !inFrame(br) || !inFrame(bl)) return null;
  const ordered: [Point, Point, Point, Point] = [tl, tr, br, bl];

  const aspect = sheetAspect(ordered, image);
  const size = aspect === null ? null : sizeOf(aspect);
  if (!size) return null;
  const parts =
    contours.length > 1
      ? contours.flatMap((piece) => {
          const own = contourToQuad(piece);
          return own ? [own.corners] : [];
        })
      : [];
  return { corners: ordered, size, parts };
}
