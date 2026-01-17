import type { Bin, Layer, Category, Drawer } from '../core/types';
import type { BinListSortOrder, BinSortField } from '../core/store/settings';
import { STAGING_ID } from '../core/constants';

/**
 * Filter bins to only include those on the specified layers.
 * Excludes staging bins.
 */
export function getVisibleBinsForPrint(bins: Bin[], layerIds: string[]): Bin[] {
  return bins.filter(
    (bin) => bin.layerId !== STAGING_ID && layerIds.includes(bin.layerId)
  );
}

/**
 * Get layers that are selected for printing.
 */
export function getVisibleLayers(layers: Layer[], layerIds: string[]): Layer[] {
  return layers.filter((layer) => layerIds.includes(layer.id));
}

/**
 * Get categories that are used by the visible bins.
 */
export function getUsedCategories(bins: Bin[], categories: Category[]): Category[] {
  const usedCategoryIds = new Set(bins.map((bin) => bin.category));
  return categories.filter((category) => usedCategoryIds.has(category.id));
}

/**
 * Format drawer dimensions for display.
 * Returns "10x8 (420x336 mm)" format.
 */
export function formatDrawerDimensions(
  drawer: Drawer,
  gridUnitMm: number
): string {
  const widthMm = Math.round(drawer.width * gridUnitMm);
  const depthMm = Math.round(drawer.depth * gridUnitMm);
  return `${drawer.width}x${drawer.depth} (${widthMm}x${depthMm} mm)`;
}

/**
 * Format current date for print header.
 */
export function formatPrintDate(): string {
  return new Date().toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Get bin count per layer for display.
 */
export function getBinCountByLayer(
  bins: Bin[],
  layers: Layer[]
): Map<string, number> {
  const counts = new Map<string, number>();

  // Initialize all layers to 0
  for (const layer of layers) {
    counts.set(layer.id, 0);
  }

  // Count bins per layer (excluding staging)
  for (const bin of bins) {
    if (bin.layerId !== STAGING_ID) {
      const current = counts.get(bin.layerId) ?? 0;
      counts.set(bin.layerId, current + 1);
    }
  }

  return counts;
}

/**
 * Compare function for a single sort field.
 */
function compareByField(
  a: Bin,
  b: Bin,
  field: BinSortField,
  categories: Category[],
  layers: Layer[]
): number {
  switch (field) {
    case 'category': {
      const catA = categories.find((c) => c.id === a.category)?.name ?? '';
      const catB = categories.find((c) => c.id === b.category)?.name ?? '';
      return catA.localeCompare(catB);
    }
    case 'layer': {
      const layerA = layers.find((l) => l.id === a.layerId)?.name ?? '';
      const layerB = layers.find((l) => l.id === b.layerId)?.name ?? '';
      return layerA.localeCompare(layerB);
    }
    case 'position': {
      // Sort by Y descending (top first), then X ascending (left first)
      if (a.y !== b.y) return b.y - a.y;
      return a.x - b.x;
    }
    case 'size': {
      // Sort by area descending (larger first)
      const areaA = a.width * a.depth;
      const areaB = b.width * b.depth;
      return areaB - areaA;
    }
    case 'height': {
      // Sort by height descending (taller first)
      return b.height - a.height;
    }
    case 'label': {
      // Sort alphabetically by label
      const labelA = a.label || '';
      const labelB = b.label || '';
      return labelA.localeCompare(labelB);
    }
    default:
      return 0;
  }
}

/**
 * Sort bins based on the configured sort order.
 * Applies enabled sort fields in order of priority (top = primary).
 */
export function sortBinsForPrint(
  bins: Bin[],
  sortOrder: BinListSortOrder,
  categories: Category[],
  layers: Layer[]
): Bin[] {
  // Get only enabled sort fields in order
  const enabledFields = sortOrder.filter((s) => s.enabled).map((s) => s.field);

  if (enabledFields.length === 0) {
    // No sorting - return original order
    return [...bins];
  }

  return [...bins].sort((a, b) => {
    for (const field of enabledFields) {
      const result = compareByField(a, b, field, categories, layers);
      if (result !== 0) return result;
    }
    return 0;
  });
}
