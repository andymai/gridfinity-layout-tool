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
 * @returns Array of chunk sizes in grid units (may include 0.5 fractions)
 */
export function splitAxis(totalUnits: number, gridUnitMm: number, printBedMm: number): number[] {
  const maxUnits = Math.floor(printBedMm / gridUnitMm);
  if (maxUnits < 1) return [totalUnits]; // degenerate case

  const integerPart = Math.floor(totalUnits);
  const hasFraction = totalUnits - integerPart >= 0.49;

  const splits: number[] = [];
  let remaining = integerPart;
  while (remaining > 0) {
    const chunk = Math.min(remaining, maxUnits);
    splits.push(chunk);
    remaining -= chunk;
  }

  if (hasFraction) {
    const lastIdx = splits.length - 1;
    if (lastIdx >= 0 && (splits[lastIdx] + 0.5) * gridUnitMm <= printBedMm) {
      splits[lastIdx] += 0.5;
    } else {
      splits.push(0.5);
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

  // Split each axis
  let colSizes = splitAxis(width, gridUnitMm, printBedMm);
  let rowSizes = splitAxis(depth, gridUnitMm, printBedMm);

  // If fractional edge is at 'start', reverse so the fraction lands on the first piece
  if (fractionalEdgeX === 'start') colSizes = colSizes.reverse();
  if (fractionalEdgeY === 'start') rowSizes = rowSizes.reverse();

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
