/**
 * How many grid units of a bin fit on one build plate, charged for the bin's
 * own overhang.
 *
 * `calcMaxGridUnits` answers the question for a nominal footprint — `N *
 * gridUnitMm <= bedMm`. An overhang grows the outer body outward in millimetres
 * past that footprint, so a 4x4 bin on a 168mm-wide grid can be 271mm of actual
 * part and still report as fitting a 180mm bed. That is what left a bin with a
 * large overhang refusing to offer a split.
 *
 * The reserve differs by piece count on purpose. A bin that fits whole is
 * charged for BOTH sides, because one part carries the lot. Once it is cut, the
 * overhang lands only on the two outermost pieces — one side each — so the
 * binding constraint is the larger single side, not their sum. Charging the sum
 * in both cases over-splits every asymmetric overhang.
 */

import { calcMaxGridUnitsForAxis } from '@/core/constants';
import type { BinParams } from '@/shared/types/bin';
import { isPartialMask } from '@/shared/utils/cellMask';
import { resolveOverhang } from '@/shared/utils/overhang';

/** The fields the fit depends on. Loose so a caller can pass a whole `BinParams`. */
export type BinSplitFitParams = Pick<
  BinParams,
  'width' | 'depth' | 'gridUnitMm' | 'gridUnitMmY' | 'overhang' | 'cellMask'
>;

/**
 * Largest chunk the axis may be cut into. Returns `sizeUnits` itself when the
 * whole part fits, which is what makes `getSplitPositions` yield no cuts and
 * every `size > max` gate read false.
 */
function axisMaxUnits(
  sizeUnits: number,
  gridUnitMm: number,
  bedMm: number,
  near: number,
  far: number
): number {
  if (sizeUnits * gridUnitMm + near + far <= bedMm) return sizeUnits;
  const cap = calcMaxGridUnitsForAxis(Math.max(0, bedMm - Math.max(near, far)), gridUnitMm);
  // A symmetric overhang can leave `cap >= sizeUnits` on an axis that still
  // overruns as one part — `bedMm - max(near, far)` gives back the side the sum
  // charged. Reporting "needs split" while `getSplitPositions` returns no cut
  // planes would build one oversized piece and call it a split, so the axis is
  // forced below its own size. Halving is enough: the piece keeps one side's
  // overhang against half the nominal span.
  return Math.min(cap, Math.max(0.5, sizeUnits - 0.5));
}

/**
 * Per-axis grid capacity for splitting THIS bin, ready to hand to
 * `getSplitPositions` / `getSplitPieceCount` in place of `calcMaxGridUnits`.
 *
 * Overhang is suppressed for a partial cell mask, matching the geometry
 * pipeline: a custom shape defines its own footprint.
 */
export function binSplitMaxGridUnits(
  params: BinSplitFitParams,
  printBedWidthMm: number,
  printBedDepthMm?: number
): { width: number; depth: number } {
  const gridUnitMmX = params.gridUnitMm;
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const bedDepthMm = printBedDepthMm ?? printBedWidthMm;
  const o = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang);
  return {
    width: axisMaxUnits(params.width, gridUnitMmX, printBedWidthMm, o.left, o.right),
    depth: axisMaxUnits(params.depth, gridUnitMmY, bedDepthMm, o.front, o.back),
  };
}
