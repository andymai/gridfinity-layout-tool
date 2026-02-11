/**
 * Constraint validation utilities for the generation layer.
 *
 * These helpers allow the generator to verify that params don't
 * contain constraint violations before starting expensive WASM ops.
 */

import type { BinParams } from '@/shared/types/bin';
import type { Result } from '@/core/result';
import { ok, err } from '@/core/result';
import type { FeatureKey } from './types';
import { getAllFeatureStatuses } from './engine';

export interface ConstraintValidationError {
  readonly code: 'CONSTRAINT_VIOLATION';
  readonly message: string;
  readonly feature: FeatureKey;
  readonly reason: string;
}

/**
 * Validate params against all constraint rules.
 * Returns ok if no enabled feature violates a constraint,
 * or the first violation found.
 */
export function validateConstraints(
  params: BinParams
): Result<BinParams, ConstraintValidationError> {
  const statuses = getAllFeatureStatuses(params);

  for (const [feature, status] of statuses) {
    if (status.enabled && !status.available && status.reason) {
      return err({
        code: 'CONSTRAINT_VIOLATION',
        message: `Feature "${feature}" is enabled but conflicts with active constraints.`,
        feature,
        reason: status.reason,
      });
    }
  }

  return ok(params);
}
