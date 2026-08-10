/**
 * Detect the printable calibration sheet — the most accurate size reference the
 * scan supports.
 *
 * Its accuracy is not only that it is a lattice (a baseplate is too) but that
 * it is a lattice you can VERIFY: paper printed at 100% carries a 100mm bar you
 * can put calipers on. A 3D-printed baseplate's real pitch carries the owner's
 * own shrinkage and flow calibration, invisibly — see `baseplateDetect`.
 *
 * Detection is threshold-based and unconditional about polarity: the markers
 * are printed black, so "darker than the threshold" is always the right rule.
 * The lattice geometry and the fit itself live in `calibrationGrid` and
 * `latticeFit`.
 */

import type { ImageDataLike } from './types';
import { toGrayscale, computeOtsuThreshold } from './mask';
import { findQuadBlobs, type BlobScanOptions } from './latticeBlobs';
import {
  fitBestLattice,
  type LatticeCandidate,
  type LatticeSpec,
  type LatticeFit,
} from './latticeFit';
import {
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  CALIBRATION_MARKER_MM,
  CALIBRATION_PITCH_MM,
  calibrationNodes,
} from './calibrationGrid';

export interface GridDetectOptions {
  readonly pitchMm?: number;
  readonly markerMm?: number;
  readonly cols?: number;
  readonly rows?: number;
  /** Fewest markers that may carry a fit. Fewer than this and we decline. */
  readonly minMarkers?: number;
  /** Reject a fit whose RMS residual exceeds this, in millimetres. */
  readonly maxRmsMm?: number;
}

/**
 * Eight markers is 32 correspondences and, with the fit's own span check,
 * enough spread to bracket the tool. Below that the sheet is barely in frame
 * and another reference is the more honest answer.
 */
const MIN_MARKERS = 8;

/**
 * A correct fit on a legible sheet lands well under a millimetre. Anything
 * above this is a mis-assignment dressed up as a solution, and silently sizing
 * a tool from it is worse than falling back.
 */
const MAX_RMS_MM = 1.5;

const SCAN: BlobScanOptions = {
  minAreaFraction: 0.0004,
  maxAreaFraction: 0.05,
  minQuadFitness: 0.7,
  minQuadFill: 0.75,
  maxEdgeRatio: 1.7,
  dark: true,
};

/**
 * Second threshold pass, as a fraction of Otsu's. A dark table around a white
 * sheet pulls Otsu up between the two, at which point a shadowed corner of the
 * PAPER also reads as foreground and floods into the markers. The markers are
 * printed black, so a much lower cut still finds them and nothing else.
 */
const DARK_PASS_FRACTION = 0.55;

export function detectCalibrationGrid(
  image: ImageDataLike,
  options: GridDetectOptions = {}
): LatticeFit | null {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return null;

  const cols = options.cols ?? CALIBRATION_COLS;
  const rows = options.rows ?? CALIBRATION_ROWS;
  const pitchMm = options.pitchMm ?? CALIBRATION_PITCH_MM;
  const markerMm = options.markerMm ?? CALIBRATION_MARKER_MM;
  const half = markerMm / 2;
  const cornerOffsets: readonly { x: number; y: number }[] = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];

  const makeSpec = (specCols: number, specRows: number): LatticeSpec => ({
    cols: specCols,
    rows: specRows,
    pitchMm,
    nodes: calibrationNodes(specCols, specRows, pitchMm),
    minCells: options.minMarkers ?? MIN_MARKERS,
    maxRmsMm: options.maxRmsMm ?? MAX_RMS_MM,
    nodeSnapMm: 0.3 * pitchMm,
    pointSnapMm: 0.45 * markerMm,
  });

  // A sheet photographed sideways is the same sheet with its axes swapped.
  const extents: ReadonlyArray<readonly [number, number]> =
    cols === rows
      ? [[cols, rows]]
      : [
          [cols, rows],
          [rows, cols],
        ];

  const gray = toGrayscale(image);
  const otsu = computeOtsuThreshold(gray);

  for (const threshold of [otsu, Math.round(otsu * DARK_PASS_FRACTION)]) {
    if (threshold <= 0) continue;
    const blobs = findQuadBlobs(gray, width, height, threshold, SCAN);
    if (blobs.length < (options.minMarkers ?? MIN_MARKERS)) continue;

    const candidates: LatticeCandidate[] = blobs.map((blob) => ({
      center: blob.center,
      outline: blob.corners,
      // Every marker corner is a correspondence: four times the constraints,
      // and per-corner mask erosion averages out instead of biasing the map.
      points: blob.corners.map((corner, i) => ({ image: corner, offsetMm: cornerOffsets[i] })),
    }));

    const fit = fitBestLattice(candidates, extents, makeSpec);
    if (fit) return fit;
  }
  return null;
}
