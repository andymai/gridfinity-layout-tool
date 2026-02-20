/**
 * Compute proportional pixel heights for layers + unused space.
 *
 * Layers are the primary content and get allocated first. Unused space
 * is a passive indicator that gets whatever remains, capped so it never
 * dominates the visual hierarchy.
 */
export function computeProportionalHeights(
  layerHeights: number[],
  unusedHeight: number,
  containerPx: number,
  minPx: number,
  gapPx: number = 0
): { layerPxHeights: number[]; unusedPx: number } {
  const layerCount = layerHeights.length;

  if (layerCount === 0) {
    return { layerPxHeights: [], unusedPx: 0 };
  }

  const hasUnused = unusedHeight > 0;
  const segmentCount = layerCount + (hasUnused ? 1 : 0);

  // Subtract inter-segment gaps from available space
  const availablePx = Math.max(0, containerPx - (segmentCount - 1) * gapPx);

  // Reserve space for unused row: a small fixed portion, never more than 30%
  // of available space and never less than minPx (when present)
  const maxUnusedPx = Math.round(availablePx * 0.3);
  const unusedPx = hasUnused ? Math.min(minPx, maxUnusedPx) : 0;

  // Remaining space goes entirely to layers
  const layerAvailablePx = availablePx - unusedPx;

  // Distribute among layers proportionally with minimum guarantee
  const results = layerHeights.map(() => minPx);
  const surplusPx = Math.max(0, layerAvailablePx - layerCount * minPx);

  const totalLayerUnits = layerHeights.reduce((sum, h) => sum + h, 0);
  if (surplusPx > 0 && totalLayerUnits > 0) {
    let distributed = 0;
    for (let i = 0; i < layerCount; i++) {
      const share = Math.round((layerHeights[i] / totalLayerUnits) * surplusPx);
      results[i] += share;
      distributed += share;
    }
    // Assign any rounding remainder to the last layer
    results[layerCount - 1] += surplusPx - distributed;
  }

  return { layerPxHeights: results, unusedPx };
}
