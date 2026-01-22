/**
 * Bin filtering utilities.
 * Consolidates common patterns for filtering bins by location (grid/staging)
 * and layer membership.
 */

import { STAGING_ID } from '@/core/constants';
import type { Bin } from '@/core/types';

/**
 * Options for filtering visible bins.
 */
export interface VisibleBinsOptions {
  /**
   * If provided, only include bins on these specific layer IDs.
   * Always excludes staging bins regardless of whether STAGING_ID is in the array.
   */
  layerIds?: string[];

  /**
   * If true, include staging bins in results.
   * @default false
   */
  includeStaging?: boolean;
}

/**
 * Get bins that are visible based on layer and staging filters.
 * This is the consolidated filtering function for all bin visibility logic.
 *
 * @param bins - All bins to filter
 * @param options - Filter options (layer IDs, staging inclusion)
 * @returns Filtered array of bins
 *
 * @example
 * // Get all bins on the grid (excluding staging)
 * const gridBins = getVisibleBins(bins);
 *
 * @example
 * // Get bins on specific layers (excluding staging)
 * const layerBins = getVisibleBins(bins, { layerIds: ['layer-1', 'layer-2'] });
 *
 * @example
 * // Get only staging bins
 * const stagingBins = getVisibleBins(bins, { includeStaging: true, layerIds: [STAGING_ID] });
 *
 * @example
 * // Get all bins including staging
 * const allBins = getVisibleBins(bins, { includeStaging: true });
 */
export function getVisibleBins(bins: Bin[], options: VisibleBinsOptions = {}): Bin[] {
  const { layerIds, includeStaging = false } = options;

  return bins.filter((bin) => {
    // Handle staging filter
    const isStaging = bin.layerId === STAGING_ID;

    if (isStaging) {
      // If includeStaging is true and no layerIds specified, include all staging
      // If layerIds specified and includes STAGING_ID, include staging
      // Otherwise exclude staging
      if (!includeStaging) return false;
      if (layerIds && !layerIds.includes(STAGING_ID)) return false;
      return true;
    }

    // Non-staging bins: check layer filter if provided
    if (layerIds !== undefined) {
      // Empty array means "no layers selected" - return nothing
      if (layerIds.length === 0) return false;
      return layerIds.includes(bin.layerId);
    }

    // No layer filter - include all non-staging bins
    return true;
  });
}

/**
 * Get all bins that are on the grid (not in staging).
 * Convenience function for the most common filtering pattern.
 *
 * @param bins - All bins to filter
 * @returns Bins on the grid (layerId !== STAGING_ID)
 *
 * @example
 * const gridBins = getGridBins(layout.bins);
 */
export function getGridBins(bins: Bin[]): Bin[] {
  return bins.filter((bin) => bin.layerId !== STAGING_ID);
}

/**
 * Get all bins that are in staging (the stash).
 * Convenience function for staging-specific filtering.
 *
 * @param bins - All bins to filter
 * @returns Bins in staging (layerId === STAGING_ID)
 *
 * @example
 * const stagingBins = getStagingBins(layout.bins);
 */
export function getStagingBins(bins: Bin[]): Bin[] {
  return bins.filter((bin) => bin.layerId === STAGING_ID);
}

/**
 * Get bins on a specific layer (excluding staging).
 * Convenience function for single-layer filtering.
 *
 * @param bins - All bins to filter
 * @param layerId - The layer ID to filter by
 * @returns Bins on the specified layer
 *
 * @example
 * const layerBins = getLayerBins(layout.bins, activeLayerId);
 */
export function getLayerBins(bins: Bin[], layerId: string): Bin[] {
  return bins.filter((bin) => bin.layerId === layerId && bin.layerId !== STAGING_ID);
}

/**
 * Split bins into grid and staging groups.
 * Useful when you need both sets and want to avoid filtering twice.
 *
 * @param bins - All bins to split
 * @returns Object with gridBins and stagingBins arrays
 *
 * @example
 * const { gridBins, stagingBins } = splitBinsByLocation(layout.bins);
 */
export function splitBinsByLocation(bins: Bin[]): {
  gridBins: Bin[];
  stagingBins: Bin[];
} {
  const gridBins: Bin[] = [];
  const stagingBins: Bin[] = [];

  for (const bin of bins) {
    if (bin.layerId === STAGING_ID) {
      stagingBins.push(bin);
    } else {
      gridBins.push(bin);
    }
  }

  return { gridBins, stagingBins };
}
