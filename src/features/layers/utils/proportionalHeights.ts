/**
 * Compute proportional pixel heights for layers + unused space.
 *
 * Two-pass approach:
 *  1. Give every segment the minimum pixel height.
 *  2. Distribute the remaining pixels proportionally by unit height.
 */
export function computeProportionalHeights(
  layerHeights: number[],
  unusedHeight: number,
  containerPx: number,
  minPx: number,
  gapPx: number = 0
): { layerPxHeights: number[]; unusedPx: number } {
  // Build segment list: layers + optional unused space
  const segments = unusedHeight > 0 ? [...layerHeights, unusedHeight] : [...layerHeights];
  const count = segments.length;

  if (count === 0) {
    return { layerPxHeights: [], unusedPx: 0 };
  }

  // Subtract inter-segment gaps from available space
  const availablePx = Math.max(0, containerPx - (count - 1) * gapPx);

  // Pass 1: assign minimum to each segment
  const results = segments.map(() => minPx);
  const surplusPx = Math.max(0, availablePx - count * minPx);

  // Pass 2: distribute surplus proportionally by unit height
  const totalUnits = segments.reduce((sum, h) => sum + h, 0);
  if (surplusPx > 0 && totalUnits > 0) {
    let distributed = 0;
    for (let i = 0; i < count; i++) {
      const share = Math.round((segments[i] / totalUnits) * surplusPx);
      results[i] += share;
      distributed += share;
    }
    // Assign any rounding remainder to the last segment
    results[count - 1] += surplusPx - distributed;
  }

  const layerPxHeights = results.slice(0, layerHeights.length);
  const unusedPx = unusedHeight > 0 ? results[count - 1] : 0;
  return { layerPxHeights, unusedPx };
}
