import type { BinId, CategoryId } from '@/core/types';

export interface PackedBin {
  id: BinId;
  x: number; // Position in staging grid
  y: number;
  width: number;
  depth: number;
  height: number;
  category: CategoryId;
  label: string;
}

/**
 * Create cluster key for grouping similar bins.
 * Bins with same category and same floored dimensions share a key.
 * Using floor() means 2.0 and 2.9 cluster together (both floor to 2),
 * but 1.9 (floors to 1) goes in a different cluster.
 */
export function getClusterKey(bin: PackedBin): string {
  return `${bin.category}_${Math.floor(bin.width)}_${Math.floor(bin.depth)}`;
}

/**
 * Group bins into clusters by category + floored dimensions, ordered by cluster size.
 * Within each cluster, bins are sorted by area (largest first) for better packing.
 *
 * This improves stash organization by keeping similar bins together:
 * - All 2×3 "Electronics" bins cluster together (2.1×3.5 included, but not 3×2)
 * - All 1×1 "Hardware" bins cluster together
 * - Largest clusters appear first (bottom-left of stash)
 */
export function clusterBins(bins: PackedBin[]): PackedBin[] {
  if (bins.length === 0) return [];

  // Group by cluster key (category + floored dimensions)
  const clusters = new Map<string, PackedBin[]>();
  for (const bin of bins) {
    const key = getClusterKey(bin);
    const existing = clusters.get(key);
    if (existing) existing.push(bin);
    else clusters.set(key, [bin]);
  }

  // Sort clusters by size (most bins first), then by key for stability
  // Within each cluster, sort by area (largest first) for better packing
  return Array.from(clusters.values())
    .sort((a, b) => b.length - a.length || getClusterKey(a[0]).localeCompare(getClusterKey(b[0])))
    .flatMap((cluster) => cluster.sort((a, b) => b.width * b.depth - a.width * a.depth));
}

/**
 * Auto-pack bins into staging grid (simple left-to-right, bottom-up packing)
 */
export function packBins(bins: PackedBin[], gridWidth: number): PackedBin[] {
  if (bins.length === 0) return [];

  const packed: PackedBin[] = [];
  const occupied = new Set<string>();

  const isOccupied = (x: number, y: number, w: number, d: number): boolean => {
    const ceilW = Math.ceil(w) || 1;
    const ceilD = Math.ceil(d) || 1;
    const baseX = Math.floor(x);
    const baseY = Math.floor(y);
    for (let dx = 0; dx < ceilW; dx++) {
      for (let dy = 0; dy < ceilD; dy++) {
        if (occupied.has(`${baseX + dx},${baseY + dy}`)) return true;
      }
    }
    return false;
  };

  const occupy = (x: number, y: number, w: number, d: number): void => {
    const ceilW = Math.ceil(w) || 1;
    const ceilD = Math.ceil(d) || 1;
    const baseX = Math.floor(x);
    const baseY = Math.floor(y);
    for (let dx = 0; dx < ceilW; dx++) {
      for (let dy = 0; dy < ceilD; dy++) {
        occupied.add(`${baseX + dx},${baseY + dy}`);
      }
    }
  };

  // Cluster by category + similar size, then sort within clusters by area
  const sortedBins = clusterBins(bins);

  // Compute a safe row limit: worst case is all bins stacked vertically
  const totalDepth = sortedBins.reduce((sum, b) => sum + Math.ceil(b.depth), 0);
  const maxRows = Math.max(totalDepth, sortedBins.length) + 1;

  for (const bin of sortedBins) {
    let placed = false;
    // Try to place at each position, scanning left-to-right, bottom-to-top
    for (let y = 0; y < maxRows && !placed; y++) {
      for (let x = 0; x <= gridWidth - bin.width && !placed; x++) {
        if (!isOccupied(x, y, bin.width, bin.depth)) {
          packed.push({ ...bin, x, y });
          occupy(x, y, bin.width, bin.depth);
          placed = true;
        }
      }
    }
  }

  return packed;
}
