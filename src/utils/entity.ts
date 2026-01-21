import type { Layout, Bin } from '@/core/types';

/**
 * Find a bin by ID in the layout.
 * @param layout - The layout containing bins
 * @param id - The bin ID to find
 * @returns The bin if found, undefined otherwise
 */
export function findBinById(layout: Layout, id: string): Bin | undefined {
  return layout.bins.find(b => b.id === id);
}

/**
 * Find multiple bins by their IDs.
 * Filters out undefined results for IDs that don't match any bin.
 * @param layout - The layout containing bins
 * @param ids - Array of bin IDs to find
 * @returns Array of found bins (in the same order as input IDs, excluding missing)
 */
export function findBinsByIds(layout: Layout, ids: string[]): Bin[] {
  return ids
    .map(id => layout.bins.find(b => b.id === id))
    .filter((b): b is Bin => b !== undefined);
}
