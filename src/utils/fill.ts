import type { Bin, Layout } from '../types';
import { generateId, CONSTRAINTS } from '../constants';
import { getBlockedZones } from './collision';

/**
 * Create a Set of blocked cell keys for O(1) lookup.
 * Key format: "x,y"
 */
function createOccupiedCellSet(bins: Bin[], layerId: string, layout: Layout): Set<string> {
  const occupied = new Set<string>();

  // Add cells from existing bins on this layer
  for (const bin of bins) {
    if (bin.layerId !== layerId) continue;
    for (let bx = bin.x; bx < bin.x + bin.width; bx++) {
      for (let by = bin.y; by < bin.y + bin.depth; by++) {
        occupied.add(`${bx},${by}`);
      }
    }
  }

  // Add cells from blocked zones (bins protruding from lower layers)
  const blockedZones = getBlockedZones(layerId, bins, layout.layers);
  for (const zone of blockedZones) {
    for (let zx = zone.x; zx < zone.x + zone.width; zx++) {
      for (let zy = zone.y; zy < zone.y + zone.depth; zy++) {
        occupied.add(`${zx},${zy}`);
      }
    }
  }

  return occupied;
}

/**
 * Check if a rectangle can be placed without hitting occupied cells.
 */
function canPlaceRect(
  x: number,
  y: number,
  width: number,
  depth: number,
  occupied: Set<string>
): boolean {
  for (let bx = x; bx < x + width; bx++) {
    for (let by = y; by < y + depth; by++) {
      if (occupied.has(`${bx},${by}`)) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Mark cells as occupied after placing a bin.
 */
function markOccupied(
  x: number,
  y: number,
  width: number,
  depth: number,
  occupied: Set<string>
): void {
  for (let bx = x; bx < x + width; bx++) {
    for (let by = y; by < y + depth; by++) {
      occupied.add(`${bx},${by}`);
    }
  }
}

/**
 * Fill empty cells with bins of specified size.
 * Skips occupied cells and blocked zones.
 * Optimized: Pre-computes blocked zones and uses Set for O(1) cell lookup.
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

  // Pre-compute occupied cells (existing bins + blocked zones)
  const occupied = createOccupiedCellSet(layout.bins, layerId, layout);

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
      if (canPlaceRect(x, y, binWidth, binDepth, occupied)) {
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
        markOccupied(x, y, binWidth, binDepth, occupied);
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

  // Pre-compute occupied cells (existing bins + blocked zones)
  const occupied = createOccupiedCellSet(layout.bins, layerId, layout);

  const newBins: Bin[] = [];

  // Generate sizes sorted by area (largest first)
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
          // Bounds check
          if (x + size.w > layout.drawer.width || y + size.d > layout.drawer.depth) {
            continue;
          }

          // O(1) check for each cell in the bin footprint
          if (canPlaceRect(x, y, size.w, size.d, occupied)) {
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
            markOccupied(x, y, size.w, size.d, occupied);
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
