/**
 * Split position calculator for oversized bin splitting.
 *
 * Uses greedy halving (same algorithm as SplitLineOverlay) to determine
 * where to cut an oversized bin into printable pieces. Returns positions
 * in both grid units (for piece counting) and mm (for 3D preview lines
 * and boolean cut planes).
 */

/**
 * Calculate split line positions along an axis using greedy halving.
 * Returns positions in grid units relative to 0 (start of bin).
 *
 * Same algorithm as grid-editor's SplitLineOverlay.
 */
export function getSplitPositions(size: number, maxSize: number, offset = 0): number[] {
  if (size <= maxSize) return [];

  const splitAt = Math.ceil(size / 2);
  const positions: number[] = [offset + splitAt];

  positions.push(...getSplitPositions(splitAt, maxSize, offset));
  positions.push(...getSplitPositions(size - splitAt, maxSize, offset + splitAt));

  return positions;
}

/**
 * Count the number of pieces an oversized bin will be split into.
 */
export function getSplitPieceCount(width: number, depth: number, maxSize: number): number {
  if (width <= maxSize && depth <= maxSize) return 1;

  const xSplits = getSplitPositions(width, maxSize).length;
  const ySplits = getSplitPositions(depth, maxSize).length;

  return (xSplits + 1) * (ySplits + 1);
}

/**
 * Convert split positions from grid units to mm, relative to bin center (0,0).
 *
 * Used for both 3D preview lines and boolean cut planes in the worker.
 * Each position represents a cut plane along the given axis.
 *
 * @param sizeGridUnits - Bin size in grid units along this axis
 * @param maxGridUnits - Maximum printable size in grid units
 * @param gridSizeMm - Grid unit size in mm (typically 42)
 * @returns Cut plane positions in mm, relative to bin center
 */
export function getSplitPlanePositionsMm(
  sizeGridUnits: number,
  maxGridUnits: number,
  gridSizeMm: number
): number[] {
  const positions = getSplitPositions(sizeGridUnits, maxGridUnits);
  const halfSize = (sizeGridUnits * gridSizeMm) / 2;

  return positions.map((pos) => pos * gridSizeMm - halfSize).sort((a, b) => a - b);
}
