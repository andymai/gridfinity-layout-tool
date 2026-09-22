import type { Layout, LayoutEntry } from '@/core/types';
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

/**
 * A share id is usually its layout's id, but a layout that re-shared under a
 * fresh id holds the share's id in `cloudShare.id`.
 */
export function isOwnedShare(entries: readonly LayoutEntry[], shareId: string): boolean {
  return entries.some((entry) => entry.id === shareId || entry.cloudShare?.id === shareId);
}
