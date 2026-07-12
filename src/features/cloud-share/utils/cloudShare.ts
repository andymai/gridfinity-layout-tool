/**
 * Shared utilities for cloud sharing functionality.
 * Used by both CloudShareTab and MobileCloudSharePanel.
 */

import type { Layout } from '@/core/types';
import { getGridBins } from '@/shared/utils';

/**
 * Format a timestamp as a localized date string.
 */
export function formatShareDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Create a fingerprint string for a layout to detect changes.
 * Excludes staging bins since they shouldn't be synced.
 */
export function createLayoutFingerprint(layout: Layout): string {
  return JSON.stringify({
    bins: getGridBins(layout.bins),
    layers: layout.layers,
    categories: layout.categories,
    drawer: layout.drawer,
    name: layout.name,
    purpose: layout.purpose,
    printBedSize: layout.printBedSize,
    printBedDepth: layout.printBedDepth,
    gridUnitMm: layout.gridUnitMm,
    heightUnitMm: layout.heightUnitMm,
    magnetAnchor: layout.magnetAnchor,
  });
}
