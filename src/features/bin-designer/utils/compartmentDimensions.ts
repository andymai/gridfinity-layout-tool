/**
 * Usable-cavity dimension math for interior compartments.
 *
 * "Cavity" = the open space a user can actually drop an object into, i.e. the
 * compartment footprint with the divider walls subtracted.
 *
 * Per-compartment cavities follow the GENERATOR model exactly (see
 * `cavityCorners` in `generators/compartmentBuilder.ts`): the interior is split
 * into `count` equal-pitch cells (`cellW = innerW / cols`); each compartment is
 * then inset by `thickness / 2` on its INTERIOR edges only — edges that meet the
 * bin wall are not inset. So edge compartments are slightly wider than interior
 * ones and are not centered within their grid cell. `compartmentCavity` returns
 * the true extents so the 2D readout and 3D lines match the printed geometry.
 *
 * `singleCellCavity` is a separate, coarser quantity: the AVERAGE cavity of a
 * uniform `count`-way split — `(inner − (count − 1) · thickness) / count`. It's
 * used only for the by-size solver and the uniform "≈" summary, where a single
 * representative value (not a specific compartment) is wanted.
 */

import type { CompartmentConfig } from '../types';
import { getCompartmentBounds } from './compartments';

/** Format a millimeter value compactly: nearest 0.1mm, dropping a trailing `.0`. */
export function formatCompactMm(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export interface CompartmentCavity {
  readonly id: number;
  /** Usable cavity width in mm (X axis). */
  readonly width: number;
  /** Usable cavity depth in mm (Y axis). */
  readonly depth: number;
  /** Cavity extents in mm, centered on the bin (origin at center) — matches the
   *  generator's coordinate frame so 3D dimension lines sit on the real opening. */
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

/**
 * Smallest usable cavity in a uniform `count`-way split along an axis — i.e. the
 * size of the tightest compartment. Interior cells lose a full wall (half on
 * each side); edge cells lose only a half. So for `count >= 3` the minimum is an
 * interior cell (`pitch - thickness`); for `count === 2` both cells are edges
 * (`pitch - thickness/2`); for `count <= 1` there are no dividers (full span).
 * This is the value a "fits my object" guarantee must be measured against.
 */
export function minUniformCavity(innerDim: number, count: number, thickness: number): number {
  if (count <= 1) return innerDim;
  const pitch = innerDim / count;
  return count >= 3 ? pitch - thickness : pitch - thickness / 2;
}

/**
 * Fit-guarantee solver: the LARGEST count in `[minCount, maxCount]` whose
 * tightest compartment is still `>= targetCavity`. Packs as many compartments as
 * fit while keeping every one at least the requested size. Falls back to
 * `minCount` when even that can't reach the target (target larger than the
 * interior). `minUniformCavity` decreases monotonically in `count`, so we can
 * stop at the first count that drops below the target.
 */
export function solveCountForMinCavity(
  innerDim: number,
  thickness: number,
  targetCavity: number,
  minCount: number,
  maxCount: number
): number {
  let best = minCount;
  for (let count = minCount; count <= maxCount; count++) {
    if (minUniformCavity(innerDim, count, thickness) >= targetCavity) best = count;
    else break;
  }
  return best;
}

/**
 * Exact cavity extents + size of a single compartment, matching the generator's
 * `cavityCorners`. Returns `null` if the id is absent. Extents are centered on
 * the bin (origin at center), in millimeters.
 */
export function compartmentCavity(
  config: CompartmentConfig,
  compartmentId: number,
  innerW: number,
  innerD: number
): CompartmentCavity | null {
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return null;
  const { cols, rows, thickness } = config;
  const { minCol, maxCol, minRow, maxRow } = bounds;
  const cellW = innerW / cols;
  const cellD = innerD / rows;
  const half = thickness / 2;
  // Inset half a wall only on edges that border another compartment, never on
  // edges that meet the bin wall (minCol/minRow === 0 or maxCol/maxRow at limit).
  const xMin = -innerW / 2 + minCol * cellW + (minCol > 0 ? half : 0);
  const xMax = -innerW / 2 + (maxCol + 1) * cellW - (maxCol < cols - 1 ? half : 0);
  const yMin = -innerD / 2 + minRow * cellD + (minRow > 0 ? half : 0);
  const yMax = -innerD / 2 + (maxRow + 1) * cellD - (maxRow < rows - 1 ? half : 0);
  return {
    id: compartmentId,
    width: xMax - xMin,
    depth: yMax - yMin,
    xMin,
    xMax,
    yMin,
    yMax,
    ...bounds,
  };
}
