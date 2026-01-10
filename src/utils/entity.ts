import type { Layout, Bin, Layer, Category } from '../types';

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
 * Find a layer by ID in the layout.
 * @param layout - The layout containing layers
 * @param id - The layer ID to find
 * @returns The layer if found, undefined otherwise
 */
export function findLayerById(layout: Layout, id: string): Layer | undefined {
  return layout.layers.find(l => l.id === id);
}

/**
 * Find a category by ID in the layout.
 * @param layout - The layout containing categories
 * @param id - The category ID to find
 * @returns The category if found, undefined otherwise
 */
export function findCategoryById(layout: Layout, id: string): Category | undefined {
  return layout.categories.find(c => c.id === id);
}

/**
 * Find the index of a layer by ID.
 * @param layout - The layout containing layers
 * @param id - The layer ID to find
 * @returns The index if found, -1 otherwise
 */
export function findLayerIndex(layout: Layout, id: string): number {
  return layout.layers.findIndex(l => l.id === id);
}

/**
 * Get all bins on a specific layer.
 * @param layout - The layout containing bins
 * @param layerId - The layer ID to filter by
 * @returns Array of bins on the specified layer
 */
export function getBinsByLayerId(layout: Layout, layerId: string): Bin[] {
  return layout.bins.filter(b => b.layerId === layerId);
}

/**
 * Get all bins with a specific category.
 * @param layout - The layout containing bins
 * @param categoryId - The category ID to filter by
 * @returns Array of bins with the specified category
 */
export function getBinsByCategoryId(layout: Layout, categoryId: string): Bin[] {
  return layout.bins.filter(b => b.category === categoryId);
}
