import type { Layout } from '@/core/types';

/**
 * Interpolation values for the screen-reader description of the 3D preview.
 * The WebGL canvas is opaque to assistive tech, so this feeds a visually
 * hidden text alternative that conveys the same gestalt (how full the drawer
 * is, how many layers, how big the grid). Describes the whole layout rather
 * than the currently-rendered layer subset so the overview stays stable.
 */
export interface PreviewSummary {
  isEmpty: boolean;
  binCount: number;
  layerCount: number;
  drawerWidth: number;
  drawerDepth: number;
}

export function getPreviewSummary(
  layout: Pick<Layout, 'bins' | 'layers' | 'drawer'>
): PreviewSummary {
  return {
    isEmpty: layout.bins.length === 0,
    binCount: layout.bins.length,
    layerCount: layout.layers.length,
    drawerWidth: layout.drawer.width,
    drawerDepth: layout.drawer.depth,
  };
}
