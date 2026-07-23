import type { GridUnits, HeightUnits } from '@gridfinity/branded-types';
/**
 * Simplified bin data for thumbnail rendering.
 * Compact representation to minimize storage.
 */
export interface ThumbnailBin {
  x: GridUnits; // Grid position
  y: GridUnits;
  w: GridUnits; // Width in grid units
  d: GridUnits; // Depth in grid units
  c: string; // Category color (hex)
  l?: string; // Optional label (truncated if needed)
}

/**
 * Preview data cached in library entry for display without loading full layout.
 */
export interface LayoutPreview {
  drawerWidth: GridUnits;
  drawerDepth: GridUnits;
  drawerHeight: HeightUnits;
  binCount: number;
  layerCount: number;
  /** Simplified bin positions for thumbnail (top-down view, all layers merged) */
  binMap?: ThumbnailBin[];
}
