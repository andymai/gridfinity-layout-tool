/**
 * Usable-cavity dimension math for interior compartments.
 *
 * "Cavity" = the open space a user can actually drop an object into, i.e. the
 * compartment footprint with the divider walls subtracted. Mirrors the
 * generator's partition model (see `computeMinCellSize` in validation.ts):
 * the interior is split into `count` equal-pitch cells separated by
 * `count - 1` divider walls of `thickness`, so a single cell measures
 * `(inner - (count - 1) * thickness) / count`. A compartment spanning several
 * cells re-absorbs the internal walls that no longer exist between them.
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
  readonly minCol: number;
  readonly maxCol: number;
  readonly minRow: number;
  readonly maxRow: number;
}

/** Usable cavity size of one 1×1 cell along an axis divided into `count` cells. */
export function singleCellCavity(innerDim: number, count: number, thickness: number): number {
  if (count <= 0) return innerDim;
  const dividers = count > 1 ? (count - 1) * thickness : 0;
  return (innerDim - dividers) / count;
}

/**
 * Usable cavity size of a compartment spanning `span` cells along an axis that
 * is divided into `count` cells total. Equals `innerDim` when `span === count`.
 */
export function spanCavity(
  innerDim: number,
  count: number,
  thickness: number,
  span: number
): number {
  const cell = singleCellCavity(innerDim, count, thickness);
  return span * cell + (span - 1) * thickness;
}

/**
 * Pick the cell count in `[minCount, maxCount]` whose resulting single-cell
 * cavity is closest to `targetCavity`. Ties resolve to the smaller count
 * (fewer, larger compartments) since the loop only replaces on a strict
 * improvement. Counts that would collapse the cavity to ≤ 0 are skipped.
 */
export function solveCountForTargetCavity(
  innerDim: number,
  thickness: number,
  targetCavity: number,
  minCount: number,
  maxCount: number
): number {
  let best = minCount;
  let bestErr = Infinity;
  for (let count = minCount; count <= maxCount; count++) {
    const cavity = singleCellCavity(innerDim, count, thickness);
    if (cavity <= 0) break;
    const error = Math.abs(cavity - targetCavity);
    if (error < bestErr) {
      bestErr = error;
      best = count;
    }
  }
  return best;
}

/** Cavity dimensions of a single compartment, or `null` if its id is absent. */
export function compartmentCavity(
  config: CompartmentConfig,
  compartmentId: number,
  innerW: number,
  innerD: number
): CompartmentCavity | null {
  const bounds = getCompartmentBounds(config, compartmentId);
  if (!bounds) return null;
  const colSpan = bounds.maxCol - bounds.minCol + 1;
  const rowSpan = bounds.maxRow - bounds.minRow + 1;
  return {
    id: compartmentId,
    width: spanCavity(innerW, config.cols, config.thickness, colSpan),
    depth: spanCavity(innerD, config.rows, config.thickness, rowSpan),
    ...bounds,
  };
}
