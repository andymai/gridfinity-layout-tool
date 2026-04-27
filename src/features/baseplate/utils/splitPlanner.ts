/**
 * Baseplate split planner — pure functions for computing how a large baseplate
 * should be tiled into printable pieces.
 *
 * The algorithm jointly optimizes both axes to minimize total piece count.
 * For each candidate (numCols × numRows) it verifies every piece fits the bed
 * with its edge-specific padding, then picks the tiling with fewest pieces.
 * Ties are broken by symmetry (prefer equal-sized pieces).
 *
 * Fractional half-unit edges are absorbed into the outermost piece when they
 * fit, otherwise become a separate piece.
 */

import type { BaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece, BaseplateTiling, PaddingReductionHint } from '../types/tiling';

/** Threshold for detecting a fractional half-unit (avoids floating-point noise). */
const FRACTIONAL_THRESHOLD = 0.49;

/**
 * How far the dovetail tongue protrudes past the slab wall on a join edge.
 * Mirrors `TONGUE_PROTRUSION` in `features/generation/.../generatorConstants.ts`
 * (cross-feature import is forbidden by module boundaries; keep these in sync).
 *
 * The fit checker must subtract this from the bed budget on any join edge whose
 * tongue is male — otherwise pieces that compute to exactly the bed width on
 * paper exceed it as STLs (#1498).
 */
const TONGUE_PROTRUSION_MM = 1.5;

/**
 * Per-axis configuration: bed budget, padding, and dovetail overhang on each end.
 *
 * `startMaleMm` / `endMaleMm` are the mm reserved for a male tongue when that
 * side is a join edge. Convention (matches `buildConnectors` in baseplateGenerator):
 *   left/front are male when invertDovetails=false; right/back are male otherwise.
 * Females cut into the slab and don't extend its bbox, so they cost nothing.
 */
interface AxisConfig {
  readonly bedMm: number;
  readonly paddingStart: number;
  readonly paddingEnd: number;
  readonly startMaleMm: number;
  readonly endMaleMm: number;
}

function makeAxisConfig(
  bedMm: number,
  paddingStart: number,
  paddingEnd: number,
  connectorNubs: boolean | undefined,
  invertDovetails: boolean | undefined
): AxisConfig {
  // Both axes follow the same rule: the start side (left / front) is male iff !invertDovetails.
  const tongue = connectorNubs ? TONGUE_PROTRUSION_MM : 0;
  const startMale = !invertDovetails;
  return {
    bedMm,
    paddingStart,
    paddingEnd,
    startMaleMm: startMale ? tongue : 0,
    endMaleMm: startMale ? 0 : tongue,
  };
}

/**
 * Per-position max grid-unit capacity for a multi-chunk axis.
 * Multi-piece pieces give up bed-budget on each join edge whose tongue is male.
 * Middle chunks have both sides joined, but exactly one is male regardless of
 * invert orientation, so this collapses to a single TONGUE_PROTRUSION.
 */
function axisCapacity(
  gridUnitMm: number,
  axis: AxisConfig
): { maxFirst: number; maxLast: number; maxMiddle: number } {
  const { bedMm, paddingStart, paddingEnd, startMaleMm, endMaleMm } = axis;
  return {
    maxFirst: Math.floor((bedMm - paddingStart - endMaleMm) / gridUnitMm),
    maxLast: Math.floor((bedMm - paddingEnd - startMaleMm) / gridUnitMm),
    maxMiddle: Math.floor((bedMm - startMaleMm - endMaleMm) / gridUnitMm),
  };
}

/** Convert a zero-based column index to a letter: 0→A, 1→B, ..., 25→Z */
export function colToLetter(col: number): string {
  return String.fromCharCode(65 + col);
}

/**
 * Partition `totalUnits` into exactly `numChunks` pieces that each fit the bed.
 *
 * Position-aware padding: first chunk carries `paddingStart`, last carries
 * `paddingEnd`, middle chunks use the full bed. A single chunk carries both.
 *
 * Distributes units as equally as possible (minimizing variance) to support
 * the symmetry tiebreaker. Returns null if the partition is infeasible.
 */
function partitionAxis(
  totalUnits: number,
  numChunks: number,
  gridUnitMm: number,
  axis: AxisConfig
): number[] | null {
  const { bedMm, paddingStart, paddingEnd, startMaleMm } = axis;
  const intPart = Math.floor(totalUnits);
  const hasFrac = totalUnits - intPart >= FRACTIONAL_THRESHOLD;

  // Single-piece (numChunks=1) has no joins, so no tongue overhead.
  const maxWithBoth = Math.floor((bedMm - paddingStart - paddingEnd) / gridUnitMm);
  const { maxFirst, maxLast, maxMiddle } = axisCapacity(gridUnitMm, axis);

  // Degenerate: bed can't hold even 1 unit in any position
  if (maxWithBoth < 1 || maxFirst < 1 || maxLast < 1 || maxMiddle < 1) {
    return numChunks === 1 ? [totalUnits] : null;
  }

  if (numChunks === 1) {
    if (intPart > maxWithBoth) return null;
    if (hasFrac) {
      if ((intPart + 0.5) * gridUnitMm + paddingStart + paddingEnd <= bedMm) {
        return [totalUnits];
      }
      return null;
    }
    return intPart > 0 ? [intPart] : null;
  }

  // For numChunks >= 2, distribute integer units as evenly as possible.
  const maxPerPos: number[] = Array.from({ length: numChunks }, (_, i) => {
    if (i === 0) return maxFirst;
    if (i === numChunks - 1) return maxLast;
    return maxMiddle;
  });

  // Total capacity check — bail early if the partition is impossible.
  const totalCapacity = maxPerPos.reduce((a, b) => a + b, 0);
  if (totalCapacity < intPart) return null;

  // Pass 1: distribute evenly — floor(intPart / numChunks) per chunk, with
  // the remainder distributed one unit at a time from the first chunk onward.
  // Clamp each chunk to its position cap; any overflow is deferred to pass 2.
  const baseSize = Math.floor(intPart / numChunks);
  const sizes: number[] = new Array<number>(numChunks).fill(baseSize);
  let remainder = intPart - baseSize * numChunks;

  for (let i = 0; i < numChunks; i++) {
    if (sizes[i] > maxPerPos[i]) {
      remainder += sizes[i] - maxPerPos[i];
      sizes[i] = maxPerPos[i];
    }
  }

  for (let i = 0; i < numChunks && remainder > 0; i++) {
    const canAdd = maxPerPos[i] - sizes[i];
    if (canAdd > 0) {
      const add = Math.min(1, canAdd);
      sizes[i] += add;
      remainder--;
    }
  }

  // Pass 2: redistribute any remaining units into slots that still have capacity.
  for (let i = 0; i < numChunks && remainder > 0; i++) {
    const canAdd = maxPerPos[i] - sizes[i];
    const add = Math.min(canAdd, remainder);
    sizes[i] += add;
    remainder -= add;
  }

  if (remainder > 0) return null;
  if (sizes.some((s) => s <= 0)) return null;

  // Handle fractional 0.5 unit — absorb into last chunk if it fits
  if (hasFrac) {
    const lastIdx = numChunks - 1;
    const lastOverhead = paddingEnd + startMaleMm;
    if ((sizes[lastIdx] + 0.5) * gridUnitMm + lastOverhead <= bedMm) {
      sizes[lastIdx] += 0.5;
    } else {
      return null;
    }
  }

  return sizes;
}

/**
 * Verify every piece fits the bed. Each piece's physical width depends only
 * on its column index and depth on its row index, so the two axes are
 * independent — checking each axis separately is sufficient.
 */
function allPiecesFit(
  colSizes: number[],
  rowSizes: number[],
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): boolean {
  return chunkSizesFit(colSizes, gridUnitMm, xAxis) && chunkSizesFit(rowSizes, gridUnitMm, yAxis);
}

function chunkSizesFit(sizes: number[], gridUnitMm: number, axis: AxisConfig): boolean {
  const last = sizes.length - 1;
  for (let i = 0; i < sizes.length; i++) {
    const padStart = i === 0 ? axis.paddingStart : 0;
    const padEnd = i === last ? axis.paddingEnd : 0;
    // Join edges (interior sides) carry a male tongue's protrusion if the convention
    // assigns male to that side. Female sides cut into the slab and add nothing.
    const tongueStart = i === 0 ? 0 : axis.startMaleMm;
    const tongueEnd = i === last ? 0 : axis.endMaleMm;
    const sizeMm = sizes[i] * gridUnitMm + padStart + padEnd + tongueStart + tongueEnd;
    if (sizeMm > axis.bedMm + 0.001) return false;
  }
  return true;
}

/** Variance of an array — lower = more symmetric/equal. */
function symmetryScore(sizes: number[]): number {
  if (sizes.length <= 1) return 0;
  const mean = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  return sizes.reduce((sum, s) => sum + (s - mean) ** 2, 0) / sizes.length;
}

interface TilingCandidate {
  colSizes: number[];
  rowSizes: number[];
  pieceCount: number;
  score: number;
}

/**
 * Find the optimal grid tiling: minimum pieces where every piece fits the bed.
 *
 * Searches over (numCols, numRows) pairs, partitioning each axis as evenly as
 * possible. Returns the best (colSizes, rowSizes) or a single-piece fallback.
 */
function findOptimalTiling(
  totalWidth: number,
  totalDepth: number,
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig
): { colSizes: number[]; rowSizes: number[] } {
  const maxCols = Math.ceil(totalWidth);
  const maxRows = Math.ceil(totalDepth);

  let best: TilingCandidate | null = null;

  for (let nc = 1; nc <= maxCols; nc++) {
    // Early exit: nc alone exceeds best piece count (nc * 1 > best).
    // Use > not >= so we still evaluate nc×1 candidates for symmetry tiebreaks.
    if (best && nc > best.pieceCount) break;

    const colSizes = partitionAxis(totalWidth, nc, gridUnitMm, xAxis);
    if (!colSizes) continue;

    for (let nr = 1; nr <= maxRows; nr++) {
      const pieceCount = nc * nr;
      if (best && pieceCount > best.pieceCount) break;

      const rowSizes = partitionAxis(totalDepth, nr, gridUnitMm, yAxis);
      if (!rowSizes) continue;

      if (allPiecesFit(colSizes, rowSizes, gridUnitMm, xAxis, yAxis)) {
        const score = symmetryScore(colSizes) + symmetryScore(rowSizes);
        if (
          !best ||
          pieceCount < best.pieceCount ||
          (pieceCount === best.pieceCount && score < best.score)
        ) {
          best = { colSizes, rowSizes, pieceCount, score };
        }
        break;
      }
    }
  }

  if (!best) return { colSizes: [totalWidth], rowSizes: [totalDepth] };
  return { colSizes: best.colSizes, rowSizes: best.rowSizes };
}

/**
 * Check if reducing padding would eliminate a split or save pieces.
 * Tries X-only, Y-only, then both axes together; picks the best result.
 */
function computePaddingReductionHint(
  totalWidth: number,
  totalDepth: number,
  gridUnitMm: number,
  xAxis: AxisConfig,
  yAxis: AxisConfig,
  currentPieceCount: number
): PaddingReductionHint | null {
  if (currentPieceCount <= 1) return null;

  const reduceX = Math.min(xAxis.paddingStart, xAxis.paddingEnd);
  const reduceY = Math.min(yAxis.paddingStart, yAxis.paddingEnd);

  // Find smallest reduction along an axis that saves pieces; null if none works.
  const trySaving = (maxR: number, build: (r: number) => { x: AxisConfig; y: AxisConfig }) => {
    for (let r = 1; r <= maxR; r++) {
      const { x, y } = build(r);
      const result = findOptimalTiling(totalWidth, totalDepth, gridUnitMm, x, y);
      const saved = currentPieceCount - result.colSizes.length * result.rowSizes.length;
      if (saved > 0) return { reductionMm: r, piecesSaved: saved };
    }
    return null;
  };

  const reduce = (axis: AxisConfig, r: number): AxisConfig => ({
    ...axis,
    paddingStart: axis.paddingStart - r,
    paddingEnd: axis.paddingEnd - r,
  });

  const candidates: PaddingReductionHint[] = [];
  const x = trySaving(reduceX, (r) => ({ x: reduce(xAxis, r), y: yAxis }));
  if (x) candidates.push({ axis: 'x', ...x });
  const y = trySaving(reduceY, (r) => ({ x: xAxis, y: reduce(yAxis, r) }));
  if (y) candidates.push({ axis: 'y', ...y });
  const both = trySaving(Math.min(reduceX, reduceY), (r) => ({
    x: reduce(xAxis, r),
    y: reduce(yAxis, r),
  }));
  if (both) candidates.push({ axis: 'both', ...both });

  if (candidates.length === 0) return null;

  // Pick best: most pieces saved, then smallest reduction
  candidates.sort((a, b) => b.piecesSaved - a.piecesSaved || a.reductionMm - b.reductionMm);
  return candidates[0];
}

/**
 * Compute the full 2D tiling for a baseplate.
 *
 * Takes the full generation params + print bed size and returns a tiling plan.
 * If the baseplate fits on a single bed, returns a single-piece tiling with
 * `isSplit: false`.
 */
export function computeBaseplateTiling(
  params: BaseplateParams,
  printBedWidthMm: number,
  printBedDepthMm: number = printBedWidthMm
): BaseplateTiling {
  const {
    width,
    depth,
    gridUnitMm,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    connectorNubs,
    invertDovetails,
  } = params;

  // Pieces with dovetail connectors include male tongue protrusions in their bbox
  // (#1498). The planner reserves bed budget for those tongues so the resulting
  // STLs actually fit the bed.
  const xAxis = makeAxisConfig(
    printBedWidthMm,
    paddingLeft,
    paddingRight,
    connectorNubs,
    invertDovetails
  );
  const yAxis = makeAxisConfig(
    printBedDepthMm,
    paddingFront,
    paddingBack,
    connectorNubs,
    invertDovetails
  );

  const { colSizes: rawColSizes, rowSizes: rawRowSizes } = findOptimalTiling(
    width,
    depth,
    gridUnitMm,
    xAxis,
    yAxis
  );

  // Reorder for display: largest pieces at front/left, fractional edges pinned
  const colSizes = reorderForDisplay(rawColSizes, gridUnitMm, xAxis, fractionalEdgeX === 'start');
  const rowSizes = reorderForDisplay(rawRowSizes, gridUnitMm, yAxis, fractionalEdgeY === 'start');

  const isSplit = colSizes.length > 1 || rowSizes.length > 1;
  const colOffsets = cumulativeOffsets(colSizes);
  const rowOffsets = cumulativeOffsets(rowSizes);

  const lastCol = colSizes.length - 1;
  const lastRow = rowSizes.length - 1;

  const pieces: BaseplatePiece[] = [];

  for (let r = 0; r < rowSizes.length; r++) {
    for (let c = 0; c < colSizes.length; c++) {
      const isLeftEdge = c === 0;
      const isRightEdge = c === lastCol;
      const isFrontEdge = r === 0;
      const isBackEdge = r === lastRow;

      pieces.push({
        label: `${colToLetter(c)}${r + 1}`,
        col: c,
        row: r,
        widthUnits: colSizes[c],
        depthUnits: rowSizes[r],
        gridOffsetX: colOffsets[c],
        gridOffsetY: rowOffsets[r],
        paddingLeft: isLeftEdge ? paddingLeft : 0,
        paddingRight: isRightEdge ? paddingRight : 0,
        paddingFront: isFrontEdge ? paddingFront : 0,
        paddingBack: isBackEdge ? paddingBack : 0,
        fractionalEdgeX: isFractional(colSizes[c]) ? fractionalEdgeX : 'none',
        fractionalEdgeY: isFractional(rowSizes[r]) ? fractionalEdgeY : 'none',
        edges: {
          left: isLeftEdge ? 'exterior' : 'join',
          right: isRightEdge ? 'exterior' : 'join',
          front: isFrontEdge ? 'exterior' : 'join',
          back: isBackEdge ? 'exterior' : 'join',
        },
      });
    }
  }

  const pieceCount = colSizes.length * rowSizes.length;
  const paddingReductionHint = computePaddingReductionHint(
    width,
    depth,
    gridUnitMm,
    xAxis,
    yAxis,
    pieceCount
  );

  return {
    isSplit,
    pieces,
    cols: colSizes.length,
    rows: rowSizes.length,
    totalWidthUnits: width,
    totalDepthUnits: depth,
    stackCount: 1,
    stackSeparatorThickness: 0,
    paddingReductionHint,
  };
}

/**
 * Convert a tiling piece into full baseplate generation params.
 *
 * Inherits magnet and grid settings from the parent params,
 * but overrides dimensions and padding for this specific piece.
 */
export function pieceToBaseplateParams(
  piece: BaseplatePiece,
  parentParams: BaseplateParams
): BaseplateParams {
  // Determine fractional edge — if this piece has no fraction, default to 'end'
  const fractionalEdgeX = piece.fractionalEdgeX === 'none' ? 'end' : piece.fractionalEdgeX;
  const fractionalEdgeY = piece.fractionalEdgeY === 'none' ? 'end' : piece.fractionalEdgeY;

  return {
    width: piece.widthUnits,
    depth: piece.depthUnits,
    gridUnitMm: parentParams.gridUnitMm,
    magnetHoles: parentParams.magnetHoles,
    magnetDiameter: parentParams.magnetDiameter,
    magnetDepth: parentParams.magnetDepth,
    paddingLeft: piece.paddingLeft,
    paddingRight: piece.paddingRight,
    paddingFront: piece.paddingFront,
    paddingBack: piece.paddingBack,
    fractionalEdgeX,
    fractionalEdgeY,
    edges: piece.edges,
    connectorNubs: parentParams.connectorNubs,
    invertDovetails: parentParams.invertDovetails,
    lightweight: parentParams.lightweight,
    cornerRadius: parentParams.cornerRadius,
    cornerRadii: parentParams.cornerRadii,
  };
}

/**
 * Reorder sizes for display: largest pieces at lowest indices (front/left),
 * while respecting edge constraints and fractional edge placement.
 *
 * When `fractionAtStart` is true and a fractional piece exists, it is pinned to
 * position 0 with the remaining pieces sorted descending.
 */
function reorderForDisplay(
  sizes: number[],
  gridUnitMm: number,
  axis: AxisConfig,
  fractionAtStart: boolean
): number[] {
  if (sizes.length <= 1) return sizes;

  // Use the same per-position constraints as partitionAxis so dovetail tongues
  // are accounted for when reshuffling chunks across positions (#1498).
  const { maxFirst, maxLast, maxMiddle } = axisCapacity(gridUnitMm, axis);
  const fracIdx = sizes.findIndex(isFractional);

  // Pin fractional piece to position 0 (only if it fits there).
  if (fractionAtStart && fracIdx >= 0 && sizes[fracIdx] <= maxFirst) {
    const rest = sizes.filter((_, i) => i !== fracIdx);
    return [sizes[fracIdx], ...sortDescWithEdges(rest, maxMiddle, maxLast)];
  }

  // Pin fractional piece to last position (prevents middle placement).
  if (!fractionAtStart && fracIdx >= 0 && sizes[fracIdx] <= maxLast) {
    const rest = sizes.filter((_, i) => i !== fracIdx);
    return [...sortDescWithEdges(rest, maxFirst, maxMiddle), sizes[fracIdx]];
  }

  return sortDescWithEdges(sizes, maxFirst, maxLast);
}

/**
 * Sort sizes descending while ensuring position 0 fits within paddingFirst
 * and the last position fits within paddingLast.
 *
 * Falls back to the original order if constraints cannot be satisfied.
 */
function sortDescWithEdges(sizes: number[], maxFirst: number, maxLast: number): number[] {
  const pool = [...sizes].sort((a, b) => b - a);

  const firstIdx = pool.findIndex((v) => v <= maxFirst);
  if (firstIdx < 0) return sizes;
  const first = pool.splice(firstIdx, 1)[0];

  if (pool.length === 0 || pool[pool.length - 1] <= maxLast) {
    return [first, ...pool];
  }

  const validLastIdx = pool.findIndex((v) => v <= maxLast);
  if (validLastIdx < 0) return sizes;
  const lastPiece = pool.splice(validLastIdx, 1)[0];
  return [first, ...pool, lastPiece];
}

function cumulativeOffsets(sizes: number[]): number[] {
  const offsets: number[] = [0];
  for (let i = 1; i < sizes.length; i++) {
    offsets.push(offsets[i - 1] + sizes[i - 1]);
  }
  return offsets;
}

function isFractional(value: number): boolean {
  return value - Math.floor(value) >= FRACTIONAL_THRESHOLD;
}
