/**
 * Public facade for layout validation.
 *
 * The implementation lives in focused sibling modules; this file
 * re-exports the public surface and houses small formatting helpers
 * (`truncate`, `formatDimension`, `getPlacementErrorMessage`,
 * `validateLayoutIntegrity`) that don't belong with the heavier
 * validators. `clamp` is re-exported from `./math` for back-compat.
 *
 * Sibling modules:
 *   - `validationGuards`     — type guards + raw shape interfaces
 *   - `validationPlacement`  — `canPlaceBin` (bounds/height/collision/zones)
 *   - `validationProperties` — `validateCustomProperties`
 *   - `validationImport`     — strict `validateImport`
 *   - `validationSalvage`    — lenient `salvageImport`
 */

import type { Layout, ValidationReason, BlockingInfo } from '@/core/types';
import type { TFunction } from '@/i18n';
import { STAGING_ID } from '@/core/constants';

export { clamp } from './math';
export { isValidDrawer, isValidLayer, isValidBin, isValidCategory } from './validationGuards';
export { canPlaceBin } from './validationPlacement';
export { validateCustomProperties } from './validationProperties';
export {
  validateImport,
  type ValidationSuccess,
  type ValidationFailure,
  type ImportValidationResult,
} from './validationImport';
export {
  salvageImport,
  type SalvageSuccess,
  type SalvageFailure,
  type SalvageResult,
} from './validationSalvage';

/**
 * Validate layout integrity for switching.
 * Checks that all bins reference valid layers and categories.
 * This is a lighter check than full import validation, used before switching layouts.
 */
export function validateLayoutIntegrity(layout: Layout): { valid: boolean; error?: string } {
  const layerIds = new Set(layout.layers.map((l) => l.id));
  const categoryIds = new Set(layout.categories.map((c) => c.id));

  for (const bin of layout.bins) {
    // Check layer reference (staging is always valid)
    if (bin.layerId !== STAGING_ID && !layerIds.has(bin.layerId)) {
      return { valid: false, error: `Bin "${bin.label || bin.id}" references missing layer` };
    }
    // Check category reference (category is optional, only validate if present)
    if (bin.category && !categoryIds.has(bin.category)) {
      return { valid: false, error: `Bin "${bin.label || bin.id}" references missing category` };
    }
  }

  // Check we have at least one layer and category
  if (layout.layers.length === 0) {
    return { valid: false, error: 'Layout has no layers' };
  }
  if (layout.categories.length === 0) {
    return { valid: false, error: 'Layout has no categories' };
  }

  return { valid: true };
}

/**
 * Truncate a string to max length.
 */
export function truncate(str: string, maxLength: number): string {
  return str.slice(0, maxLength);
}

/** Format a dimension value, showing decimals only for fractional values (half-bin mode). */
export function formatDimension(val: number): string {
  return val % 1 === 0 ? val.toString() : val.toFixed(1);
}

/**
 * Maps a placement validation failure to a user-facing translated message.
 * Used by drag interactions and grid overlay to explain why a bin can't be placed.
 */
export function getPlacementErrorMessage(
  t: TFunction,
  reason: ValidationReason,
  blockingInfo?: BlockingInfo
): string {
  if (reason === 'blocked_zone') {
    return blockingInfo
      ? t('grid.blockedByBin', { layer: blockingInfo.layerName })
      : t('grid.blockedZone');
  }
  if (reason === 'collision') {
    return t('grid.collision');
  }
  if (reason === 'invalid_layer') {
    return t('grid.invalidLayer');
  }
  if (reason === 'outside_drawer') {
    return t('grid.outsideDrawerShape');
  }
  return t('grid.outOfBounds');
}
