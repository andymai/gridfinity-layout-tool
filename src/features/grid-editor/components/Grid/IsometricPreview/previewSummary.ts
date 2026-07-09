import { STAGING_ID } from '@/core/constants';
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
  // Staging bins live in the off-grid stash and are not rendered in the 3D
  // preview, so they must not be counted in its description.
  const placedBinCount = layout.bins.reduce(
    (count, bin) => (bin.layerId === STAGING_ID ? count : count + 1),
    0
  );

  return {
    isEmpty: placedBinCount === 0,
    binCount: placedBinCount,
    layerCount: layout.layers.length,
    drawerWidth: layout.drawer.width,
    drawerDepth: layout.drawer.depth,
  };
}
