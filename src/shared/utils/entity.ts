import type { Layout, Bin, BinId } from '@/core/types';

/**
 * Find a bin by ID in the layout.
 * @param layout - The layout containing bins
 * @param id - The bin ID to find
 * @returns The bin if found, undefined otherwise
 */
export function findBinById(layout: Layout, id: BinId): Bin | undefined {
  return layout.bins.find((b) => b.id === id);
}

/**
 * Find multiple bins by their IDs.
 * Filters out undefined results for IDs that don't match any bin.
 * @param layout - The layout containing bins
 * @param ids - Array of bin IDs to find
 * @returns Array of found bins (in the same order as input IDs, excluding missing)
 */
export function findBinsByIds(layout: Layout, ids: BinId[]): Bin[] {
  if (ids.length === 0) return [];
  const byId = new Map<BinId, Bin>();
  for (const bin of layout.bins) {
    if (!byId.has(bin.id)) byId.set(bin.id, bin);
  }
  const found: Bin[] = [];
  for (const id of ids) {
    const bin = byId.get(id);
    if (bin) found.push(bin);
  }
  return found;
}
