/**
 * Detect the printable calibration sheet in a photo and derive an
 * over-constrained image→mm homography from it.
 *
 * The card detector solves the same map from a single quad's four corners,
 * which is the minimum a homography admits: the fit is exact by construction,
 * so any corner-localization error is absorbed silently into the map and then
 * amplified across the frame — small at the reference, several millimetres at
 * the tool. The sheet replaces that with ~18 markers spanning the whole scanned
 * area, fitted by least squares, so no single bad corner dominates and the fit
 * reports its own disagreement in millimetres.
 *
 * Lightweight by design — no OpenCV. Sheet geometry lives in `calibrationGrid`.
 */

import type { ImageDataLike, Mask, Point } from './types';
import { toGrayscale, computeOtsuThreshold } from './mask';
import { labelComponents } from './components';
import { traceContour } from './contour';
import { contourToQuad } from './quad';
import {
  solveHomography,
  solveHomographyLeastSquares,
  applyHomography,
  homographyRmsError,
  type Homography,
  type PointPair,
} from './perspective';
import {
  CALIBRATION_COLS,
  CALIBRATION_ROWS,
  CALIBRATION_MARKER_MM,
  CALIBRATION_PITCH_MM,
  calibrationNodes,
  type GridNode,
} from './calibrationGrid';

/** A marker's image corners, ordered clockwise from top-left. */
export type MarkerQuad = readonly [Point, Point, Point, Point];

export interface GridMarker {
  readonly corners: MarkerQuad;
  readonly node: GridNode;
}

export interface GridDetection {
  readonly markers: readonly GridMarker[];
  /** Maps image pixels → millimetres on the sheet's plane. */
  readonly homography: Homography;
  /** RMS disagreement of the least-squares fit, in millimetres. */
  readonly rmsMm: number;
}

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
 * Eight markers is 32 correspondences and, with the span check below, enough
 * spread to bracket the tool. Below that the sheet is barely in frame and the
 * card path is the more honest answer.
 */
const MIN_MARKERS = 8;

/**
 * A correct fit on a legible sheet lands well under a millimetre. Anything
 * above this is a mis-assignment (or the wrong lattice orientation) dressed up
 * as a solution, and silently sizing a tool from it is worse than falling back
 * to the card.
 */
const MAX_RMS_MM = 1.5;

const MIN_QUAD_FITNESS = 0.7;
/** Fraction of its own quad a marker's blob must fill — rejects ring/L shapes. */
const MIN_QUAD_FILL = 0.75;
/** Loosest edge- and diagonal-length ratio a projected square may show. */
const MAX_EDGE_RATIO = 1.7;
/** How far off its lattice node a marker centre may land, as a fraction of pitch. */
const NODE_SNAP_FRACTION = 0.3;
/** How far off its expected slot a marker corner may land, as a fraction of marker size. */
const CORNER_SNAP_FRACTION = 0.45;

const MIN_MARKER_AREA_FRACTION = 0.0004;
const MAX_MARKER_AREA_FRACTION = 0.05;

/**
 * Bound on how many blobs get traced. Markers are among the largest inside the
 * area band, so taking the largest N keeps every real marker while capping the
 * work a noisy photo can demand — this runs on every capture, sheet or not.
 */
const MAX_TRACED_COMPONENTS = 120;

/**
 * Cheap bounding-box rejects, applied before anything is allocated. A square's
 * axis-aligned box stays square at any rotation, and the square fills at worst
 * half of it (at 45°); perspective shear widens both a little.
 */
const MAX_BOX_ASPECT = 1.9;
const MIN_BOX_FILL = 0.48;

/**
 * Second threshold pass, as a fraction of Otsu's. A dark table around a white
 * sheet pulls Otsu up between the two, at which point a shadowed corner of the
 * PAPER also reads as foreground and floods into the markers. The markers are
 * printed black, so a much lower cut still finds them and nothing else.
 */
const DARK_PASS_FRACTION = 0.55;

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

function quadArea(q: MarkerQuad): number {
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    const a = q[i];
    const b = q[(i + 1) % 4];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

function quadCenter(q: MarkerQuad): Point {
  return {
    x: (q[0].x + q[1].x + q[2].x + q[3].x) / 4,
    y: (q[0].y + q[1].y + q[2].y + q[3].y) / 4,
  };
}

/**
 * A square stays roughly square under the moderate tilt this feature supports,
 * so wildly unequal edges or diagonals mean the blob isn't a marker. Deliberately
 * loose: the node-snapping and residual checks downstream do the precise work.
 */
function isSquarish(q: MarkerQuad): boolean {
  const edges = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])];
  const minEdge = Math.min(...edges);
  const maxEdge = Math.max(...edges);
  if (!(minEdge > 0) || maxEdge / minEdge > MAX_EDGE_RATIO) return false;
  const d1 = dist(q[0], q[2]);
  const d2 = dist(q[1], q[3]);
  const minDiag = Math.min(d1, d2);
  return minDiag > 0 && Math.max(d1, d2) / minDiag <= MAX_EDGE_RATIO;
}

interface Candidate {
  readonly corners: MarkerQuad;
  readonly center: Point;
}

/**
 * Every blob that could be a printed marker.
 *
 * Deliberately does NOT go through `buildMask`: that infers foreground polarity
 * from the image border, which flips the moment the sheet is photographed
 * against a dark table — and then the markers become holes in a bright blob
 * rather than components of their own. Markers are printed black on white, so
 * "darker than the threshold" is the correct rule unconditionally.
 */
function markerCandidates(
  gray: Uint8Array,
  width: number,
  height: number,
  threshold: number
): Candidate[] {
  const n = width * height;
  const data = new Uint8Array(n);
  for (let i = 0; i < n; i++) data[i] = gray[i] < threshold ? 1 : 0;
  const labeled = labelComponents({ width, height, data });

  const minArea = MIN_MARKER_AREA_FRACTION * n;
  const maxArea = MAX_MARKER_AREA_FRACTION * n;
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

  const candidates: Candidate[] = [];
  for (const comp of inBand) {
    const box = boxes[comp.label];
    paintBox(box, comp.label, 1);
    const contour = traceContour(mask, comp.start);
    paintBox(box, comp.label, 0);

    const quad = contourToQuad(contour);
    if (!quad || quad.fitness < MIN_QUAD_FITNESS) continue;
    if (!isSquarish(quad.corners)) continue;
    const area = quadArea(quad.corners);
    if (!(area > 0) || comp.area / area < MIN_QUAD_FILL) continue;
    candidates.push({ corners: quad.corners, center: quadCenter(quad.corners) });
  }
  return candidates;
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

/**
 * The four candidates at the extremes of the image-space diagonals — the
 * lattice's corner markers, assuming the sheet is photographed roughly upright.
 * A sheet turned ~45° breaks that assumption and detection declines rather than
 * guesses; a quarter turn is covered by the transposed-lattice sweep instead.
 */
function extremeCandidates(candidates: readonly Candidate[]): readonly Candidate[] | null {
  if (candidates.length < 4) return null;
  let tl = candidates[0];
  let tr = candidates[0];
  let br = candidates[0];
  let bl = candidates[0];
  for (const c of candidates) {
    const sum = c.center.x + c.center.y;
    const diff = c.center.x - c.center.y;
    if (sum < tl.center.x + tl.center.y) tl = c;
    if (sum > br.center.x + br.center.y) br = c;
    if (diff > tr.center.x - tr.center.y) tr = c;
    if (diff < bl.center.x - bl.center.y) bl = c;
  }
  const picked = [tl, tr, br, bl];
  return new Set(picked).size === 4 ? picked : null;
}

interface LatticeSpec {
  readonly cols: number;
  readonly rows: number;
  readonly pitchMm: number;
  readonly markerMm: number;
  readonly minMarkers: number;
  readonly maxRmsMm: number;
}

/**
 * Fit one candidate lattice orientation.
 *
 * Bootstrap from the four extreme markers (an exact four-point solve, good to
 * a couple of millimetres), use it only to decide WHICH lattice node each
 * marker is, then throw it away and re-solve over every assigned corner by
 * least squares. The bootstrap's own error never reaches the returned map.
 */
function fitLattice(candidates: readonly Candidate[], spec: LatticeSpec): GridDetection | null {
  const extremes = extremeCandidates(candidates);
  if (!extremes) return null;

  const { cols, rows, pitchMm, markerMm } = spec;
  const spanX = (cols - 1) * pitchMm;
  const spanY = (rows - 1) * pitchMm;
  const bootstrap = solveHomography(
    [extremes[0].center, extremes[1].center, extremes[2].center, extremes[3].center],
    [
      { x: 0, y: 0 },
      { x: spanX, y: 0 },
      { x: spanX, y: spanY },
      { x: 0, y: spanY },
    ]
  );
  if (!bootstrap) return null;

  const nodesByKey = new Map<string, GridNode>();
  for (const node of calibrationNodes(cols, rows, pitchMm)) {
    nodesByKey.set(`${node.col},${node.row}`, node);
  }

  // One candidate per node, nearest wins — two blobs claiming the same node
  // means one of them isn't a marker.
  const snapLimit = NODE_SNAP_FRACTION * pitchMm;
  const claimed = new Map<string, { candidate: Candidate; node: GridNode; error: number }>();
  for (const candidate of candidates) {
    const p = applyHomography(bootstrap, candidate.center);
    const key = `${Math.round(p.x / pitchMm)},${Math.round(p.y / pitchMm)}`;
    const node = nodesByKey.get(key);
    if (!node) continue;
    const error = Math.hypot(p.x - node.x, p.y - node.y);
    if (error > snapLimit) continue;
    const prev = claimed.get(key);
    if (!prev || error < prev.error) claimed.set(key, { candidate, node, error });
  }

  const half = markerMm / 2;
  const offsets: readonly Point[] = [
    { x: -half, y: -half },
    { x: half, y: -half },
    { x: half, y: half },
    { x: -half, y: half },
  ];
  const cornerLimit = CORNER_SNAP_FRACTION * markerMm;

  const markers: GridMarker[] = [];
  const pairs: PointPair[] = [];
  for (const { candidate, node } of claimed.values()) {
    const expected = offsets.map((o) => ({ x: node.x + o.x, y: node.y + o.y }));
    // `contourToQuad` orders corners by image position and the bootstrap keeps
    // the lattice axis-aligned with the image, so corner i is slot i — but only
    // if it really is nearest slot i. Verify rather than assume: a marker whose
    // corners rotate into the wrong slots would otherwise poison the fit with
    // four correspondences that are individually plausible and jointly wrong.
    let consistent = true;
    for (let i = 0; i < 4 && consistent; i++) {
      const mapped = applyHomography(bootstrap, candidate.corners[i]);
      let nearest = 0;
      let nearestDist = Infinity;
      for (let j = 0; j < 4; j++) {
        const d = dist(mapped, expected[j]);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = j;
        }
      }
      consistent = nearest === i && nearestDist <= cornerLimit;
    }
    if (!consistent) continue;

    markers.push({ corners: candidate.corners, node });
    for (let i = 0; i < 4; i++) pairs.push({ src: candidate.corners[i], dst: expected[i] });
  }

  if (markers.length < spec.minMarkers) return null;

  // Markers clustered in one corner would fit beautifully and then extrapolate
  // wildly across the tool. Require them to bracket at least half the sheet.
  const colsUsed = markers.map((m) => m.node.col);
  const rowsUsed = markers.map((m) => m.node.row);
  const colSpan = Math.max(...colsUsed) - Math.min(...colsUsed);
  const rowSpan = Math.max(...rowsUsed) - Math.min(...rowsUsed);
  if (colSpan * 2 < cols - 1 || rowSpan * 2 < rows - 1) return null;

  const homography = solveHomographyLeastSquares(pairs);
  if (!homography) return null;
  const rmsMm = homographyRmsError(homography, pairs);
  if (!(rmsMm <= spec.maxRmsMm)) return null;

  return { markers, homography, rmsMm };
}

function better(a: GridDetection | null, b: GridDetection | null): GridDetection | null {
  if (!a) return b;
  if (!b) return a;
  if (a.markers.length !== b.markers.length) {
    return a.markers.length > b.markers.length ? a : b;
  }
  return a.rmsMm <= b.rmsMm ? a : b;
}

export function detectCalibrationGrid(
  image: ImageDataLike,
  options: GridDetectOptions = {}
): GridDetection | null {
  const { width, height } = image;
  if (width <= 0 || height <= 0) return null;

  const cols = options.cols ?? CALIBRATION_COLS;
  const rows = options.rows ?? CALIBRATION_ROWS;
  const spec: LatticeSpec = {
    cols,
    rows,
    pitchMm: options.pitchMm ?? CALIBRATION_PITCH_MM,
    markerMm: options.markerMm ?? CALIBRATION_MARKER_MM,
    minMarkers: options.minMarkers ?? MIN_MARKERS,
    maxRmsMm: options.maxRmsMm ?? MAX_RMS_MM,
  };

  const gray = toGrayscale(image);
  const otsu = computeOtsuThreshold(gray);
  const thresholds = [otsu, Math.round(otsu * DARK_PASS_FRACTION)];

  for (const threshold of thresholds) {
    if (threshold <= 0) continue;
    const candidates = markerCandidates(gray, width, height, threshold);
    if (candidates.length < spec.minMarkers) continue;

    const upright = fitLattice(candidates, spec);
    // A sheet photographed sideways is the same sheet with its axes swapped;
    // the wrong choice puts the wrong pitch on each axis and fails the residual
    // gate, so trying both and keeping the better one is unambiguous.
    const sideways =
      cols === rows ? null : fitLattice(candidates, { ...spec, cols: rows, rows: cols });
    const best = better(upright, sideways);
    if (best) return best;
  }
  return null;
}
