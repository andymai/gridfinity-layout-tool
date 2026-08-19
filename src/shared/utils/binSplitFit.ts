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

/** The fields the limit depends on. Loose so a caller can pass a whole `BinParams`. */
export type BinSplitFitParams = Pick<
  BinParams,
  'width' | 'depth' | 'gridUnitMm' | 'gridUnitMmY' | 'overhang' | 'cellMask'
>;

/** One axis of {@link binSplitChunkUnits}. */
function axisChunkUnits(
  sizeUnits: number,
  gridUnitMm: number,
  bedMm: number,
  near: number,
  far: number
): number {
  if (sizeUnits * gridUnitMm + near + far <= bedMm) return sizeUnits;
  const cap = calcMaxGridUnitsForAxis(Math.max(0, bedMm - Math.max(near, far)), gridUnitMm);
  if (cap < sizeUnits) return cap;
  // Reached only when the cap alone would not cut: a symmetric overhang can
  // leave `cap >= sizeUnits` on an axis that still overruns as one part,
  // because `bedMm - max(near, far)` gives back the side the sum charged.
  // Reporting "needs split" while `getSplitPositions` returns no cut planes
  // would build one oversized piece and call it a split.
  //
  // Halving, not a fixed step down: the piece keeps one side's overhang against
  // half the nominal span, and a step is only a step for an axis big enough to
  // take one — a half-unit axis stepped down by half a unit is the same axis,
  // and reports no cut at all.
  return sizeUnits / 2;
}

/**
 * Largest chunk, per axis, that THIS bin may be cut into for one build plate.
 *
 * NOT the bed's capacity — deliberately named apart from `calcMaxGridUnits`,
 * because it answers a different question and returns a different number for
 * the same bed. It hands straight to `getSplitPositions` /
 * `getSplitPieceCount`, and equals the axis's own size when nothing needs
 * cutting, which is what makes every `size > limit` gate read false.
 *
 * Overhang is suppressed for a partial cell mask, matching the geometry
 * pipeline: a custom shape defines its own footprint.
 */
export function binSplitChunkUnits(
  params: BinSplitFitParams,
  printBedWidthMm: number,
  printBedDepthMm?: number
): { width: number; depth: number } {
  const gridUnitMmX = params.gridUnitMm;
  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const bedDepthMm = printBedDepthMm ?? printBedWidthMm;
  const o = resolveOverhang(isPartialMask(params.cellMask) ? undefined : params.overhang);
  return {
    width: axisChunkUnits(params.width, gridUnitMmX, printBedWidthMm, o.left, o.right),
    depth: axisChunkUnits(params.depth, gridUnitMmY, bedDepthMm, o.front, o.back),
  };
}
