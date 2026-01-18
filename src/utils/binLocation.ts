import { STAGING_ID } from '@/core/constants';
import { validateRotation, type RotationResult as ImportedRotationResult } from './rotation';
import type { Bin, Layout } from '@/core/types';

/**
 * Bin location type - where the bin exists in the UI.
 * Can be extended in the future for template libraries, trash preview, etc.
 */
export type BinLocation = 'grid' | 'stash';

/**
 * Location context describes what operations are allowed for a bin
 * based on where it is located.
 */
export interface BinLocationContext {
  /** The location type */
  location: BinLocation;

  /** Whether the bin can be rotated (swap width/depth) */
  canRotate: boolean;

  /** Whether the bin can be moved to stash */
  canMoveToStash: boolean;

  /** Whether bin properties can be edited */
  canEdit: boolean;

  /** Whether placement validation is required for this bin */
  requiresPlacementValidation: boolean;

  /** Human-readable label for the location */
  label: string;
}

/**
 * Get the location context for a bin.
 * This is the single source of truth for grid vs stash behavior.
 *
 * @param bin - The bin to get context for
 * @returns The location context with allowed operations
 *
 * @example
 * const ctx = getBinLocationContext(bin);
 * if (ctx.canRotate) {
 *   // Rotation is allowed for this bin
 * }
 */
export function getBinLocationContext(bin: Bin): BinLocationContext {
  if (bin.layerId === STAGING_ID) {
    return {
      location: 'stash',
      canRotate: true,          // No collision checks needed
      canMoveToStash: false,    // Already in stash
      canEdit: true,            // All properties editable
      requiresPlacementValidation: false, // No bounds/collision constraints
      label: 'Stash',
    };
  }

  return {
    location: 'grid',
    canRotate: true,            // Requires validation
    canMoveToStash: true,       // Can be moved to stash
    canEdit: true,              // All properties editable
    requiresPlacementValidation: true, // Must check bounds/collisions
    label: 'Grid',
  };
}

/**
 * Result of rotation validation.
 * Re-exported from rotation.ts for convenience.
 */
export type RotationResult = ImportedRotationResult;

/**
 * Validate whether a bin can be rotated (swap width and depth).
 * This function handles location-aware validation:
 * - Stash bins: Always valid (no spatial constraints)
 * - Grid bins: Validates bounds and collisions using existing rotation.ts logic
 *
 * @param bin - The bin to rotate
 * @param layout - The current layout (needed for grid validation)
 * @returns Validation result with error message if invalid
 *
 * @example
 * const result = validateBinRotation(bin, layout);
 * if (!result.valid) {
 *   showError(result.message);
 *   return;
 * }
 * // Proceed with rotation
 */
export function validateBinRotation(bin: Bin, layout: Layout): RotationResult {
  const context = getBinLocationContext(bin);

  // Stash bins can always rotate (no collision/bounds constraints)
  if (!context.requiresPlacementValidation) {
    return { valid: true };
  }

  // Grid bins: delegate to existing rotation validation
  return validateRotation(bin, layout);
}

/**
 * Check if a bin is in the stash.
 * Convenience function for common checks.
 *
 * @param bin - The bin to check
 * @returns true if the bin is in the stash
 */
export function isBinInStash(bin: Bin): boolean {
  return bin.layerId === STAGING_ID;
}

/**
 * Check if a bin is on the grid.
 * Convenience function for common checks.
 *
 * @param bin - The bin to check
 * @returns true if the bin is on the grid
 */
export function isBinOnGrid(bin: Bin): boolean {
  return bin.layerId !== STAGING_ID;
}
