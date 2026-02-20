/**
 * Complex geometry detection -- pure predicates.
 *
 * A design has "complex geometry" when resizing would risk invalidating
 * manually-placed internal features (inserts, cutouts, non-default compartments).
 * When detected, bin-to-design sync is blocked to prevent silent data loss.
 */

import type { BinParams } from '@/features/bin-designer/types';

export type ComplexityReason = 'inserts' | 'cutouts' | 'non-default-compartments';

/**
 * Check if a design has complex geometry that could be invalidated by resizing.
 */
export function hasComplexGeometry(params: BinParams): boolean {
  if (params.inserts.length > 0) return true;
  if (params.cutouts.length > 0) return true;

  const uniqueCompartments = new Set(params.compartments.cells);
  return uniqueCompartments.size > 1;
}

/**
 * Get specific reasons why a design has complex geometry.
 */
export function getComplexityReasons(params: BinParams): ComplexityReason[] {
  const reasons: ComplexityReason[] = [];

  if (params.inserts.length > 0) {
    reasons.push('inserts');
  }

  if (params.cutouts.length > 0) {
    reasons.push('cutouts');
  }

  const uniqueCompartments = new Set(params.compartments.cells);
  if (uniqueCompartments.size > 1) {
    reasons.push('non-default-compartments');
  }

  return reasons;
}
