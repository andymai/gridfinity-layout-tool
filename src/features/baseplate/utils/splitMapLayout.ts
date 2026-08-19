/**
 * Millimetre geometry of the split mini-map.
 *
 * The map used to lay its tracks out in grid UNITS, which is not the shape of
 * the plate: padding is millimetres carried by the outermost pieces only, so a
 * padded plate's first and last columns are physically wider than the equal
 * share the map drew them. Every seam then sat at the wrong fraction of the
 * plate, and the map disagreed with the pieces in the 3D preview.
 *
 * Padding is read back off the pieces rather than taken as a parameter, so the
 * map and the meshes cannot be told different numbers. It is a plate-level
 * property that only the edge pieces carry, which is why a max over all pieces
 * recovers it even when a shaped perimeter has dropped one.
 */

import type { BaseplateTiling } from '../types/tiling';

export interface SplitMapLayout {
  /** Physical width of each column, in mm, in emitted order. */
  readonly colMm: readonly number[];
  /** Physical depth of each row, in mm, front-to-back. */
  readonly rowMm: readonly number[];
  readonly widthMm: number;
  readonly depthMm: number;
  /** Plate padding outside the grid, on the axes the seam offsets measure from. */
  readonly padLeftMm: number;
  readonly padFrontMm: number;
}

function maxPadding(
  pieces: BaseplateTiling['pieces'],
  side: 'paddingLeft' | 'paddingRight' | 'paddingFront' | 'paddingBack'
): number {
  let max = 0;
  for (const piece of pieces) max = Math.max(max, piece[side]);
  return max;
}

export function splitMapLayout(
  tiling: BaseplateTiling,
  gridUnitMm: number,
  gridUnitMmY: number
): SplitMapLayout {
  const { colSizes, rowSizes, pieces } = tiling;
  const padLeftMm = maxPadding(pieces, 'paddingLeft');
  const padRightMm = maxPadding(pieces, 'paddingRight');
  const padFrontMm = maxPadding(pieces, 'paddingFront');
  const padBackMm = maxPadding(pieces, 'paddingBack');

  const colMm = colSizes.map(
    (units, i) =>
      units * gridUnitMm + (i === 0 ? padLeftMm : 0) + (i === colSizes.length - 1 ? padRightMm : 0)
  );
  const rowMm = rowSizes.map(
    (units, i) =>
      units * gridUnitMmY + (i === 0 ? padFrontMm : 0) + (i === rowSizes.length - 1 ? padBackMm : 0)
  );

  const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0);
  return {
    colMm,
    rowMm,
    // Floored above zero so the fractions below stay finite on a degenerate
    // plate; a zero-unit axis would otherwise divide every seam by nothing.
    widthMm: Math.max(sum(colMm), Number.EPSILON),
    depthMm: Math.max(sum(rowMm), Number.EPSILON),
    padLeftMm,
    padFrontMm,
  };
}

/**
 * Where a seam offset (grid units from the grid's own edge) falls across the
 * padded plate, as a 0-1 fraction. Seams are interior cell boundaries, so they
 * always sit past the leading padding.
 */
export function seamFraction(
  offsetUnits: number,
  gridUnitMm: number,
  padMm: number,
  totalMm: number
): number {
  return (padMm + offsetUnits * gridUnitMm) / totalMm;
}
