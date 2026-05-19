import type { Layout, Bin } from '@/core/types';
import { hasFractionalDimensions } from '@/core/constants';
import { getGridBins } from '@/shared/utils/bins';

/**
 * Describes a constraint violation when attempting to disable half-bin mode.
 */
export interface HalfGridConstraintViolation {
  type: 'fractional_bins_exist';
  binIds: string[];
  count: number;
}

/**
 * Result of validating whether half-bin mode can be toggled.
 */
export interface HalfGridConstraintResult {
  canDisable: boolean;
  violation?: HalfGridConstraintViolation;
}

/**
 * Check if a layout has any bins with fractional dimensions (0.5 unit increments).
 * Ignores bins in the staging area since they're not on the grid.
 *
 * @param bins - Array of bins to check
 * @returns True if any bin has fractional x, y, width, or depth
 *
 * @example
 * ```ts
 * const hasFractional = hasFractionalBins(layout.bins);
 * if (hasFractional) {
 *   console.log('Cannot disable half-bin mode');
 * }
 * ```
 */
export function hasFractionalBins(bins: Bin[]): boolean {
  return getGridBins(bins).some((bin) => hasFractionalDimensions(bin));
}

/**
 * Get IDs of all bins with fractional dimensions on the grid.
 * Excludes bins in staging area.
 *
 * @param bins - Array of bins to check
 * @returns Array of bin IDs that have fractional dimensions
 *
 * @example
 * ```ts
 * const fractionalIds = getFractionalBinIds(layout.bins);
 * console.log(`Found ${fractionalIds.length} fractional bins`);
 * ```
 */
export function getFractionalBinIds(bins: Bin[]): string[] {
  return getGridBins(bins)
    .filter((bin) => hasFractionalDimensions(bin))
    .map((bin) => bin.id);
}

/**
 * Validate whether half-bin mode can be toggled to the target state.
 *
 * ## Validation Rules
 *
 * - **Enabling half-bin mode (targetState: true)**: Always allowed
 * - **Disabling half-bin mode (targetState: false)**: Only allowed if no bins have fractional dimensions
 *
 * ## Rationale
 *
 * When half-bin mode is disabled, the grid snaps to whole units (0, 1, 2, ...).
 * Bins at fractional positions (e.g., x=2.5) become "stuck" because the coordinate
 * system no longer supports half-unit increments. Users cannot drag these bins to
 * new positions without re-enabling half-bin mode.
 *
 * @param layout - Current layout to validate
 * @param targetState - Desired half-bin mode state (true = enable, false = disable)
 * @returns Validation result with canDisable flag and optional violation details
 *
 * @example
 * ```ts
 * const result = validateHalfGridModeToggle(layout, false);
 * if (!result.canDisable) {
 *   console.log(`Cannot disable: ${result.violation?.count} bins have fractional dimensions`);
 *   // Show dialog with result.violation.binIds
 * }
 * ```
 */
export function validateHalfGridModeToggle(
  layout: Layout,
  targetState: boolean
): HalfGridConstraintResult {
  // Enabling half-grid mode is always allowed. `canDisable: true` here
  // reads oddly but means "no constraint blocks this transition" — kept
  // for backward compatibility with the existing call sites.
  if (targetState) {
    return { canDisable: true };
  }

  // Disabling half-grid mode: check for fractional bins
  const fractionalBinIds = getFractionalBinIds(layout.bins);

  if (fractionalBinIds.length === 0) {
    return { canDisable: true };
  }

  return {
    canDisable: false,
    violation: {
      type: 'fractional_bins_exist',
      binIds: fractionalBinIds,
      count: fractionalBinIds.length,
    },
  };
}
