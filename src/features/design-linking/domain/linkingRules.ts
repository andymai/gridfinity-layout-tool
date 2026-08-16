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
 * Check if a design fits a bin's footprint, allowing a 90° placement.
 *
 * The isometric preview has always rendered a linked design rotated when the
 * bin's footprint is the design's transpose (`isRotatedPlacement`), so an
 * 11.5×1.5 design genuinely fits a 1.5×11.5 bin — you print it once and drop it
 * in turned. The sync layer used to compare strictly, so swapping a design's
 * width and depth made every linked bin look mismatched and offered to unlink
 * the ones the rotated footprint couldn't be resized into.
 *
 * Height is never interchangeable, and a square footprint is its own transpose,
 * so both fall out of the plain comparison.
 */
export function dimensionsFitAllowingRotation(
  a: SyncableDimensions,
  b: SyncableDimensions,
  tolerance = DIMENSION_TOLERANCE
): boolean {
  return (
    dimensionsMatch(a, b, tolerance) ||
    dimensionsMatch(a, { width: b.depth, depth: b.width, height: b.height }, tolerance)
  );
}

/** Stable key for a dimension triple, used to remember a declined sync. */
export function syncDeclineKey(d: SyncableDimensions): string {
  return `${d.width}x${d.depth}x${d.height}`;
}

/**
 * Compare dimensions and identify which ones differ.
 *
 * `matched` is the "does this design fit the bin" verdict and so allows a 90°
 * placement; `differences` stays a literal per-axis report, because it
 * drives the dialog's read-out of what actually changed.
 */
export function compareDimensions(
  design: SyncableDimensions,
  bin: SyncableDimensions
): DimensionComparison {
  return {
    matched: dimensionsFitAllowingRotation(design, bin),
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
