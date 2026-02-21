/**
 * Layout preview computation.
 *
 * Extracted to its own module to avoid circular dependencies between
 * LayoutManager and SnapshotService (both need preview computation,
 * while LayoutManager also imports from SnapshotService).
 */

import { getGridBins } from '@/shared/utils/bins';
import type { Layout, LayoutPreview, ThumbnailBin } from '@/core/types';

/**
 * Compute a compact preview summary of a layout.
 *
 * Includes binMap for thumbnail rendering (top-down view of all bins).
 *
 * This is the canonical implementation - use this instead of duplicating
 * preview computation logic elsewhere.
 */
export function computePreview(layout: Layout): LayoutPreview {
  const categoryColors = new Map<string, string>();
  for (const cat of layout.categories) {
    categoryColors.set(cat.id, cat.color);
  }

  const binMap: ThumbnailBin[] = getGridBins(layout.bins).map((bin) => ({
    x: bin.x,
    y: bin.y,
    w: bin.width,
    d: bin.depth,
    c: categoryColors.get(bin.category) || '#6B7280',
    l: bin.label || undefined, // Include label if present
  }));

  return {
    drawerWidth: layout.drawer.width,
    drawerDepth: layout.drawer.depth,
    drawerHeight: layout.drawer.height,
    binCount: layout.bins.length,
    layerCount: layout.layers.length,
    binMap,
  };
}
