/**
 * Baseplate split planner — pure functions for computing how a large baseplate
 * should be tiled into printable pieces.
 *
 * The algorithm is greedy: it maximizes piece size along each axis independently,
 * then combines the 1D splits into a 2D grid. Fractional half-unit edges are
 * absorbed into the outermost piece when they fit, otherwise become a separate piece.
 */

import type { BaseplateParams as FullBaseplateParams } from '@/shared/types/bin';
import type { BaseplatePiece, BaseplateTiling } from '../types/tiling';

/** Convert a zero-based column index to a letter: 0→A, 1→B, ..., 25→Z */
export function colToLetter(col: number): string {
  return String.fromCharCode(65 + col);
}

/**
 * Split a single axis into chunks that fit on the print bed.
 *
 * Uses greedy largest-first: take as many integer units as possible per chunk.
 * If the axis has a fractional 0.5 unit, it's absorbed into the last chunk
 * when it fits, otherwise becomes a separate 0.5-unit piece.
 *
 * Edge pieces carry padding that reduces the available space for grid units:
 * - The first chunk must fit with `paddingStart`
 * - The last chunk must fit with `paddingEnd`
 * - Middle chunks use the full print bed
 * - A single chunk must fit with both paddings
 *
 * @returns Array of chunk sizes in grid units (may include 0.5 fractions)
 */
export function splitAxis(
  totalUnits: number,
  gridUnitMm: number,
  printBedMm: number,
  paddingStart = 0,
  paddingEnd = 0
): number[] {
  const maxUnits = (overhead: number) => Math.floor((printBedMm - overhead) / gridUnitMm);

  const maxBoth = maxUnits(paddingStart + paddingEnd);
  const maxFirst = maxUnits(paddingStart);
  const maxLast = maxUnits(paddingEnd);
  const maxMiddle = maxUnits(0);

  if (maxBoth < 1 || maxFirst < 1 || maxLast < 1 || maxMiddle < 1) {
    return [totalUnits]; // degenerate: bed can't even hold 1 unit
  }

  const integerPart = Math.floor(totalUnits);
  const hasFraction = totalUnits - integerPart >= 0.49;

  const splits: number[] = [];

  if (integerPart <= maxBoth) {
    // Single piece fits with both paddings
    if (integerPart > 0) splits.push(integerPart);
  } else {
    // First chunk (carries paddingStart overhead)
    let remaining = integerPart;
    const first = Math.min(remaining, maxFirst);
    splits.push(first);
    remaining -= first;

    // Middle chunks (no padding overhead)
    while (remaining > 0) {
      const chunk = Math.min(remaining, maxMiddle);
      splits.push(chunk);
      remaining -= chunk;
    }

    // Fix the last chunk if it exceeds maxLast (carries paddingEnd overhead)
    const lastIdx = splits.length - 1;
    if (lastIdx > 0 && splits[lastIdx] > maxLast) {
      const overflow = splits[lastIdx] - maxLast;
      splits[lastIdx] = maxLast;
      // Insert overflow before last as a middle piece (overflow < maxMiddle always)
      splits.splice(lastIdx, 0, overflow);
    }
  }

  // Handle fractional 0.5 unit
  if (hasFraction) {
    if (splits.length === 0) {
      splits.push(0.5);
    } else {
      const lastIdx = splits.length - 1;
      const lastOverhead = splits.length === 1 ? paddingStart + paddingEnd : paddingEnd;
      if ((splits[lastIdx] + 0.5) * gridUnitMm + lastOverhead <= printBedMm) {
        splits[lastIdx] += 0.5;
      } else {
        splits.push(0.5);
      }
    }
  }

  return splits;
}

/**
 * Compute the full 2D tiling for a baseplate.
 *
 * Takes the full generation params + print bed size and returns a tiling plan.
 * If the baseplate fits on a single bed, returns a single-piece tiling with
 * `isSplit: false`.
 */
export function computeBaseplateTiling(
  params: FullBaseplateParams,
  printBedMm: number
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

  // Split each axis, accounting for edge padding.
  // When fractionalEdge is 'start' we swap the padding parameters so splitAxis
  // places the fraction at the end (its default), then reorderLargestFirst moves
  // it to position 0 while sorting the rest descending.
  const colPadStart = fractionalEdgeX === 'start' ? paddingRight : paddingLeft;
  const colPadEnd = fractionalEdgeX === 'start' ? paddingLeft : paddingRight;
  const rowPadStart = fractionalEdgeY === 'start' ? paddingBack : paddingFront;
  const rowPadEnd = fractionalEdgeY === 'start' ? paddingFront : paddingBack;

  const colSizes = reorderLargestFirst(
    splitAxis(width, gridUnitMm, printBedMm, colPadStart, colPadEnd),
    gridUnitMm,
    printBedMm,
    paddingLeft,
    paddingRight,
    fractionalEdgeX === 'start'
  );
  const rowSizes = reorderLargestFirst(
    splitAxis(depth, gridUnitMm, printBedMm, rowPadStart, rowPadEnd),
    gridUnitMm,
    printBedMm,
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

  return {
    isSplit,
    pieces,
    cols: colSizes.length,
    rows: rowSizes.length,
    totalWidthUnits: width,
    totalDepthUnits: depth,
    stackCount: 1,
    stackSeparatorThickness: 0,
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
  parentParams: FullBaseplateParams
): FullBaseplateParams {
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
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Reorder split sizes so the largest pieces are at the lowest indices (front/left),
 * while respecting edge constraints and fractional edge placement.
 *
 * When `fractionAtStart` is true and a fractional piece exists, it is pinned to
 * position 0 with the remaining pieces sorted descending.
 * In all other cases, pieces are sorted descending with edge constraints validated.
 */
function reorderLargestFirst(
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

  // When fractionAtStart, pin the fractional piece (always last from splitAxis) to position 0.
  // The remaining pieces occupy positions 1..N where position N carries paddingLast.
  if (fractionAtStart) {
    const lastIdx = sizes.length - 1;
    if (isFractional(sizes[lastIdx])) {
      const maxMiddle = Math.floor(printBedMm / gridUnitMm);
      const sortedRest = sortDescWithEdges(sizes.slice(0, lastIdx), maxMiddle, maxAtLast);
      return [sizes[lastIdx], ...sortedRest];
    }
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
  return value - Math.floor(value) >= 0.49;
}
