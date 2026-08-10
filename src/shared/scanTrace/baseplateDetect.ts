/**
 * Detect a Gridfinity baseplate under the tool and size the scan from its
 * socket grid.
 *
 * The appeal is that every user of this app already owns one — nothing to
 * print, nothing to prepare. It is deliberately ranked BELOW the printed
 * calibration sheet, for a reason worth stating plainly: a 3D-printed baseplate
 * is not a length standard. Its real pitch carries the owner's own shrinkage
 * and flow calibration — the same uncalibrated process the scan exists to
 * measure around — and nothing on the part reveals the error. Paper printed at
 * 100% carries a 100mm bar you can put calipers on. So the baseplate is the
 * convenient reference and the sheet is the accurate one.
 *
 * Three things make this harder than the sheet, and one thing makes it safe:
 *
 *  - **Contrast is shading, not ink.** A baseplate is one colour; sockets read
 *    darker or lighter than their rims depending entirely on the light. So the
 *    scan sweeps both polarities and several thresholds and keeps whichever
 *    yields a consistent lattice.
 *  - **The extent is unknown.** How much of the plate is in frame is discovered
 *    by fitting every plausible extent and keeping the best.
 *  - **Sockets are rounded squares.** `contourToQuad` finds the four extreme
 *    points, which for a rounded square sit inside the true corners by the
 *    corner radius — a bias that would land straight in the pitch. Their
 *    CENTRES are unbiased by symmetry, so only centres feed the fit. One
 *    correspondence per socket instead of four, paid for by there being many.
 *  - **What makes it safe:** the fit demands eight-plus sockets snapping to a
 *    single 42mm lattice within a sub-millimetre residual, spanning half the
 *    extent, with a physically plausible socket size. A weak front end that
 *    finds nothing falls through to the card; it cannot quietly find the
 *    WRONG lattice, because noise does not arrange itself on a 42mm grid.
 */

import type { ImageDataLike } from './types';
import { toGrayscale, computeOtsuThreshold } from './mask';
import { findQuadBlobs, quadCenter, type BlobScanOptions } from './latticeBlobs';
import {
  fitBestLattice,
  fullLatticeNodes,
  type LatticeCandidate,
  type LatticeSpec,
  type LatticeFit,
} from './latticeFit';
import { applyHomography } from './perspective';
import { CALIBRATION_PITCH_MM } from './calibrationGrid';

export interface BaseplateDetectOptions {
  readonly baseplatePitchMm?: number;
  readonly minSockets?: number;
  readonly maxBaseplateRmsMm?: number;
}

/** Gridfinity's unit. The same pitch the printed sheet uses, by design. */
export const BASEPLATE_PITCH_MM = CALIBRATION_PITCH_MM;

/**
 * Eight sockets is the ring around a tool sitting in the middle of a 3×3 plate
 * — the smallest arrangement that still brackets the tool on all four sides.
 */
const MIN_SOCKETS = 8;
const MAX_RMS_MM = 1.5;

/** Plausible visible extents, in grid units. */
const MIN_EXTENT = 2;
const MAX_EXTENT = 8;

/**
 * A detected socket's width, as a fraction of the pitch, once mapped back to
 * millimetres. A real socket nearly fills its cell; the quad inscribed in its
 * rounded corners is a little smaller. Below the lower bound we locked onto
 * specks that happen to sit on a 42mm grid, and nothing can exceed the pitch.
 */
const MIN_SOCKET_FILL = 0.5;
const MAX_SOCKET_FILL = 1;

const SCAN_BASE: Omit<BlobScanOptions, 'dark'> = {
  minAreaFraction: 0.004,
  maxAreaFraction: 0.12,
  // Rounded corners pull the traced contour away from the inscribed quad's
  // edges, so a socket never scores as cleanly as a printed square.
  minQuadFitness: 0.55,
  minQuadFill: 0.7,
  maxEdgeRatio: 1.7,
};

/**
 * Otsu of the sub-population on one side of a first cut — a crude second level,
 * for when the global cut lands between the plate and the table rather than
 * within the plate. Typed subset, not a `number[]`: on a phone-sized frame the
 * boxed-array version costs tens of megabytes for the same answer.
 */
function otsuWithin(gray: Uint8Array, cut: number, below: boolean): number | null {
  let count = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < cut === below) count++;
  }
  if (count < gray.length * 0.02) return null;
  const subset = new Uint8Array(count);
  let at = 0;
  for (let i = 0; i < gray.length; i++) {
    if (gray[i] < cut === below) subset[at++] = gray[i];
  }
  return computeOtsuThreshold(subset);
}

interface Pass {
  readonly threshold: number;
  readonly dark: boolean;
}

/**
 * Sockets read darker than their rims under overhead light and brighter when
 * the rims catch a highlight, so both polarities are on the table. Ordered by
 * how often each wins, and lazy: the second-level thresholds cost a full pass
 * over the image each, and this runs on every capture without a sheet.
 */
function* passes(gray: Uint8Array): Generator<Pass> {
  const otsu = computeOtsuThreshold(gray);
  if (otsu <= 0 || otsu >= 255) return;
  yield { threshold: otsu, dark: true };
  yield { threshold: otsu, dark: false };

  const lower = otsuWithin(gray, otsu, true);
  if (lower !== null && lower > 0) yield { threshold: lower, dark: true };
  const upper = otsuWithin(gray, otsu, false);
  if (upper !== null && upper < 255) yield { threshold: upper, dark: false };
}

/** Extents worth trying, coarsest constraint first: a lattice must hold the cells. */
function extents(minCells: number): Array<readonly [number, number]> {
  const list: Array<readonly [number, number]> = [];
  for (let cols = MIN_EXTENT; cols <= MAX_EXTENT; cols++) {
    for (let rows = MIN_EXTENT; rows <= MAX_EXTENT; rows++) {
      if (cols * rows >= minCells) list.push([cols, rows]);
    }
  }
  return list;
}

/** Median width of the fitted sockets, in millimetres. */
function medianSocketWidthMm(fit: LatticeFit): number {
  const widths = fit.cells
    .map((cell) => {
      const mm = cell.outline.map((p) => applyHomography(fit.homography, p));
      const edges = [0, 1, 2, 3].map((i) => {
        const a = mm[i];
        const b = mm[(i + 1) % 4];
        return Math.hypot(a.x - b.x, a.y - b.y);
      });
      return edges.reduce((s, e) => s + e, 0) / 4;
    })
    .sort((a, b) => a - b);
  return widths[Math.floor(widths.length / 2)];
}

export function detectBaseplateGrid(
  image: ImageDataLike,
  options: BaseplateDetectOptions = {}
): LatticeFit | null {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return null;

  const pitchMm = options.baseplatePitchMm ?? BASEPLATE_PITCH_MM;
  const minCells = options.minSockets ?? MIN_SOCKETS;
  const maxRmsMm = options.maxBaseplateRmsMm ?? MAX_RMS_MM;

  const makeSpec = (cols: number, rows: number): LatticeSpec => ({
    cols,
    rows,
    pitchMm,
    nodes: fullLatticeNodes(cols, rows, pitchMm),
    minCells,
    maxRmsMm,
    nodeSnapMm: 0.25 * pitchMm,
    // Only the centre is supplied, so this is the same tolerance as the node
    // snap — kept explicit so it does not silently change with the node rule.
    pointSnapMm: 0.25 * pitchMm,
  });

  const gray = toGrayscale(image);
  const tryExtents = extents(minCells);

  for (const pass of passes(gray)) {
    const blobs = findQuadBlobs(gray, width, height, pass.threshold, {
      ...SCAN_BASE,
      dark: pass.dark,
    });
    if (blobs.length < minCells) continue;

    const candidates: LatticeCandidate[] = blobs.map((blob) => ({
      center: blob.center,
      outline: blob.corners,
      points: [{ image: quadCenter(blob.corners), offsetMm: { x: 0, y: 0 } }],
    }));

    // A lattice alone is not enough — the cells have to be socket-sized for the
    // pitch they claim, or we locked onto something that is merely regular.
    const fit = fitBestLattice(candidates, tryExtents, makeSpec, (candidate) => {
      const socketMm = medianSocketWidthMm(candidate);
      return socketMm >= MIN_SOCKET_FILL * pitchMm && socketMm <= MAX_SOCKET_FILL * pitchMm;
    });
    if (fit) return fit;
  }
  return null;
}
