/**
 * Re-exports wall-pattern element metrics for cross-feature use.
 *
 * The pattern calculators live in features/generation and are deliberately
 * brepjs-free, so the designer can ask them how large an element is without
 * pulling the WASM kernel into the main bundle. This barrel keeps that a
 * single import rather than a cross-feature boundary violation.
 */

import { getPatternCalculator } from '@/features/generation/worker/generators/patterns';
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
