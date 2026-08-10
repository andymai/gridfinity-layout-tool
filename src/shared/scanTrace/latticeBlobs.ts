/**
 * Find the square-ish blobs a lattice reference is made of.
 *
 * Shared by both references the scan can size from: the printed sheet's black
 * markers and a Gridfinity baseplate's sockets. They differ only in how big the
 * blobs are and which way round the contrast runs, so the scan takes both as
 * parameters and leaves every judgement about what the blobs MEAN to
 * `latticeFit`.
 *
 * Deliberately does NOT go through `buildMask`: that infers foreground polarity
 * from the image border, which flips the moment a sheet is photographed against
 * a dark table — and then the markers become holes in a bright blob rather than
 * components of their own. A lattice reference knows its own polarity, or tries
 * both.
 */

import type { Mask, Point } from './types';
import { labelComponents } from './components';
import { traceContour } from './contour';
import { contourToQuad } from './quad';

/** Four image-space corners, ordered clockwise from top-left. */
export type CellQuad = readonly [Point, Point, Point, Point];

export interface QuadBlob {
  readonly corners: CellQuad;
  readonly center: Point;
}

export interface BlobScanOptions {
  readonly minAreaFraction: number;
  readonly maxAreaFraction: number;
  readonly minQuadFitness: number;
  /** Fraction of its own quad the blob must fill — rejects rings and L shapes. */
  readonly minQuadFill: number;
  /** Loosest edge- and diagonal-length ratio a projected square may show. */
  readonly maxEdgeRatio: number;
  /** True to take blobs darker than the threshold, false for brighter. */
  readonly dark: boolean;
}

/**
 * Bound on how many blobs get traced. Reference cells are among the largest
 * inside the area band, so taking the largest N keeps every real one while
 * capping the work a noisy photo can demand — this runs on every capture,
 * reference or not.
 */
const MAX_TRACED_COMPONENTS = 120;

/**
 * Cheap bounding-box rejects, applied before anything is allocated. A square's
 * axis-aligned box stays square at any rotation, and the square fills at worst
 * half of it (at 45°); perspective shear widens both a little.
 */
const MAX_BOX_ASPECT = 1.9;
const MIN_BOX_FILL = 0.45;

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

export function quadArea(q: CellQuad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function quadCenter(q: CellQuad): Point {
  return {
    x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
    y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
  };
}

/**
 * A square stays roughly square under the moderate tilt this feature supports,
 * so wildly unequal edges or diagonals mean the blob isn't a reference cell.
 * Deliberately loose: the lattice snapping and residual checks downstream do
 * the precise work.
 */
function isSquarish(q: CellQuad, maxRatio: number): boolean {
  const edges = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])];
  const minEdge = Math.min(...edges);
  const maxEdge = Math.max(...edges);
  if (!(minEdge > 0) || maxEdge / minEdge > maxRatio) return false;
  const d1 = dist(q[0], q[2]);
  const d2 = dist(q[1], q[3]);
  const minDiag = Math.min(d1, d2);
  return minDiag > 0 && Math.max(d1, d2) / minDiag <= maxRatio;
}

interface ComponentBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function componentBoxes(labels: Int32Array, count: number, width: number): ComponentBox[] {
  const boxes: ComponentBox[] = Array.from({ length: count }, () => ({
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  }));
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (label < 0) continue;
    const box = boxes[label];
    const x = i % width;
    const y = (i - x) / width;
    if (x < box.minX) box.minX = x;
    if (x > box.maxX) box.maxX = x;
    if (y < box.minY) box.minY = y;
    if (y > box.maxY) box.maxY = y;
  }
  return boxes;
}

export function findQuadBlobs(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold: number,
  options: BlobScanOptions
): QuadBlob[] {
  const n = width * height;
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = gray[i] < threshold === options.dark ? 1 : 0;
  const labeled = labelComponents({ width, height, data });

  const minArea = options.minAreaFraction * n;
  const maxArea = options.maxAreaFraction * n;
  const boxes = componentBoxes(labeled.labels, labeled.components.length, width);
  const inBand = labeled.components
    .filter((comp) => {
      if (comp.area < minArea || comp.area > maxArea) return false;
      const box = boxes[comp.label];
      const boxW = box.maxX - box.minX + 1;
      const boxH = box.maxY - box.minY + 1;
      if (Math.max(boxW, boxH) / Math.min(boxW, boxH) > MAX_BOX_ASPECT) return false;
      return comp.area / (boxW * boxH) >= MIN_BOX_FILL;
    })
    .sort((a, b) => b.area - a.area)
    .slice(0, MAX_TRACED_COMPONENTS);

  // One scratch buffer, painted and wiped within each blob's own box, rather
  // than a fresh full-image mask per component.
  const scratch = new Uint8Array(n);
  const mask: Mask = { width, height, data: scratch };
  const paintBox = (box: ComponentBox, label: number, value: 0 | 1): void => {
    for (let y = box.minY; y <= box.maxY; y++) {
      const rowStart = y * width;
      for (let x = box.minX; x <= box.maxX; x++) {
        const i = rowStart + x;
        if (labeled.labels[i] === label) scratch[i] = value;
      }
    }
  };

  const blobs: QuadBlob[] = [];
  for (const comp of inBand) {
    const box = boxes[comp.label];
    paintBox(box, comp.label, 1);
    const contour = traceContour(mask, comp.start);
    paintBox(box, comp.label, 0);

    const quad = contourToQuad(contour);
    if (!quad || quad.fitness < options.minQuadFitness) continue;
    if (!isSquarish(quad.corners, options.maxEdgeRatio)) continue;
    const area = quadArea(quad.corners);
    if (!(area > 0) || comp.area / area < options.minQuadFill) continue;
    blobs.push({ corners: quad.corners, center: quadCenter(quad.corners) });
  }
  return blobs;
}
