import type { Bin, Layout } from '../types';
import { generateId, CONSTRAINTS } from '../constants';
import { canPlaceBin } from './validation';

/**
 * Fill empty cells with bins of specified size.
 * Skips occupied cells and blocked zones.
 */
export function fillAllWithSize(
  layout: Layout,
  layerId: string,
  binWidth: number,
  binDepth: number,
  categoryId: string
): { bins: Bin[]; skippedCells: number } {
  const layer = layout.layers.find(l => l.id === layerId);
  if (!layer) {
    return { bins: [], skippedCells: 0 };
  }

  const newBins: Bin[] = [];
  let skippedCells = 0;

  for (let y = 0; y < layout.drawer.depth; y += binDepth) {
    for (let x = 0; x < layout.drawer.width; x += binWidth) {
      if (newBins.length >= CONSTRAINTS.QUICK_FILL_MAX_BINS) {
        break;
      }

      // Skip if the full bin size doesn't fit within drawer bounds
      if (x + binWidth > layout.drawer.width || y + binDepth > layout.drawer.depth) {
        skippedCells++;
        continue;
      }

      const tempLayout: Layout = {
        ...layout,
        bins: [...layout.bins, ...newBins],
      };

      const result = canPlaceBin(
        { x, y, width: binWidth, depth: binDepth, height: layer.height },
        layerId,
        tempLayout
      );

      if (result.valid) {
        const newBin: Bin = {
          id: generateId(),
          layerId,
          x,
          y,
          width: binWidth,
          depth: binDepth,
          height: layer.height,
          category: categoryId,
          label: '',
          notes: '',
        };
        newBins.push(newBin);
      } else {
        skippedCells++;
      }
    }
  }

  return { bins: newBins, skippedCells };
}

/**
 * Fill gaps with optimally-sized bins.
 * Tries to use bins that don't require splitting.
 */
export function fillGaps(
  layout: Layout,
  layerId: string,
  categoryId: string,
  maxPrintSize: number
): { bins: Bin[]; addedCount: number } {
  const layer = layout.layers.find(l => l.id === layerId);
  if (!layer) {
    return { bins: [], addedCount: 0 };
  }

  const newBins: Bin[] = [];
  const workingLayout = { ...layout };

  const sizes: Array<{ w: number; d: number }> = [];
  for (let w = maxPrintSize; w >= 1; w--) {
    for (let d = maxPrintSize; d >= 1; d--) {
      sizes.push({ w, d });
    }
  }
  sizes.sort((a, b) => (b.w * b.d) - (a.w * a.d));

  let changed = true;
  while (changed && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS) {
    changed = false;

    for (let y = 0; y < layout.drawer.depth && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS; y++) {
      for (let x = 0; x < layout.drawer.width && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS; x++) {
        for (const size of sizes) {
          const tempLayout: Layout = {
            ...workingLayout,
            bins: [...workingLayout.bins, ...newBins],
          };

          const result = canPlaceBin(
            { x, y, width: size.w, depth: size.d, height: layer.height },
            layerId,
            tempLayout
          );

          if (result.valid) {
            newBins.push({
              id: generateId(),
              layerId,
              x,
              y,
              width: size.w,
              depth: size.d,
              height: layer.height,
              category: categoryId,
              label: '',
              notes: '',
            });
            changed = true;
            break; // Move to next position
          }
        }
      }
    }
  }

  return { bins: newBins, addedCount: newBins.length };
}

/**
 * Get coverage percentage for a layer.
 */
export function getLayerCoverage(layout: Layout, layerId: string): number {
  const totalCells = layout.drawer.width * layout.drawer.depth;
  if (totalCells === 0) return 0;

  let coveredCells = 0;
  for (const bin of layout.bins) {
    if (bin.layerId === layerId) {
      coveredCells += bin.width * bin.depth;
    }
  }

  return Math.round((coveredCells / totalCells) * 100);
}
