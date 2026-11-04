import { canPlaceBin } from '@/shared/utils/validation';
import { findNearbyValidPosition } from '@/shared/utils/position';
import { canHalfTurn } from '@/shared/utils/placementTurn';
import type { Bin, GridUnits, Layout } from '@/core/types';

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
  const validation = canPlaceBin(quarterTurnCandidate(bin), bin.layerId, layout, bin.id);

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
    bin.clearanceHeight,
    bin.linkedDesignId
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

/**
 * A quarter turn. Width and depth can show only two of a linked bin's four
 * orientations, so `halfTurned` flips on every second swap. That visits all four,
 * turning the same way each time, without knowing how the design was drawn.
 */
export function quarterTurnUpdates(
  bin: Pick<Bin, 'width' | 'depth' | 'linkedDesignId' | 'pairId' | 'halfTurned'>
): Pick<Bin, 'width' | 'depth' | 'halfTurned'> {
  return {
    width: bin.depth,
    depth: bin.width,
    ...(canHalfTurn(bin) && bin.width < bin.depth ? { halfTurned: !bin.halfTurned } : {}),
  };
}

/**
 * The bin as a quarter turn would leave it, for checking placement. The half turn
 * travels with it, because it decides which way a design's end support reaches.
 */
export function quarterTurnCandidate(bin: Bin) {
  const turned = quarterTurnUpdates(bin);
  return {
    x: bin.x,
    y: bin.y,
    height: bin.height,
    clearanceHeight: bin.clearanceHeight,
    linkedDesignId: bin.linkedDesignId,
    ...turned,
    halfTurned: turned.halfTurned ?? bin.halfTurned,
  };
}

export type BinTurnPlan =
  | {
      readonly valid: true;
      readonly updates: Partial<Pick<Bin, 'x' | 'y' | 'width' | 'depth' | 'halfTurned'>>;
      readonly movedTo?: { x: number; y: number; distance: number };
      /** The footprint stayed put, so nothing on the 2D grid shows that it turned. */
      readonly halfTurnedInPlace?: true;
    }
  | { readonly valid: false; readonly message: string };

function planHalfTurn(bin: Bin, layout: Layout, requiresPlacement: boolean): BinTurnPlan {
  const halfTurned = !bin.halfTurned;
  if (requiresPlacement) {
    // A slant follows the design round, so its end support can land somewhere new.
    const check = canPlaceBin(
      { x: bin.x, y: bin.y, width: bin.width, depth: bin.depth, height: bin.height, halfTurned },
      bin.layerId,
      layout,
      bin.id
    );
    if (!check.valid) return { valid: false, message: 'Cannot rotate bin' };
  }
  return { valid: true, updates: { halfTurned }, halfTurnedInPlace: true };
}

/**
 * What the next press of Rotate does to a bin. A linked bin that has no quarter
 * turn to take (a square footprint, or no room for one) turns half way where it
 * stands instead of moving, because turning a one-sided design round is usually
 * why it was pressed. An unlinked bin looks the same either way round, so it
 * keeps its search for a nearby spot.
 */
export function planBinTurn(bin: Bin, layout: Layout, requiresPlacement: boolean): BinTurnPlan {
  const halfTurnable = canHalfTurn(bin);
  if (halfTurnable && bin.width === bin.depth) return planHalfTurn(bin, layout, requiresPlacement);

  const quarter = quarterTurnUpdates(bin);
  if (!requiresPlacement) return { valid: true, updates: quarter };

  const inPlace = validateRotationInPlace(bin, layout);
  if (inPlace.valid) return { valid: true, updates: quarter };

  if (halfTurnable) {
    const halfTurn = planHalfTurn(bin, layout, requiresPlacement);
    return halfTurn.valid ? halfTurn : inPlace;
  }

  const moved = validateRotation(bin, layout);
  if (!moved.valid) return moved;
  if (!moved.movedTo) return { valid: true, updates: quarter };
  return {
    valid: true,
    movedTo: moved.movedTo,
    updates: {
      ...quarter,
      x: moved.movedTo.x as GridUnits,
      y: moved.movedTo.y as GridUnits,
    },
  };
}
