/**
 * Fit an image→millimetre homography to a lattice of detected cells.
 *
 * This is where the accuracy comes from, and it is deliberately blind to what
 * the lattice IS. The printed calibration sheet supplies black marker squares
 * on a known ring; a Gridfinity baseplate supplies sockets on a 42mm grid whose
 * extent is only discovered here. Both reduce to the same thing: candidate
 * cells, each contributing one or more image points at known millimetre offsets
 * from its lattice node.
 *
 * The card detector solves the same map from a single quad's four corners,
 * which is the minimum a homography admits: the fit is exact by construction,
 * so any corner-localization error is absorbed silently into the map and then
 * amplified across the frame — small at the reference, several millimetres at
 * the tool. A lattice spanning the whole scanned area is over-determined
 * instead, so no single bad corner dominates and the fit can report its own
 * disagreement in millimetres.
 *
 * ## Bootstrap, then discard
 *
 * Fitting N correspondences requires knowing WHICH node each cell is, which
 * requires roughly the map being solved. So an exact four-point homography is
 * solved from the four extreme cells and used ONLY to label the rest — it needs
 * to tell a node from its neighbour, nothing finer. It is then thrown away and
 * the map re-solved by least squares over every labelled point, so the
 * bootstrap's own error never reaches the returned homography.
 */

import type { Point } from './types';
import type { CellQuad } from './latticeBlobs';
import {
  solveHomography,
  solveHomographyLeastSquares,
  applyHomography,
  homographyRmsError,
  type Homography,
  type PointPair,
} from './perspective';

export interface GridNode {
  readonly col: number;
  readonly row: number;
  /** Node centre in the reference's millimetres, origin at node (0, 0). */
  readonly x: number;
  readonly y: number;
}

/** Every node of a cols × rows lattice. */
export function fullLatticeNodes(cols: number, rows: number, pitchMm: number): GridNode[] {
  const nodes: GridNode[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      nodes.push({ col, row, x: col * pitchMm, y: row * pitchMm });
    }
  }
  return nodes;
}

/** An image point whose position relative to its lattice node is known. */
export interface LatticePoint {
  readonly image: Point;
  readonly offsetMm: Point;
}

export interface LatticeCandidate {
  /** Used to decide which node this is. Need not be one of `points`. */
  readonly center: Point;
  /** The cell's image outline, for drawing it back over the photo. */
  readonly outline: CellQuad;
  readonly points: readonly LatticePoint[];
}

export interface LatticeSpec {
  readonly cols: number;
  readonly rows: number;
  readonly pitchMm: number;
  /** Which (col, row) positions carry a cell — a ring, a full grid, anything. */
  readonly nodes: readonly GridNode[];
  readonly minCells: number;
  readonly maxRmsMm: number;
  /** How far off its node a cell centre may land, in millimetres. */
  readonly nodeSnapMm: number;
  /** How far off its declared offset a cell point may land, in millimetres. */
  readonly pointSnapMm: number;
}

export interface FittedCell {
  readonly outline: CellQuad;
  readonly node: GridNode;
}

export interface LatticeFit {
  readonly cells: readonly FittedCell[];
  /** Maps image pixels → millimetres on the reference's plane. */
  readonly homography: Homography;
  /** RMS disagreement of the least-squares fit, in millimetres. */
  readonly rmsMm: number;
}

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * The four candidates at the extremes of the image-space diagonals — the
 * lattice's corner cells, assuming the reference is photographed roughly
 * upright. A reference turned ~45° breaks that assumption and the fit declines
 * rather than guesses; a quarter turn is covered by trying the transposed
 * extent instead.
 */
function extremeCandidates(
  candidates: readonly LatticeCandidate[]
): readonly LatticeCandidate[] | null {
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

/**
 * Typical step between occupied indices along one axis.
 *
 * This is what rules out the degenerate family that makes lattice fitting
 * dangerous: every INTEGER MULTIPLE of the true lattice explains the same
 * points exactly. Fit a 4×4 socket grid against a 7×7 trial and the corners
 * pin to nodes 0 and 6, every real socket lands on an even node, and the
 * residual is zero — at twice the true scale. Nothing local catches it; the fit
 * is internally flawless and externally wrong by 100%.
 *
 * Requiring the median gap to be 1 demands the FINEST lattice consistent with
 * the data. A doubled lattice occupies every other node and reads 2. Occlusion
 * is tolerated, because a hidden column is one wide gap among many single ones.
 */
function medianGap(indices: readonly number[]): number {
  const distinct = [...new Set(indices)].sort((a, b) => a - b);
  if (distinct.length < 2) return Infinity;
  const gaps = distinct.slice(1).map((v, i) => v - distinct[i]);
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

export function fitLattice(
  candidates: readonly LatticeCandidate[],
  spec: LatticeSpec
): LatticeFit | null {
  const extremes = extremeCandidates(candidates);
  if (!extremes) return null;

  const { cols, rows, pitchMm } = spec;
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
  for (const node of spec.nodes) nodesByKey.set(`${node.col},${node.row}`, node);

  // One candidate per node, nearest wins — two blobs claiming the same node
  // means one of them isn't a cell.
  const claimed = new Map<string, { candidate: LatticeCandidate; node: GridNode; error: number }>();
  for (const candidate of candidates) {
    const p = applyHomography(bootstrap, candidate.center);
    const key = `${Math.round(p.x / pitchMm)},${Math.round(p.y / pitchMm)}`;
    const node = nodesByKey.get(key);
    if (!node) continue;
    const error = Math.hypot(p.x - node.x, p.y - node.y);
    if (error > spec.nodeSnapMm) continue;
    const prev = claimed.get(key);
    if (!prev || error < prev.error) claimed.set(key, { candidate, node, error });
  }

  const cells: FittedCell[] = [];
  const pairs: PointPair[] = [];
  for (const { candidate, node } of claimed.values()) {
    const expected = candidate.points.map((p) => ({
      x: node.x + p.offsetMm.x,
      y: node.y + p.offsetMm.y,
    }));
    // A cell's points are supplied in a fixed order, and the bootstrap keeps the
    // lattice aligned with the image, so point i belongs to offset i — but only
    // if it really is nearest offset i. Verify rather than assume: a cell whose
    // corners rotate into the wrong slots would otherwise poison the fit with
    // correspondences that are individually plausible and jointly wrong.
    let consistent = true;
    for (let i = 0; i < candidate.points.length && consistent; i++) {
      const mapped = applyHomography(bootstrap, candidate.points[i].image);
      let nearest = 0;
      let nearestDist = Infinity;
      for (let j = 0; j < expected.length; j++) {
        const d = dist(mapped, expected[j]);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = j;
        }
      }
      consistent = nearest === i && nearestDist <= spec.pointSnapMm;
    }
    if (!consistent) continue;

    cells.push({ outline: candidate.outline, node });
    candidate.points.forEach((p, i) => pairs.push({ src: p.image, dst: expected[i] }));
  }

  if (cells.length < spec.minCells) return null;

  // Cells clustered in one corner would fit beautifully and then extrapolate
  // wildly across the tool. Require them to bracket at least half the lattice.
  const colsUsed = cells.map((c) => c.node.col);
  const rowsUsed = cells.map((c) => c.node.row);
  const colSpan = Math.max(...colsUsed) - Math.min(...colsUsed);
  const rowSpan = Math.max(...rowsUsed) - Math.min(...rowsUsed);
  if (colSpan * 2 < cols - 1 || rowSpan * 2 < rows - 1) return null;
  if (medianGap(colsUsed) !== 1 || medianGap(rowsUsed) !== 1) return null;

  const homography = solveHomographyLeastSquares(pairs);
  if (!homography) return null;
  const rmsMm = homographyRmsError(homography, pairs);
  if (!(rmsMm <= spec.maxRmsMm)) return null;

  return { cells, homography, rmsMm };
}

function better(a: LatticeFit | null, b: LatticeFit | null): LatticeFit | null {
  if (!a) return b;
  if (!b) return a;
  if (a.cells.length !== b.cells.length) return a.cells.length > b.cells.length ? a : b;
  return a.rmsMm <= b.rmsMm ? a : b;
}

/**
 * Fit every plausible lattice extent and keep the best.
 *
 * The sheet knows its own extent and only needs the transposed one tried (a
 * sheet photographed sideways is the same sheet with its axes swapped). A
 * baseplate does not: how much of it is in frame is discovered here. Either way
 * a wrong extent puts the wrong pitch on an axis, so most candidates fail to
 * snap and the residual gate rejects what survives — the correct extent wins on
 * cell count, and ties break on residual.
 */
export function fitBestLattice(
  candidates: readonly LatticeCandidate[],
  extents: ReadonlyArray<readonly [number, number]>,
  makeSpec: (cols: number, rows: number) => LatticeSpec,
  /**
   * Caller's plausibility test (e.g. "are these cells socket-sized?"). Applied
   * during selection rather than to the winner, so an implausible best answer
   * cannot mask a good runner-up.
   */
  accept: (fit: LatticeFit) => boolean = () => true
): LatticeFit | null {
  let best: LatticeFit | null = null;
  for (const [cols, rows] of extents) {
    const fit = fitLattice(candidates, makeSpec(cols, rows));
    if (fit && accept(fit)) best = better(best, fit);
  }
  return best;
}
