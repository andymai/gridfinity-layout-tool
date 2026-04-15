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
  printBedMm: number,
  paddingStart: number,
  paddingEnd: number
): number[] | null {
  const intPart = Math.floor(totalUnits);
  const hasFrac = totalUnits - intPart >= FRACTIONAL_THRESHOLD;

  const maxWithBoth = Math.floor((printBedMm - paddingStart - paddingEnd) / gridUnitMm);
  const maxWithStart = Math.floor((printBedMm - paddingStart) / gridUnitMm);
  const maxWithEnd = Math.floor((printBedMm - paddingEnd) / gridUnitMm);
  const maxMiddle = Math.floor(printBedMm / gridUnitMm);

  // Degenerate: bed can't hold even 1 unit in any position
  if (maxWithBoth < 1 || maxWithStart < 1 || maxWithEnd < 1 || maxMiddle < 1) {
    return numChunks === 1 ? [totalUnits] : null;
  }

  if (numChunks === 1) {
    // Single piece must fit with both paddings
    if (intPart > maxWithBoth) return null;
    if (hasFrac) {
      if ((intPart + 0.5) * gridUnitMm + paddingStart + paddingEnd <= printBedMm) {
        return [totalUnits];
      }
      return null; // fraction doesn't fit
    }
    return intPart > 0 ? [intPart] : null;
  }

  // For numChunks >= 2, distribute integer units as evenly as possible.
  // Compute per-position max capacities (first and last carry edge padding).
  const maxPerPos: number[] = Array.from({ length: numChunks }, (_, i) => {
    if (i === 0) return maxWithStart;
    if (i === numChunks - 1) return maxWithEnd;
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

  // Clamp base sizes that exceed position capacity
  for (let i = 0; i < numChunks; i++) {
    if (sizes[i] > maxPerPos[i]) {
      remainder += sizes[i] - maxPerPos[i];
      sizes[i] = maxPerPos[i];
    }
  }

  // Distribute remainder one unit at a time
  for (let i = 0; i < numChunks && remainder > 0; i++) {
    const canAdd = maxPerPos[i] - sizes[i];
    if (canAdd > 0) {
      const add = Math.min(1, canAdd);
      sizes[i] += add;
      remainder--;
    }
  }

  // Pass 2: redistribute any remaining units into slots that still have capacity.
  // This handles cases where the first-come distribution was capped by maxPerPos.
  for (let i = 0; i < numChunks && remainder > 0; i++) {
    const canAdd = maxPerPos[i] - sizes[i];
    const add = Math.min(canAdd, remainder);
    sizes[i] += add;
    remainder -= add;
  }

  if (remainder > 0) return null; // infeasible even with full capacity

  // Any chunk with 0 units means we have more chunks than needed
  if (sizes.some((s) => s <= 0)) return null;

  // Handle fractional 0.5 unit — absorb into last chunk if it fits
  if (hasFrac) {
    const lastIdx = numChunks - 1;
    const lastOverhead = paddingEnd;
    if ((sizes[lastIdx] + 0.5) * gridUnitMm + lastOverhead <= printBedMm) {
      sizes[lastIdx] += 0.5;
    } else {
      return null; // fraction doesn't fit, caller should try numChunks+1
    }
  }

  return sizes;
}

/**
 * Verify every piece in a cols × rows grid fits the bed considering its
 * edge-specific padding. Corner pieces get padding on two sides.
 *
 * Because each piece's physical width depends only on its column index and its
 * physical depth depends only on its row index, the two axes are independent —
 * checking each axis separately is sufficient without a cross-product.
 */
function allPiecesFit(
  colSizes: number[],
  rowSizes: number[],
  gridUnitMm: number,
  printBedWidthMm: number,
  printBedDepthMm: number,
  pL: number,
  pR: number,
  pF: number,
  pB: number
): boolean {
  for (let c = 0; c < colSizes.length; c++) {
    const padLeft = c === 0 ? pL : 0;
    const padRight = c === colSizes.length - 1 ? pR : 0;
    const widthMm = colSizes[c] * gridUnitMm + padLeft + padRight;
    if (widthMm > printBedWidthMm + 0.001) return false;
  }

  for (let r = 0; r < rowSizes.length; r++) {
    const padFront = r === 0 ? pF : 0;
    const padBack = r === rowSizes.length - 1 ? pB : 0;
    const depthMm = rowSizes[r] * gridUnitMm + padFront + padBack;
    if (depthMm > printBedDepthMm + 0.001) return false;
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
  score: number; // lower = better symmetry
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
  printBedWidthMm: number,
  printBedDepthMm: number,
  pL: number,
  pR: number,
  pF: number,
  pB: number
): { colSizes: number[]; rowSizes: number[] } {
  const maxCols = Math.ceil(totalWidth); // absolute upper bound
  const maxRows = Math.ceil(totalDepth);

  let best: TilingCandidate | null = null;

  for (let nc = 1; nc <= maxCols; nc++) {
    // Early exit: nc alone exceeds best piece count (nc * 1 > best).
    // Use > not >= so we still evaluate nc×1 candidates for symmetry tiebreaks.
    if (best && nc > best.pieceCount) break;

    const colSizes = partitionAxis(totalWidth, nc, gridUnitMm, printBedWidthMm, pL, pR);
    if (!colSizes) continue;

    for (let nr = 1; nr <= maxRows; nr++) {
      const pieceCount = nc * nr;
      if (best && pieceCount > best.pieceCount) break;

      const rowSizes = partitionAxis(totalDepth, nr, gridUnitMm, printBedDepthMm, pF, pB);
      if (!rowSizes) continue;

      if (
        allPiecesFit(
          colSizes,
          rowSizes,
          gridUnitMm,
          printBedWidthMm,
          printBedDepthMm,
          pL,
          pR,
          pF,
          pB
        )
      ) {
        const score = symmetryScore(colSizes) + symmetryScore(rowSizes);
        if (
          !best ||
          pieceCount < best.pieceCount ||
          (pieceCount === best.pieceCount && score < best.score)
        ) {
          best = { colSizes, rowSizes, pieceCount, score };
        }
        break; // found valid nr for this nc, smaller nr won't help (already pruned above)
      }
    }
  }

  // Fallback: single piece (degenerate bed)
  if (!best) {
    return { colSizes: [totalWidth], rowSizes: [totalDepth] };
  }

  return { colSizes: best.colSizes, rowSizes: best.rowSizes };
}
/**
 * Check if reducing padding would eliminate a split or save pieces.
 *
 * Tests X-axis (left+right) and Y-axis (front+back) independently,
 * reducing each by 1mm increments down to 0.
 */
function computePaddingReductionHint(
  totalWidth: number,
  totalDepth: number,
  gridUnitMm: number,
  printBedWidthMm: number,
  printBedDepthMm: number,
  pL: number,
  pR: number,
  pF: number,
  pB: number,
  currentPieceCount: number
): PaddingReductionHint | null {
  if (currentPieceCount <= 1) return null;

  const candidates: PaddingReductionHint[] = [];

  // Try reducing X-axis padding (left + right equally)
  const maxReduceX = Math.min(pL, pR);
  for (let r = 1; r <= maxReduceX; r++) {
    const result = findOptimalTiling(
      totalWidth,
      totalDepth,
      gridUnitMm,
      printBedWidthMm,
      printBedDepthMm,
      pL - r,
      pR - r,
      pF,
      pB
    );
    const saved = currentPieceCount - result.colSizes.length * result.rowSizes.length;
    if (saved > 0) {
      candidates.push({ axis: 'x', reductionMm: r, piecesSaved: saved });
      break;
    }
  }

  // Try reducing Y-axis padding (front + back equally)
  const maxReduceY = Math.min(pF, pB);
  for (let r = 1; r <= maxReduceY; r++) {
    const result = findOptimalTiling(
      totalWidth,
      totalDepth,
      gridUnitMm,
      printBedWidthMm,
      printBedDepthMm,
      pL,
      pR,
      pF - r,
      pB - r
    );
    const saved = currentPieceCount - result.colSizes.length * result.rowSizes.length;
    if (saved > 0) {
      candidates.push({ axis: 'y', reductionMm: r, piecesSaved: saved });
      break;
    }
  }

  // Try reducing both axes
  const maxReduceBoth = Math.min(maxReduceX, maxReduceY);
  for (let r = 1; r <= maxReduceBoth; r++) {
    const result = findOptimalTiling(
      totalWidth,
      totalDepth,
      gridUnitMm,
      printBedWidthMm,
      printBedDepthMm,
      pL - r,
      pR - r,
      pF - r,
      pB - r
    );
    const saved = currentPieceCount - result.colSizes.length * result.rowSizes.length;
    if (saved > 0) {
      candidates.push({ axis: 'both', reductionMm: r, piecesSaved: saved });
      break;
    }
  }

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
  } = params;

  // Find optimal tiling using 2D joint search
  const { colSizes: rawColSizes, rowSizes: rawRowSizes } = findOptimalTiling(
    width,
    depth,
    gridUnitMm,
    printBedWidthMm,
    printBedDepthMm,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack
  );

  // Reorder for display: largest pieces at front/left, fractional edges pinned
  const colSizes = reorderForDisplay(
    rawColSizes,
    gridUnitMm,
    printBedWidthMm,
    paddingLeft,
    paddingRight,
    fractionalEdgeX === 'start'
  );
  const rowSizes = reorderForDisplay(
    rawRowSizes,
    gridUnitMm,
    printBedDepthMm,
    paddingFront,
    paddingBack,
    fractionalEdgeY === 'start'
  );

  const isSplit = colSizes.length > 1 || rowSizes.length > 1;

  // Precompute cumulative offsets
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

  // Compute padding reduction hint
  const pieceCount = colSizes.length * rowSizes.length;
  const paddingReductionHint = computePaddingReductionHint(
    width,
    depth,
    gridUnitMm,
    printBedWidthMm,
    printBedDepthMm,
    paddingLeft,
    paddingRight,
    paddingFront,
    paddingBack,
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
  printBedMm: number,
  paddingFirst: number,
  paddingLast: number,
  fractionAtStart: boolean
): number[] {
  if (sizes.length <= 1) return sizes;

  const maxAtFirst = Math.floor((printBedMm - paddingFirst) / gridUnitMm);
  const maxAtLast = Math.floor((printBedMm - paddingLast) / gridUnitMm);

  const fracIdx = sizes.findIndex(isFractional);

  // When fractionAtStart, pin the fractional piece to position 0 —
  // but only if it actually fits with paddingFirst at that position.
  if (fractionAtStart) {
    if (fracIdx >= 0 && sizes[fracIdx] <= maxAtFirst) {
      const maxMiddle = Math.floor(printBedMm / gridUnitMm);
      const rest = sizes.filter((_, i) => i !== fracIdx);
      const sortedRest = sortDescWithEdges(rest, maxMiddle, maxAtLast);
      return [sizes[fracIdx], ...sortedRest];
    }
  }

  // When fraction exists and belongs at the end, pin it to the last position
  // to prevent sortDescWithEdges from placing it in the middle.
  if (!fractionAtStart && fracIdx >= 0 && sizes[fracIdx] <= maxAtLast) {
    const maxMiddle = Math.floor(printBedMm / gridUnitMm);
    const rest = sizes.filter((_, i) => i !== fracIdx);
    const sortedRest = sortDescWithEdges(rest, maxAtFirst, maxMiddle);
    return [...sortedRest, sizes[fracIdx]];
  }

  return sortDescWithEdges(sizes, maxAtFirst, maxAtLast);
}

/**
 * Sort sizes descending while ensuring position 0 fits within paddingFirst
 * and the last position fits within paddingLast.
 *
 * Falls back to the original order if constraints cannot be satisfied.
 */
function sortDescWithEdges(sizes: number[], maxFirst: number, maxLast: number): number[] {
  const pool = [...sizes].sort((a, b) => b - a);

  // Position 0: largest piece that fits with paddingFirst
  const firstIdx = pool.findIndex((v) => v <= maxFirst);
  if (firstIdx < 0) return sizes;
  const first = pool.splice(firstIdx, 1)[0];

  // If the smallest remaining piece already fits paddingLast, we're done
  if (pool.length === 0 || pool[pool.length - 1] <= maxLast) {
    return [first, ...pool];
  }

  // Last element too large — find a valid one and move it to the end
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
