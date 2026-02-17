import type { Bin, Layer } from '@/core/types';

/**
 * Result of calculating layer auto-expansion needed before adding a new layer.
 */
export interface LayerAutoExpansionResult {
  /** Whether expansion is needed */
  needsExpansion: boolean;
  /** The new height to set for the top layer (only if needsExpansion is true) */
  newHeight?: number;
  /** Whether expansion would exceed drawer capacity */
  wouldExceedCapacity: boolean;
  /** The smallest bin height that exceeds layer height (for error messages) */
  smallestExceedingHeight?: number;
}

/**
 * Calculate if the top layer needs to be expanded before adding a new layer.
 *
 * Uses the SMALLEST bin height that exceeds the layer height (not the tallest).
 * This preserves intentionally tall bins that are meant to span multiple layers,
 * while ensuring at least the shortest protruding bins can fit.
 *
 * @param topLayer - The current top layer
 * @param bins - All bins in the layout
 * @param totalLayerHeight - Current sum of all layer heights
 * @param drawerHeight - Maximum drawer height
 * @returns Result indicating if/how to expand the layer
 */
export function calculateLayerAutoExpansion(
  topLayer: Layer,
  bins: Bin[],
  totalLayerHeight: number,
  drawerHeight: number
): LayerAutoExpansionResult {
  // Find bins on the top layer that exceed its height
  const topLayerBins = bins.filter((b) => b.layerId === topLayer.id);
  // Use effective height (bin height + clearance) for protrusion checks,
  // matching how collision detection calculates blocked zones
  const effectiveHeight = (b: Bin) => b.height + (b.clearanceHeight ?? 0);
  const binsExceedingLayer = topLayerBins.filter((b) => effectiveHeight(b) > topLayer.height);

  // No bins exceed layer height - no expansion needed
  if (binsExceedingLayer.length === 0) {
    return {
      needsExpansion: false,
      wouldExceedCapacity: false,
    };
  }

  // Find the smallest effective height that exceeds the layer (not tallest!)
  // This preserves intentionally tall bins while accommodating the shortest protruding ones
  const smallestExceedingHeight = Math.min(...binsExceedingLayer.map(effectiveHeight));
  const heightDeficit = smallestExceedingHeight - topLayer.height;

  // Check if expanding would leave room for new layer (minimum 1 unit)
  const newTotalHeight = totalLayerHeight + heightDeficit + 1;
  if (newTotalHeight > drawerHeight) {
    return {
      needsExpansion: true,
      newHeight: smallestExceedingHeight,
      wouldExceedCapacity: true,
      smallestExceedingHeight,
    };
  }

  return {
    needsExpansion: true,
    newHeight: smallestExceedingHeight,
    wouldExceedCapacity: false,
    smallestExceedingHeight,
  };
}
