/**
 * Split position calculator for oversized bin splitting.
 * Uses greedy halving to determine where to cut bins into printable pieces.
 */

/** Split line positions along an axis using greedy halving (grid units, relative to 0). */
export function getSplitPositions(size: number, maxSize: number, offset = 0): number[] {
  if (size <= maxSize) return [];

  const splitAt = Math.ceil(size / 2);
  const positions: number[] = [offset + splitAt];

  positions.push(...getSplitPositions(splitAt, maxSize, offset));
  positions.push(...getSplitPositions(size - splitAt, maxSize, offset + splitAt));

  return positions;
}

export function getSplitPieceCount(width: number, depth: number, maxSize: number): number {
  if (width <= maxSize && depth <= maxSize) return 1;

  const xSplits = getSplitPositions(width, maxSize).length;
  const ySplits = getSplitPositions(depth, maxSize).length;

  return (xSplits + 1) * (ySplits + 1);
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
