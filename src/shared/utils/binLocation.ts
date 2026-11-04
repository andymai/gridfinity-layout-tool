import { STAGING_ID } from '@/core/constants';
import { planBinTurn, type BinTurnPlan } from './rotation';
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

  /** Whether the bin's dimensions can be changed (false while size-locked) */
  canResize: boolean;

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
  const canResize = !isBinLocked(bin);

  if (bin.layerId === STAGING_ID) {
    return {
      location: 'stash',
      canRotate: canResize, // No collision checks needed
      canResize,
      canMoveToStash: false, // Already in stash
      canEdit: true, // All properties editable
      requiresPlacementValidation: false, // No bounds/collision constraints
      label: 'Stash',
    };
  }

  return {
    location: 'grid',
    canRotate: canResize, // Requires validation
    canResize,
    canMoveToStash: true, // Can be moved to stash
    canEdit: true, // All properties editable
    requiresPlacementValidation: true, // Must check bounds/collisions
    label: 'Grid',
  };
}

/**
 * What the next press of Rotate does to a bin. Stash bins have no spatial
 * constraints to meet.
 */
export function planBinRotation(bin: Bin, layout: Layout): BinTurnPlan {
  return planBinTurn(bin, layout, getBinLocationContext(bin).requiresPlacementValidation);
}

/**
 * Check if a bin's size is locked.
 *
 * A locked bin can still be moved, restyled and relabelled — only its
 * dimensions are frozen. `bin.update` is the enforcing choke point; this
 * predicate is what UI and cascade code use to stay out of its way.
 */
export function isBinLocked(bin: Pick<Bin, 'locked'>): boolean {
  return bin.locked === true;
}

export function isBinInStash(bin: Bin): boolean {
  return bin.layerId === STAGING_ID;
}

export function isBinOnGrid(bin: Bin): boolean {
  return bin.layerId !== STAGING_ID;
}
