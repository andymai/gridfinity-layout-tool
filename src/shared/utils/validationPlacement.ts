/**
 * Placement validation: can a bin go where the user wants it?
 *
 * `canPlaceBin` is the single source of truth used by:
 *   - drag/drop interactions (live preview)
 *   - import / salvage validators (dry-run before commit)
 *   - draw/resize tools (highlight invalid drops)
 *
 * Returns a discriminated `ValidationResult` so callers can route on the
 * specific failure (`out_of_bounds`, `collision`, `blocked_zone`, etc.)
 * and translate to a user-facing message via `getPlacementErrorMessage`.
 */

import type {
  Bin,
  HeightUnits,
  Layout,
  ValidationResult,
  Rect,
  BinId,
  LayerId,
} from '@/core/types';
import { binId as toBinId, categoryId as toCategoryId } from '@/core/types';
import { STAGING_ID } from '@/core/constants';
import { isOk } from '@/core/result';
import {
  binsCollideResult,
  getLayerZStartResult,
  getBlockedZones,
  footprintsOverlap,
} from './collision';

/**
 * Validate if a bin can be placed at the given position.
 * @param excludeBinId - Single bin ID to exclude from collision checks
 * @param excludeBinIds - Set of bin IDs to exclude (for multi-select operations)
 */
export function canPlaceBin(
  rect: Rect & { height: HeightUnits; clearanceHeight?: HeightUnits },
  layerId: LayerId,
  layout: Layout,
  excludeBinId?: BinId,
  excludeBinIds?: Set<BinId>
): ValidationResult {
  const { drawer, layers, bins } = layout;

  // Bounds check
  if (rect.x < 0 || rect.y < 0) {
    return { valid: false, reason: 'out_of_bounds' };
  }
  if (rect.x + rect.width > drawer.width) {
    return { valid: false, reason: 'exceeds_width' };
  }
  if (rect.y + rect.depth > drawer.depth) {
    return { valid: false, reason: 'exceeds_depth' };
  }

  const layer = layers.find((l) => l.id === layerId);
  if (!layer) {
    return { valid: false, reason: 'invalid_layer' };
  }

  // Height check - only validate max height (bin can't exceed drawer)
  // Layer height is a default for new bins, not a constraint for existing bins
  const zStartResult = getLayerZStartResult(layerId, layers);
  if (!isOk(zStartResult)) {
    return { valid: false, reason: 'invalid_layer' };
  }
  const maxHeight = drawer.height - zStartResult.value;
  if (rect.height > maxHeight) {
    return { valid: false, reason: 'exceeds_height' };
  }

  const blockedZones = getBlockedZones(layerId, bins, layers);
  for (const zone of blockedZones) {
    if (footprintsOverlap(rect, zone)) {
      // Find the layer name for the blocking bin
      const sourceLayer = layers.find((l) => l.id === zone.sourceLayerId);
      return {
        valid: false,
        reason: 'blocked_zone',
        blockingInfo: {
          binId: zone.sourceBinId,
          layerId: zone.sourceLayerId,
          layerName: sourceLayer?.name ?? zone.sourceLayerId,
        },
      };
    }
  }

  // Collision check with other bins
  const testBin: Bin = {
    id: excludeBinId ?? toBinId('__test__'),
    layerId,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    depth: rect.depth,
    height: rect.height,
    clearanceHeight: rect.clearanceHeight,
    category: toCategoryId(''),
    label: '',
    notes: '',
  };

  for (const other of bins) {
    // Skip excluded bins (single ID or set of IDs)
    if (other.id === excludeBinId) continue;
    if (excludeBinIds?.has(other.id)) continue;
    if (other.layerId === STAGING_ID) continue;
    const collisionResult = binsCollideResult(testBin, other, layers);
    if (isOk(collisionResult) && collisionResult.value) {
      // Find the layer name for the colliding bin
      const otherLayer = layers.find((l) => l.id === other.layerId);
      return {
        valid: false,
        reason: 'collision',
        blockingInfo: {
          binId: other.id,
          layerId: other.layerId,
          layerName: otherLayer?.name ?? other.layerId,
        },
      };
    }
  }

  return { valid: true };
}
