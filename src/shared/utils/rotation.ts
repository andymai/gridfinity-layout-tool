import { canPlaceBin } from '@/shared/utils/validation';
import { findNearbyValidPosition } from '@/shared/utils/position';
import type { Bin, Layout } from '@/core/types';

/**
 * Result of rotation validation.
 * - `valid: true` with no `movedTo`: rotation works at current position
 * - `valid: true` with `movedTo`: rotation requires moving bin to new position
 * - `valid: false`: rotation not possible
 */
export type RotationResult =
  | { valid: true; movedTo?: { x: number; y: number; distance: number } }
  | { valid: false; message: string };

/**
 * Validate whether a bin can be rotated at its current position.
 * This is the basic validation - checks if rotation works in place.
 *
 * @param bin - The bin to rotate
 * @param layout - Current layout
 * @returns Validation result with error message if invalid
 */
export function validateRotationInPlace(bin: Bin, layout: Layout): RotationResult {
  const rotatedRect = {
    x: bin.x,
    y: bin.y,
    width: bin.depth,
    depth: bin.width,
    height: bin.height,
    clearanceHeight: bin.clearanceHeight,
  };

  const validation = canPlaceBin(rotatedRect, bin.layerId, layout, bin.id);

  if (!validation.valid) {
    let message = 'Cannot rotate bin';
    switch (validation.reason) {
      case 'exceeds_width':
      case 'exceeds_depth':
      case 'out_of_bounds':
        message = 'Cannot rotate: bin would exceed drawer bounds';
        break;
      case 'collision':
        message = 'Cannot rotate: would collide with another bin';
        break;
      case 'blocked_zone':
        message = 'Cannot rotate: space is blocked by a bin below';
        break;
      case 'outside_drawer':
        message = 'Cannot rotate: bin would leave the drawer shape';
        break;
    }
    return { valid: false, message };
  }

  return { valid: true };
}

/**
 * Validate whether a bin can be rotated, with smart fallback positioning.
 * First tries rotation in place, then searches nearby positions if that fails.
 *
 * This is the primary rotation validation used by keyboard shortcuts, inspector
 * buttons, and context menus to ensure consistent behavior.
 *
 * @param bin - The bin to rotate
 * @param layout - Current layout
 * @param maxSearchDistance - Maximum cells to search for valid position (default: 3)
 * @returns Validation result, optionally with new position if relocation needed
 */
export function validateRotation(bin: Bin, layout: Layout, maxSearchDistance = 3): RotationResult {
  // First, try rotation in place
  const inPlaceResult = validateRotationInPlace(bin, layout);

  if (inPlaceResult.valid) {
    return { valid: true }; // No position change needed
  }

  // Rotation failed in place - search for nearby valid position
  const rotatedWidth = bin.depth;
  const rotatedDepth = bin.width;

  const nearbyPos = findNearbyValidPosition(
    { x: bin.x, y: bin.y },
    rotatedWidth,
    rotatedDepth,
    bin.height,
    bin.layerId,
    layout,
    bin.id,
    maxSearchDistance,
    bin.clearanceHeight
  );

  if (nearbyPos) {
    return {
      valid: true,
      movedTo: nearbyPos,
    };
  }

  // No valid position found anywhere - return the original error
  return inPlaceResult;
}
