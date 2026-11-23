/**
 * The open cells of a kumiko lattice on a rounded corner, as flat polygons.
 *
 * The cells are the band rectangle minus the stroked struts, found in the
 * unrolled (u, z) plane. The corner arc is cut into facets, and a cell is cut
 * into one piece for each facet it reaches. A builder extrudes each piece
 * through the wall along its facet's normal and joins the pieces of a cell.
 *
 * Pure-math module — NO brepjs imports.
 */

import polygonClipping, { type Polygon, type Ring } from 'polygon-clipping';

import type { KumikoLattice, KumikoSegment } from './patterns';
import { COPLANAR_OVERLAP } from './generatorConstants';
import {
  AXIS_EPSILON,
  maxStrutWidth,
  clipSegmentToURange,
  clipSegmentToURangePeriodic,
  extendSegment,
  fillingPiecesForRange,
} from './kumikoSegments';

/** A point in a facet's plane: `t` along the facet, `z` up. */
export type CellPoint = readonly [t: number, z: number];

export interface CornerCellPiece {
  /** Angle of the facet's normal from the corner's start, radians. */
  readonly phiMid: number;
  readonly outer: readonly CellPoint[];
  readonly holes: readonly (readonly CellPoint[])[];
}

export type CornerCell = readonly CornerCellPiece[];

/**
 * Facets per corner. The cells of two neighbor facets meet on the outer wall
 * face and overlap inside the wall by about wallThickness × the facet angle.
 * Seven facets keep that overlap below the width a strut loses to true radial
 * sides.
 */
const FACETS_PER_CORNER = 7;

/** How far a seam can move from its regular position, as a fraction of a facet. */
const SEAM_REACH = 0.3;

const GRID = 1e6;
const snap = (v: number): number => Math.round(v * GRID) / GRID;

/** Cells below this area (mm²) are contact artifacts between struts, not openings. */
const MIN_CELL_AREA = 0.01;
/** Cells thinner than this (area / perimeter, mm) are slivers a mesher drops. */
const MIN_CELL_THICKNESS = 0.02;

/** A strut or filling piece as a rectangle in the unrolled plane, u from the corner's start. */
function strokeRing(seg: KumikoSegment, defaultWidth: number, u0: number, bandZ0: number): Polygon {
  const width = (seg.width ?? defaultWidth) + 2 * COPLANAR_OVERLAP;
  let ua = seg.a[0] - u0;
  let ub = seg.b[0] - u0;
  let za = seg.a[1] + bandZ0;
  let zb = seg.b[1] + bandZ0;
  // Same axis snap as the swept corner struts: a near-vertical or
  // near-horizontal piece is exactly vertical or horizontal.
  if (Math.abs(ub - ua) < AXIS_EPSILON) ua = ub = (ua + ub) / 2;
  else if (Math.abs(zb - za) < AXIS_EPSILON) za = zb = (za + zb) / 2;
  const len = Math.hypot(ub - ua, zb - za);
  const dx = len === 0 ? 1 : (ub - ua) / len;
  const dz = len === 0 ? 0 : (zb - za) / len;
  const cx = (ua + ub) / 2;
  const cz = (za + zb) / 2;
  const hl = len / 2;
  const hw = width / 2;
  const pt = (l: number, n: number): [number, number] => [
    snap(cx + l * dx - n * dz),
    snap(cz + l * dz + n * dx),
  ];
  const ring: Ring = [pt(-hl, -hw), pt(hl, -hw), pt(hl, hw), pt(-hl, hw), pt(-hl, -hw)];
  return [ring];
}

function cleanRing(ring: Ring): [number, number][] {
  const near = (p: readonly number[], q: readonly number[]): boolean =>
    Math.abs(p[0] - q[0]) < 2 / GRID && Math.abs(p[1] - q[1]) < 2 / GRID;
  const pts: [number, number][] = [];
  for (const [x, y] of ring) {
    const last = pts.at(-1);
    if (last && near(last, [x, y])) continue;
    pts.push([x, y]);
  }
  while (pts.length > 1 && near(pts[0], pts[pts.length - 1])) pts.pop();
  // Drop a vertex on the line through its neighbors.
  let i = 0;
  while (pts.length > 3 && i < pts.length) {
    const a = pts[(i + pts.length - 1) % pts.length];
    const b = pts[i];
    const c = pts[(i + 1) % pts.length];
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) < 1e-9) {
      pts.splice(i, 1);
      i = Math.max(0, i - 1);
    } else {
      i++;
    }
  }
  return pts;
}

function ringArea(pts: readonly (readonly [number, number])[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(a) / 2;
}

function ringPerimeter(pts: readonly (readonly [number, number])[]): number {
  let l = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    l += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  return l;
}

function isOpening(pts: readonly (readonly [number, number])[]): boolean {
  if (pts.length < 3) return false;
  const area = ringArea(pts);
  return area >= MIN_CELL_AREA && area / ringPerimeter(pts) >= MIN_CELL_THICKNESS;
}

/**
 * Where the facets of a corner meet, from 0 to `arc`.
 *
 * A seam through a cell corner cuts that cell into a piece with a zero-width
 * tip, and the export then has zero-area triangles. A lattice puts its cell
 * corners at regular positions, so a regular seam can hit a whole row of them.
 * Each seam therefore moves from its regular position to the middle of the
 * widest gap between cell corners that it can reach.
 */
function seamPositions(cells: readonly Polygon[], arc: number): number[] {
  const corners = [
    ...new Set(cells.flatMap((polygon) => polygon.flatMap((ring) => ring.map(([x]) => x)))),
  ].sort((a, b) => a - b);
  const step = arc / FACETS_PER_CORNER;
  const seams = [0];
  for (let k = 1; k < FACETS_PER_CORNER; k++) {
    const target = k * step;
    const lo = target - step * SEAM_REACH;
    const hi = target + step * SEAM_REACH;
    const stops = [lo, ...corners.filter((x) => x > lo && x < hi), hi];
    let best = target;
    let bestGap = -1;
    for (let i = 0; i + 1 < stops.length; i++) {
      const gap = stops[i + 1] - stops[i];
      if (gap > bestGap + 1e-9) {
        bestGap = gap;
        best = (stops[i] + stops[i + 1]) / 2;
      }
    }
    seams.push(snap(best));
  }
  seams.push(snap(arc));
  return seams;
}

/**
 * The cells of one corner, each as its pieces on the facets. Returns null when
 * the lattice has no strut on the corner, so the caller keeps its own rule
 * for that case.
 *
 * @param u0 perimeter position of the corner's start
 * @param u1 perimeter position of the corner's end
 * @param faceRadius radius at which neighbor facets meet (just outside the wall)
 */
export function cornerCells(
  lattice: KumikoLattice,
  u0: number,
  u1: number,
  bandZ0: number,
  bandHeight: number,
  outerRadius: number,
  faceRadius: number,
  perimeter: number
): CornerCell[] | null {
  const w = lattice.strutWidth;
  const maxW = maxStrutWidth(lattice);
  const strokes: Polygon[] = [];
  for (const seg of lattice.segments) {
    for (const piece of clipSegmentToURangePeriodic(seg, u0 - w, u1 + w, perimeter)) {
      const pw = piece.width ?? w;
      strokes.push(strokeRing(extendSegment(piece, pw / 2), w, u0, bandZ0));
    }
  }
  for (const filling of fillingPiecesForRange(lattice, u0 - maxW, u1 + maxW, perimeter)) {
    const piece = clipSegmentToURange(filling, u0 - maxW, u1 + maxW);
    if (!piece) continue;
    const pw = piece.width ?? w;
    strokes.push(strokeRing(extendSegment(piece, pw / 2), w, u0, bandZ0));
  }
  if (strokes.length === 0) return null;

  const arc = u1 - u0;
  const z0 = snap(bandZ0);
  const z1 = snap(bandZ0 + bandHeight);
  const band = (x0: number, x1: number): Polygon => [
    [
      [x0, z0],
      [x1, z0],
      [x1, z1],
      [x0, z1],
      [x0, z0],
    ],
  ];
  const whole: Polygon[] = [];
  for (const polygon of polygonClipping.difference(band(0, snap(arc)), ...strokes)) {
    const outer = cleanRing(polygon[0]);
    if (!isOpening(outer)) continue;
    const holes = polygon.slice(1).map(cleanRing).filter(isOpening);
    whole.push([outer, ...holes].map((ring) => [...ring, ring[0]]));
  }
  const seams = seamPositions(whole, arc);
  const cells: CornerCellPiece[][] = whole.map(() => []);
  for (let k = 0; k < FACETS_PER_CORNER; k++) {
    const x0 = seams[k];
    const x1 = seams[k + 1];
    const phiMid = (x0 + x1) / 2 / outerRadius;
    const rect = band(x0, x1);
    // A point at angle δ from the facet's normal sits at faceRadius × sin δ
    // along the facet, so neighbor facets meet on the faceRadius cylinder.
    const toFacet = ([x, z]: readonly [number, number]): CellPoint => [
      faceRadius * Math.sin(x / outerRadius - phiMid),
      z,
    ];
    whole.forEach((cell, i) => {
      // Every piece stays, however thin: a dropped piece leaves a wall of
      // material across its cell.
      for (const piece of polygonClipping.intersection(cell, rect)) {
        const outer = cleanRing(piece[0]);
        if (outer.length < 3) continue;
        const holes = piece
          .slice(1)
          .map(cleanRing)
          .filter((h) => h.length >= 3);
        cells[i].push({
          phiMid,
          outer: outer.map(toFacet),
          holes: holes.map((h) => h.map(toFacet)),
        });
      }
    });
  }
  return cells.filter((cell) => cell.length > 0);
}
