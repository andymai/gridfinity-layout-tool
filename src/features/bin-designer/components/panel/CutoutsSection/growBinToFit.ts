/**
 * "Grow the bin to fit" — the companion to `clampCutoutToBoard`.
 *
 * Cutout W/H are typed as real measurements, so a value past the current
 * footprint is kept rather than truncated (#3061) and the board grows to meet
 * it instead. Growing extends the interior toward +X/+Y, which leaves every
 * cutout's stored `x`/`y` (relative to the interior's bottom-left) untouched —
 * the same thing the width/depth steppers already do.
 *
 * Sizes are searched, not solved: each candidate is measured through the real
 * `cutoutInterior`, so wall thickness, tolerance, per-side overhang and
 * non-square grid pitch can't drift out of sync with a hand-inverted formula.
 */

import { DESIGNER_CONSTRAINTS } from '@/features/bin-designer/constants';
import type { BinParams, Cutout } from '@/features/bin-designer/types';
import { cutoutInterior } from '@/features/bin-designer/utils/binDimensions';
import { isPartialMask } from '@/shared/utils/cellMask';
import { expandCutoutArray } from '@/shared/utils/cutoutArray';
import { getCutoutBounds } from './maskFit';

/** Matches the off-board detector's tolerance so a flush edge doesn't grow the bin. */
const EPSILON = 0.01;

/** Grid units (width × depth) a bin must be to hold every cutout. */
export interface GrowTarget {
  readonly width: number;
  readonly depth: number;
}

/**
 * Smallest step ≥ `from` whose interior reaches `requiredMm`, or `null` past
 * `MAX_DIMENSION`. `measure` takes grid units and returns interior mm.
 */
function growAxis(
  from: number,
  requiredMm: number,
  step: number,
  measure: (units: number) => number
): number | null {
  for (let units = from; units <= DESIGNER_CONSTRAINTS.MAX_DIMENSION; units += step) {
    if (measure(units) >= requiredMm - EPSILON) return units;
  }
  return null;
}

/**
 * Bin size that would bring every cutout back inside the board, or `null` when
 * growing alone can't do it — which the caller surfaces by hiding the action
 * rather than growing partway and leaving the warning up.
 *
 * `null` cases:
 * - A custom (masked) footprint. Reshaping the mask decides its own filled
 *   cells, so a larger bin does not imply a larger usable region.
 * - A cutout hanging past the origin side (negative bounds, reachable via
 *   rotation or path vertices). Only the far edges move when the bin grows.
 * - A footprint that needs more than `MAX_DIMENSION` grid units.
 *
 * `step` follows the user's half-grid mode: 1u when off, 0.5u when on. A width
 * that is already fractional keeps its fraction either way — growing is not the
 * place to quietly re-round a dimension the user chose.
 */
export function computeGrowToFit(
  params: BinParams,
  cutouts: readonly Cutout[],
  halfGridMode: boolean
): GrowTarget | null {
  if (isPartialMask(params.cellMask)) return null;

  const { innerW, innerD } = cutoutInterior(params);
  let requiredW = innerW;
  let requiredD = innerD;
  for (const cutout of cutouts) {
    for (const instance of expandCutoutArray(cutout)) {
      const b = getCutoutBounds(instance);
      if (b.minX < -EPSILON || b.minY < -EPSILON) return null;
      if (b.maxX > requiredW) requiredW = b.maxX;
      if (b.maxY > requiredD) requiredD = b.maxY;
    }
  }
  if (requiredW <= innerW + EPSILON && requiredD <= innerD + EPSILON) return null;

  const step = halfGridMode ? 0.5 : 1;
  const width = growAxis(params.width, requiredW, step, (units) =>
    units === params.width ? innerW : cutoutInterior({ ...params, width: units }).innerW
  );
  const depth = growAxis(params.depth, requiredD, step, (units) =>
    units === params.depth ? innerD : cutoutInterior({ ...params, depth: units }).innerD
  );
  if (width === null || depth === null) return null;
  return { width, depth };
}
