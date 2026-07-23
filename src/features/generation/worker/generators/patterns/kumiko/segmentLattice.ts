/**
 * Triangular jigumi lattice generator for kumiko wall patterns.
 *
 * Generates the segment set for a band of `perimeter × bandHeight` in unrolled
 * (u, z) coordinates: vertical strut columns plus ±30° diagonal families, with
 * per-vertex pattern fillings. The u axis is a CLOSED loop — the lattice must
 * tile seamlessly modulo the perimeter.
 *
 * Wrap-closure constraint: each column staggers the vertex grid by cellSize/2,
 * and the ±30° diagonals advance by cellSize/2 per column too. The diagonal
 * families reconnect across the u = 0 seam only when the total advance is an
 * integer number of cellSize steps — i.e. the column count must be EVEN.
 * `quantizeColumns` therefore rounds to an even count.
 *
 * Pure-math module — NO brepjs imports.
 */

import type { KumikoBandConfig, KumikoLattice, KumikoPatternDef, KumikoSegment } from './types';

/** √3 — the triangular lattice's aspect constant. */
const SQRT3 = Math.sqrt(3);

/** Fixed strut stroke width (mm) — ~3 nozzle widths, printable at any scale. */
export const KUMIKO_STRUT_WIDTH = 1.2;

/** Neutral triangle edge length (mm) before the scale factor is applied. */
export const KUMIKO_BASE_CELL_SIZE = 9;

/** Column-count ceiling so a fine scale on a huge bin can't explode the 2D boolean. */
const MAX_COLUMNS = 120;

/** Segments shorter than this after clipping are dropped as degenerate (mm). */
const MIN_SEGMENT_LENGTH = 0.05;

/**
 * Quantize a target cell size so an even, whole number of columns closes the
 * perimeter loop. Returns the column count and the exact cell metrics.
 */
export function quantizeColumns(
  perimeter: number,
  targetCellSize: number
): { columns: number; columnPitch: number; cellSize: number } {
  const targetPitch = (targetCellSize * SQRT3) / 2;
  const raw = 2 * Math.round(perimeter / (2 * targetPitch));
  const columns = Math.min(MAX_COLUMNS, Math.max(4, raw));
  const columnPitch = perimeter / columns;
  const cellSize = (2 * columnPitch) / SQRT3;
  return { columns, columnPitch, cellSize };
}

/** Liang-Barsky style clip of a segment to [0,uMax] × [0,zMax]; null if outside. */
export function clipSegmentToBand(
  seg: KumikoSegment,
  uMax: number,
  zMax: number
): KumikoSegment | null {
  const [u1, z1] = seg.a;
  const [u2, z2] = seg.b;
  const du = u2 - u1;
  const dz = z2 - z1;
  let t0 = 0;
  let t1 = 1;
  const edges: ReadonlyArray<readonly [number, number]> = [
    [-du, u1],
    [du, uMax - u1],
    [-dz, z1],
    [dz, zMax - z1],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  const a: readonly [number, number] = [u1 + t0 * du, z1 + t0 * dz];
  const b: readonly [number, number] = [u1 + t1 * du, z1 + t1 * dz];
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < MIN_SEGMENT_LENGTH) return null;
  return { a, b };
}

/**
 * Generate the resolved lattice for a pattern over a perimeter band.
 *
 * @param def - The kumiko pattern definition (filling hook).
 * @param band - Perimeter length and band height (mm).
 * @param targetCellSize - Desired triangle edge length before quantization (mm).
 */
export function generateKumikoLattice(
  def: KumikoPatternDef,
  band: KumikoBandConfig,
  targetCellSize: number
): KumikoLattice {
  const { perimeter: P, bandHeight: H } = band;
  const { columns, columnPitch, cellSize } = quantizeColumns(P, targetCellSize);
  const segments: KumikoSegment[] = [];
  const push = (seg: KumikoSegment): void => {
    const clipped = clipSegmentToBand(seg, P, H);
    if (clipped) segments.push(clipped);
  };

  // Vertical strut columns (u = k·pitch, full band height).
  for (let k = 0; k < columns; k++) {
    push({ a: [k * columnPitch, 0], b: [k * columnPitch, H] });
  }

  // Rising diagonals: z = c + u/√3, spaced cellSize apart in z.
  const slope = 1 / SQRT3;
  const risingMin = Math.ceil((0 - P * slope) / cellSize);
  const risingMax = Math.floor(H / cellSize);
  for (let i = risingMin; i <= risingMax; i++) {
    const c = i * cellSize;
    push({ a: [0, c], b: [P, c + P * slope] });
  }

  // Falling diagonals: z = c − u/√3.
  const fallingMin = 0;
  const fallingMax = Math.floor((H + P * slope) / cellSize);
  for (let i = fallingMin; i <= fallingMax; i++) {
    const c = i * cellSize;
    push({ a: [0, c], b: [P, c - P * slope] });
  }

  // Per-vertex fillings. Columns are duplicated one period past each side of
  // the u = 0 seam so fillings that straddle it contribute their wrapped
  // pieces; clipping to [0, P] keeps exactly one copy of every piece.
  if (def.filling) {
    for (let k = -2; k < columns + 2; k++) {
      const u = k * columnPitch;
      const stagger = (((k % 2) + 2) % 2) * (cellSize / 2);
      const rowMin = Math.floor((0 - cellSize - stagger) / cellSize);
      const rowMax = Math.ceil((H + cellSize - stagger) / cellSize);
      for (let i = rowMin; i <= rowMax; i++) {
        const z = i * cellSize + stagger;
        for (const seg of def.filling({ u, z }, cellSize, columnPitch)) {
          push(seg);
        }
      }
    }
  }

  return { segments, strutWidth: KUMIKO_STRUT_WIDTH, columnPitch, cellSize };
}
