/**
 * Sync operations - pure transformation functions for dimension sync.
 *
 * No side effects, no external dependencies (except types).
 * These functions transform data but don't perform the actual updates.
 */

import type { Bin } from '@/core/types';
import { gridUnits, heightUnits } from '@/core/types';
import type { BinParams } from '@/features/bin-designer';
import type { SyncableDimensions } from '../types';

// Dimension Extraction

/**
 * Extract syncable dimensions from a layout bin.
 */
export function extractBinDimensions(bin: Bin): SyncableDimensions {
  return {
    width: bin.width,
    depth: bin.depth,
    height: bin.height,
  };
}

/**
 * Extract syncable dimensions from bin designer params.
 */
export function extractDesignDimensions(params: BinParams): SyncableDimensions {
  return {
    width: params.width,
    depth: params.depth,
    height: params.height,
  };
}

// Update Object Creation

/**
 * Create a bin update object for syncing dimensions from a design.
 * Returns only the fields that should be updated.
 */
export function createBinSyncUpdate(dimensions: SyncableDimensions): Partial<Bin> {
  return {
    width: gridUnits(dimensions.width),
    depth: gridUnits(dimensions.depth),
    height: heightUnits(dimensions.height),
  };
}

// Dimension Formatting

/**
 * Format a single dimension value, showing decimals only if fractional.
 */
export function formatDimension(value: number): string {
  return value % 1 === 0 ? value.toString() : value.toFixed(1);
}

/**
 * Format dimensions as a display string.
 * Example: "2×3×4" or "2.5×3×4"
 */
export function formatDimensions(dims: SyncableDimensions): string {
  return `${formatDimension(dims.width)}×${formatDimension(dims.depth)}×${formatDimension(dims.height)}`;
}

/**
 * Format a single dimension change for display.
 * Example: "2 → 3" or "2.5 → 3"
 */
export function formatDimensionChange(from: number, to: number): string {
  return `${formatDimension(from)} → ${formatDimension(to)}`;
}
