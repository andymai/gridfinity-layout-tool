/**
 * Predicts whether the floor pattern (#2816) can actually place an element, so
 * the panel can say so instead of leaving the user with a toggle that appears
 * to do nothing.
 *
 * The window rule itself is imported rather than mirrored
 * (`@/shared/generation/floorPatternMetrics`) — it is the rule that keeps holes
 * off the baseplate-mating taper, and a drifted copy of it here would quietly
 * mispredict exactly the bins the geometry refuses to pattern.
 *
 * Deliberately conservative: it evaluates the smallest window the bin offers
 * and ignores keep-outs (magnets, divider footings, scoop ramps), which only
 * the geometry layer can resolve. A `fits` result therefore means "nothing
 * structural stops it"; a window cleared entirely by keep-outs still stays
 * solid silently, the same convention every other pattern feature follows.
 */

import type { BinParams } from '@/features/bin-designer/types';
import { DEFAULT_PATTERN_SCALE } from '@/features/bin-designer/types';
import { GRIDFINITY } from '@/features/bin-designer/constants/gridfinity';
import { floorWindowSpan, FLOOR_PATTERN_BORDER } from '@/shared/generation/floorPatternMetrics';
import { wallPatternElementMetrics } from '@/shared/generation/wallPatternMetrics';

export type FloorPatternFit =
  /** The feature doesn't apply to this bin at all. */
  | 'unavailable'
  /** Applies, but no window can carry a single element. */
  | 'none'
  /** Every window the bin offers can carry the pattern. */
  | 'fits';

/** Assess whether this bin's floor can carry its pattern. */
export function assessFloorPatternFit(params: BinParams): FloorPatternFit {
  const floorPattern = params.floorPattern;
  if (floorPattern?.enabled !== true) return 'unavailable';
  if (params.base.solid || params.style === 'solid') return 'unavailable';
  if (params.base.lightweight) return 'unavailable';

  const gridUnitMmY = params.gridUnitMmY ?? params.gridUnitMm;
  const { shapeRadius } = wallPatternElementMetrics(
    floorPattern.pattern,
    params.height,
    floorPattern.scale ?? DEFAULT_PATTERN_SCALE
  );

  // A flat base has no feet, so the window is the whole cavity floor; every
  // other base tiles one window per foot, and `halfSockets` quarters them.
  const [spanX, spanY] =
    params.base.style === 'flat'
      ? [
          params.width * params.gridUnitMm -
            GRIDFINITY.TOLERANCE -
            2 * params.wallThickness -
            2 * FLOOR_PATTERN_BORDER,
          params.depth * gridUnitMmY -
            GRIDFINITY.TOLERANCE -
            2 * params.wallThickness -
            2 * FLOOR_PATTERN_BORDER,
        ]
      : [
          floorWindowSpan(
            params.base.halfSockets ? 0.5 : 1,
            params.gridUnitMm,
            params.wallThickness
          ),
          floorWindowSpan(params.base.halfSockets ? 0.5 : 1, gridUnitMmY, params.wallThickness),
        ];

  // One element needs its full bounding diameter to sit inside the window;
  // below that `calculateCenters` returns no centres and the floor stays solid.
  return Math.min(spanX, spanY) >= 2 * shapeRadius ? 'fits' : 'none';
}
