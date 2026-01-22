import type { Bin, Layout } from '@/core/types';
import { generateId, CONSTRAINTS } from '@/core/constants';
import { getBlockedZones } from './collision';

/**
 * Create a Set of blocked cell keys for O(1) lookup.
 * Key format: "x,y"
 * @param step - Iteration step size (0.5 for half-bin mode, 1 for normal)
 */
function createOccupiedCellSet(
  bins: Bin[],
  layerId: string,
  layout: Layout,
  step: number = 1
): Set<string> {
  const occupied = new Set<string>();

  // Add cells from existing bins on this layer
  for (const bin of bins) {
    if (bin.layerId !== layerId) continue;
    for (let bx = bin.x; bx < bin.x + bin.width; bx += step) {
      for (let by = bin.y; by < bin.y + bin.depth; by += step) {
        occupied.add(`${bx},${by}`);
      }
    }
  }

  // Add cells from blocked zones (bins protruding from lower layers)
  const blockedZones = getBlockedZones(layerId, bins, layout.layers);
  for (const zone of blockedZones) {
    for (let zx = zone.x; zx < zone.x + zone.width; zx += step) {
      for (let zy = zone.y; zy < zone.y + zone.depth; zy += step) {
        occupied.add(`${zx},${zy}`);
      }
    }
  }

  return occupied;
}

/**
 * Check if a rectangle can be placed without hitting occupied cells.
 * @param step - Iteration step size (0.5 for half-bin mode, 1 for normal)
 */
function canPlaceRect(
  x: number,
  y: number,
  width: number,
  depth: number,
  occupied: Set<string>,
  step: number = 1
): boolean {
  for (let bx = x; bx < x + width; bx += step) {
    for (let by = y; by < y + depth; by += step) {
      if (occupied.has(`${bx},${by}`)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Mark cells as occupied after placing a bin.
 * @param step - Iteration step size (0.5 for half-bin mode, 1 for normal)
 */
function markOccupied(
  x: number,
  y: number,
  width: number,
  depth: number,
  occupied: Set<string>,
  step: number = 1
): void {
  for (let bx = x; bx < x + width; bx += step) {
    for (let by = y; by < y + depth; by += step) {
      occupied.add(`${bx},${by}`);
    }
  }
}

/**
 * Fill empty cells with bins of specified size.
 * Skips occupied cells and blocked zones.
 * Optimized: Pre-computes blocked zones and uses Set for O(1) cell lookup.
 * @param halfBinMode - When true, uses 0.5 step for iteration and collision detection
 */
export function fillAllWithSize(
  layout: Layout,
  layerId: string,
  binWidth: number,
  binDepth: number,
  categoryId: string,
  halfBinMode: boolean = false
): { bins: Bin[]; skippedCells: number } {
  const layer = layout.layers.find((l) => l.id === layerId);
  if (!layer) {
    return { bins: [], skippedCells: 0 };
  }

  // Step size for collision detection (0.5 in half-bin mode, 1 in normal)
  const step = halfBinMode ? 0.5 : 1;

  // Pre-compute occupied cells (existing bins + blocked zones)
  const occupied = createOccupiedCellSet(layout.bins, layerId, layout, step);

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

      // O(1) check for each cell in the bin footprint
      if (canPlaceRect(x, y, binWidth, binDepth, occupied, step)) {
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
        // Mark these cells as occupied for subsequent iterations
        markOccupied(x, y, binWidth, binDepth, occupied, step);
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
 * Optimized: Pre-computes blocked zones and uses Set for O(1) cell lookup.
 * @param halfBinMode - When true, uses 0.5 step for iteration and collision detection
 */
export function fillGaps(
  layout: Layout,
  layerId: string,
  categoryId: string,
  maxPrintSize: number,
  halfBinMode: boolean = false
): { bins: Bin[]; addedCount: number } {
  const layer = layout.layers.find((l) => l.id === layerId);
  if (!layer) {
    return { bins: [], addedCount: 0 };
  }

  // Step size for iteration and collision detection (0.5 in half-bin mode, 1 in normal)
  const step = halfBinMode ? 0.5 : 1;
  const minSize = halfBinMode ? 0.5 : 1;

  // Pre-compute occupied cells (existing bins + blocked zones)
  const occupied = createOccupiedCellSet(layout.bins, layerId, layout, step);

  const newBins: Bin[] = [];

  // Generate sizes sorted by area (largest first)
  // In half-bin mode, include 0.5 increment sizes
  const sizes: Array<{ w: number; d: number }> = [];
  for (let w = maxPrintSize; w >= minSize; w -= step) {
    for (let d = maxPrintSize; d >= minSize; d -= step) {
      sizes.push({ w, d });
    }
  }
  sizes.sort((a, b) => b.w * b.d - a.w * a.d);

  let changed = true;
  while (changed && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS) {
    changed = false;

    for (
      let y = 0;
      y < layout.drawer.depth && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS;
      y += step
    ) {
      for (
        let x = 0;
        x < layout.drawer.width && newBins.length < CONSTRAINTS.QUICK_FILL_MAX_BINS;
        x += step
      ) {
        for (const size of sizes) {
          // Bounds check
          if (x + size.w > layout.drawer.width || y + size.d > layout.drawer.depth) {
            continue;
          }

          // O(1) check for each cell in the bin footprint
          if (canPlaceRect(x, y, size.w, size.d, occupied, step)) {
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
            // Mark these cells as occupied
            markOccupied(x, y, size.w, size.d, occupied, step);
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
