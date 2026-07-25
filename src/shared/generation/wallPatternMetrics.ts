/**
 * Re-exports wall-pattern element metrics for cross-feature use.
 *
 * The pattern calculators live in features/generation and are deliberately
 * brepjs-free, so the designer can ask them how large an element is without
 * pulling the WASM kernel into the main bundle. This barrel keeps that a
 * single import rather than a cross-feature boundary violation.
 */

import {
  getPatternCalculator,
  isStampCalculator,
} from '@/features/generation/worker/generators/patterns';
import type { WallPatternType } from '@/shared/types/bin';

/** Element sizing needed to predict whether a pattern fits a given surface. */
export interface WallPatternElementMetrics {
  /** Minimum band height (mm) that fits one row of elements. */
  readonly minPatternHeight: number;
  /** Bounding radius of a single element (mm). */
  readonly shapeRadius: number;
}

export function wallPatternElementMetrics(
  pattern: WallPatternType,
  binHeightUnits: number,
  scale: number
): WallPatternElementMetrics {
  const calculator = getPatternCalculator(pattern, binHeightUnits, scale);
  return {
    minPatternHeight: calculator.getMinPatternHeight(),
    shapeRadius: calculator.getShapeRadius(),
  };
}

/**
 * Open area (mm²) a stamp pattern actually removes from a `fillW × fillH` box.
 *
 * Exact rather than fractional: it places the real element centres and sums
 * their areas. That matters on a SMALL box — a bin floor's per-foot window is
 * only ~33mm across, and a fraction-of-area model over-reports it by ~3x
 * because it ignores the margin the calculator leaves at every edge. Over a
 * long wall band the same margin is noise, which is why the wall estimate can
 * still use a fraction.
 *
 * Returns 0 for wrapped-lattice (kumiko) patterns, which have no stamped
 * element to count and never tile a bounded box.
 */
export function stampPatternOpenArea(
  pattern: WallPatternType,
  binHeightUnits: number,
  scale: number,
  fillW: number,
  fillH: number
): number {
  if (fillW <= 0 || fillH <= 0) return 0;
  const calculator = getPatternCalculator(pattern, binHeightUnits, scale);
  if (!isStampCalculator(calculator)) return 0;

  const count = calculator.calculateCenters({ fillW, fillH }).length;
  if (count === 0) return 0;

  const shape = calculator.getShapeDescriptor({ fillW, fillH });
  const elementArea =
    shape.kind === 'polygon'
      ? 0.5 * shape.sides * shape.radius ** 2 * Math.sin((2 * Math.PI) / shape.sides)
      : shape.width * shape.height;
  return count * elementArea;
}
