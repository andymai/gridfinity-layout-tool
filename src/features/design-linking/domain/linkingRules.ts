/**
 * Linking rules - pure validation and constraint functions.
 *
 * No side effects, no external dependencies (except types).
 * All functions are testable in isolation.
 */

import type { SyncableDimensions, DimensionComparison, SyncEligibility } from '../types';
import type { Bin, Layout } from '@/core/types';
import { formatDimension } from './syncOperations';

/** Tolerance for floating-point dimension comparison (half-bin mode uses 0.5 increments) */
const DIMENSION_TOLERANCE = 0.001;

// Dimension Comparison

/**
 * Check if two sets of dimensions match within tolerance.
 */
export function dimensionsMatch(
  a: SyncableDimensions,
  b: SyncableDimensions,
  tolerance = DIMENSION_TOLERANCE
): boolean {
  return (
    Math.abs(a.width - b.width) < tolerance &&
    Math.abs(a.depth - b.depth) < tolerance &&
    Math.abs(a.height - b.height) < tolerance
  );
}

/**
 * Compare dimensions and identify which ones differ.
 */
export function compareDimensions(
  design: SyncableDimensions,
  bin: SyncableDimensions
): DimensionComparison {
  return {
    matched: dimensionsMatch(design, bin),
    design,
    bin,
    differences: {
      width: Math.abs(design.width - bin.width) >= DIMENSION_TOLERANCE,
      depth: Math.abs(design.depth - bin.depth) >= DIMENSION_TOLERANCE,
      height: Math.abs(design.height - bin.height) >= DIMENSION_TOLERANCE,
    },
  };
}

// Sync Eligibility

/**
 * Check if a bin can be synced to new dimensions at its current position.
 * A bin can sync if the new dimensions fit within the drawer and don't collide.
 */
export function checkSyncEligibility(
  bin: Bin,
  newDimensions: SyncableDimensions,
  layout: Layout,
  otherBins: Bin[]
): SyncEligibility {
  const { drawer } = layout;

  // Check bounds
  if (bin.x + newDimensions.width > drawer.width) {
    return { binId: bin.id, canSync: false, blockReason: 'out_of_bounds' };
  }
  if (bin.y + newDimensions.depth > drawer.depth) {
    return { binId: bin.id, canSync: false, blockReason: 'out_of_bounds' };
  }

  // Check collision with other bins on the same layer
  const sameLevelBins = otherBins.filter((b) => b.id !== bin.id && b.layerId === bin.layerId);

  for (const other of sameLevelBins) {
    const overlapsX = bin.x < other.x + other.width && bin.x + newDimensions.width > other.x;
    const overlapsY = bin.y < other.y + other.depth && bin.y + newDimensions.depth > other.y;

    if (overlapsX && overlapsY) {
      return { binId: bin.id, canSync: false, blockReason: 'collision' };
    }
  }

  return { binId: bin.id, canSync: true };
}

/**
 * Check sync eligibility for multiple bins.
 */
export function checkBatchSyncEligibility(
  bins: Bin[],
  newDimensions: SyncableDimensions,
  layout: Layout
): SyncEligibility[] {
  const allBins = layout.bins;
  return bins.map((bin) => checkSyncEligibility(bin, newDimensions, layout, allBins));
}

// Design Name Generation

/**
 * Generate a default design name from dimensions.
 * Format: "2×2×3 Bin"
 */
export function generateDefaultDesignName(dimensions: SyncableDimensions): string {
  return `${formatDimension(dimensions.width)}×${formatDimension(dimensions.depth)}×${formatDimension(dimensions.height)} Bin`;
}
