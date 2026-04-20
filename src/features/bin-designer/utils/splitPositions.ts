/**
 * Split position calculator for oversized bin splitting.
 *
 * Splits a bin into the minimum number of equal-width pieces that each
 * fit within the print bed. For a size S and max M, produces
 * ceil(S / M) pieces, each of width S / ceil(S / M).
 *
 * Equal pieces guarantee the minimum split count and a symmetric result,
 * which prints and glues together more predictably than uneven halves.
 */

/** Split line positions along an axis (grid units, relative to 0). */
export function getSplitPositions(size: number, maxSize: number, offset = 0): number[] {
  if (size <= maxSize) return [];

  const pieceCount = Math.ceil(size / maxSize);
  const pieceSize = size / pieceCount;

  const positions: number[] = [];
  for (let i = 1; i < pieceCount; i++) {
    positions.push(offset + i * pieceSize);
  }
  return positions;
}

export function getSplitPieceCount(
  width: number,
  depth: number,
  maxWidth: number,
  maxDepth: number = maxWidth
): number {
  const widthPieces = width <= maxWidth ? 1 : Math.ceil(width / maxWidth);
  const depthPieces = depth <= maxDepth ? 1 : Math.ceil(depth / maxDepth);
  return widthPieces * depthPieces;
}

/** Convert split positions from grid units to mm, relative to bin center. */
export function getSplitPlanePositionsMm(
  sizeGridUnits: number,
  maxGridUnits: number,
  gridSizeMm: number
): number[] {
  const positions = getSplitPositions(sizeGridUnits, maxGridUnits);
  const halfSize = (sizeGridUnits * gridSizeMm) / 2;

  return positions.map((pos) => pos * gridSizeMm - halfSize).sort((a, b) => a - b);
}
