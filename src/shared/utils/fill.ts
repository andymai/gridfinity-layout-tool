import type { Bin, GridUnits, Layout, LayerId, CategoryId } from '@/core/types';
import { generateBinId, CONSTRAINTS } from '@/core/constants';
import { getBlockedZones } from './collision';

/**
 * Create a Set of blocked cell keys for O(1) lookup.
 * Key format: "x,y"
 * @param step - Iteration step size (0.5 for half-bin mode, 1 for normal)
 */
function createOccupiedCellSet(
  bins: Bin[],
  layerId: LayerId,
  layout: Layout,
  step: number = 1
): Set<string> {
  const occupied = new Set<string>();

  // Add cells from existing bins on this layer
  for (const bin of bins) {
    if (bin.layerId !== layerId) continue;
    for (let bx: number = bin.x; bx < bin.x + bin.width; bx += step) {
      for (let by: number = bin.y; by < bin.y + bin.depth; by += step) {
        occupied.add(`${bx},${by}`);
      }
    }
  }

  // Add cells from blocked zones (bins protruding from lower layers)
  const blockedZones = getBlockedZones(layerId, bins, layout.layers);
  for (const zone of blockedZones) {
    for (let zx: number = zone.x; zx < zone.x + zone.width; zx += step) {
      for (let zy: number = zone.y; zy < zone.y + zone.depth; zy += step) {
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
  layerId: LayerId,
  binWidth: number,
  binDepth: number,
  categoryId: CategoryId,
  halfBinMode: boolean = false
): { bins: Bin[]; skippedCells: number } {
  const layer = layout.layers.find((l) => l.id === layerId);
  if (!layer || binWidth <= 0 || binDepth <= 0) {
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
          id: generateBinId(),
          layerId,
          x: x as GridUnits,
          y: y as GridUnits,
          width: binWidth as GridUnits,
          depth: binDepth as GridUnits,
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
  layerId: LayerId,
  categoryId: CategoryId,
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
  // Clamp to drawer dimensions since bins can't exceed the drawer.
  // Floor to step so we never generate fractional sizes in integer-only mode
  // (maxPrintSize may be a 0.5-increment from calcMaxGridUnits).
  const effectiveMaxW = Math.floor(Math.min(maxPrintSize, layout.drawer.width) / step) * step;
  const effectiveMaxD = Math.floor(Math.min(maxPrintSize, layout.drawer.depth) / step) * step;
  const sizes: Array<{ w: number; d: number }> = [];
  for (let w = effectiveMaxW; w >= minSize; w -= step) {
    for (let d = effectiveMaxD; d >= minSize; d -= step) {
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
              id: generateBinId(),
              layerId,
              x: x as GridUnits,
              y: y as GridUnits,
              width: size.w as GridUnits,
              depth: size.d as GridUnits,
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
