import type { Bin, BinId, GridUnits, Layout, LayerId, CategoryId } from '@/core/types';
import { effectiveGridUnitMmY } from '@/core/types';
import { generateBinId, CONSTRAINTS } from '@/core/constants';
import { getRestingStack, newViolations, resolveRestingStack } from './restingStack';
import { getOutsideCellSet } from './drawerOutlineCells';
import { drawerFrameOutline } from './outlineFrame';

const HEIGHT_EPSILON = 1e-9;

/**
 * Create a Set of blocked cell keys for O(1) lookup.
 * Key format: "x,y"
 * @param step - Iteration step size (0.5 for half-bin mode, 1 for normal)
 * @param height - Height of the bin to be placed; defaults to the layer's.
 */
export function createOccupiedCellSet(
  bins: Bin[],
  layerId: LayerId,
  layout: Layout,
  step: 0.5 | 1 = 1,
  height?: number
): Set<string> {
  const occupied = new Set<string>();

  // Cells outside a non-rectangular drawer are unplaceable — mark them
  // occupied so fill tools skip them (same predicate as canPlaceBin, frame
  // included:).
  const frameOutline = drawerFrameOutline(
    layout.drawer,
    layout.baseplateParams,
    layout.gridUnitMm,
    effectiveGridUnitMmY(layout)
  );
  if (frameOutline !== undefined) {
    const outside = getOutsideCellSet(
      frameOutline,
      layout.drawer,
      layout.gridUnitMm,
      step,
      effectiveGridUnitMmY(layout)
    );
    for (const key of outside) occupied.add(key);
  }

  // Add cells from existing bins on this layer
  for (const bin of bins) {
    if (bin.layerId !== layerId) continue;
    for (let bx: number = bin.x; bx < bin.x + bin.width; bx += step) {
      for (let by: number = bin.y; by < bin.y + bin.depth; by += step) {
        occupied.add(`${bx},${by}`);
      }
    }
  }

  for (const key of unrestableCells(bins, layerId, layout, step, height)) occupied.add(key);

  return occupied;
}

/**
 * Cells where a new bin could not rest: the top of what is below plus the
 * bin would pass the drawer, or the highest thing below is clearance a lower
 * bin reserves. Judged cell by cell, which is conservative for a multi-cell
 * bin, since it rests on the highest of its cells.
 */
function unrestableCells(
  bins: Bin[],
  layerId: LayerId,
  layout: Layout,
  step: number,
  height: number | undefined
): string[] {
  const layerIndex = layout.layers.findIndex((l) => l.id === layerId);
  if (layerIndex === -1) return [];
  const binHeight = height ?? layout.layers[layerIndex].height;
  const ceiling = layout.drawer.height;
  const keys: string[] = [];

  if (binHeight > ceiling + HEIGHT_EPSILON) {
    for (let x = 0; x < layout.drawer.width; x += step) {
      for (let y = 0; y < layout.drawer.depth; y += step) keys.push(`${x},${y}`);
    }
    return keys;
  }

  const lowerLayers = new Set(layout.layers.slice(0, layerIndex).map((l) => l.id));
  const stack = getRestingStack(bins, layout.layers);
  const top = new Map<string, { height: number; onClearance: boolean }>();
  for (const bin of bins) {
    if (!lowerLayers.has(bin.layerId)) continue;
    const rest = stack.bins.get(bin.id);
    if (!rest) continue;
    const clearance = rest.stackTop > rest.materialTop + HEIGHT_EPSILON;
    for (let bx: number = bin.x; bx < bin.x + bin.width; bx += step) {
      for (let by: number = bin.y; by < bin.y + bin.depth; by += step) {
        const key = `${bx},${by}`;
        const prev = top.get(key);
        if (!prev || rest.stackTop > prev.height + HEIGHT_EPSILON) {
          top.set(key, { height: rest.stackTop, onClearance: clearance });
        } else if (Math.abs(rest.stackTop - prev.height) <= HEIGHT_EPSILON && clearance) {
          prev.onClearance = true;
        }
      }
    }
  }
  for (const [key, cell] of top) {
    if (cell.onClearance || cell.height + binHeight > ceiling + HEIGHT_EPSILON) keys.push(key);
  }
  return keys;
}

/**
 * Fill bins pass the cell check on their own, but one landing under a bin
 * from a higher layer lifts that bin and everything on it. Resolves the
 * filled layout once and drops the fill bins carrying any stack that ends up
 * past the drawer or on clearance, repeating until nothing new breaks.
 */
function withoutLifts(layout: Layout, fill: Bin[]): Bin[] {
  const before = getRestingStack(layout.bins, layout.layers);
  let kept = fill;
  for (;;) {
    const after = resolveRestingStack([...layout.bins, ...kept], layout.layers);
    const broken = newViolations(before, after, layout.drawer.height);
    if (broken.length === 0) return kept;
    const fillIds = new Set(kept.map((b) => b.id));
    const carriers = new Set<BinId>();
    const seen = new Set<BinId>();
    const pending = broken.map((v) => v.binId);
    for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (fillIds.has(id)) carriers.add(id);
      pending.push(...(after.bins.get(id)?.restsOn ?? []));
    }
    if (carriers.size === 0) return kept;
    kept = kept.filter((b) => !carriers.has(b.id));
  }
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
 * Skips occupied cells and cells where a bin of the layer's height cannot rest.
 * @param halfGridMode - When true, uses 0.5 step for iteration and collision detection
 */
export function fillAllWithSize(
  layout: Layout,
  layerId: LayerId,
  binWidth: number,
  binDepth: number,
  categoryId: CategoryId,
  halfGridMode: boolean = false
): { bins: Bin[]; skippedCells: number } {
  const layer = layout.layers.find((l) => l.id === layerId);
  if (!layer || binWidth <= 0 || binDepth <= 0) {
    return { bins: [], skippedCells: 0 };
  }

  // Step size for collision detection (0.5 in half-bin mode, 1 in normal)
  const step: 0.5 | 1 = halfGridMode ? 0.5 : 1;

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

  const kept = withoutLifts(layout, newBins);
  return { bins: kept, skippedCells: skippedCells + newBins.length - kept.length };
}

/**
 * Fill gaps with optimally-sized bins.
 * Tries to use bins that don't require splitting.
 * @param halfGridMode - When true, uses 0.5 step for iteration and collision detection
 */
export function fillGaps(
  layout: Layout,
  layerId: LayerId,
  categoryId: CategoryId,
  maxPrintSize: number,
  halfGridMode: boolean = false
): { bins: Bin[]; addedCount: number } {
  const layer = layout.layers.find((l) => l.id === layerId);
  if (!layer) {
    return { bins: [], addedCount: 0 };
  }

  // Step size for iteration and collision detection (0.5 in half-bin mode, 1 in normal)
  const step: 0.5 | 1 = halfGridMode ? 0.5 : 1;
  const minSize = halfGridMode ? 0.5 : 1;

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

  const kept = withoutLifts(layout, newBins);
  return { bins: kept, addedCount: kept.length };
}
