import type { Bin, Layer, Rect3D, BlockedZone } from '../../../core/types';
import { STAGING_ID } from '../../../core/constants';

/**
 * Reverse layers for display purposes.
 * Layers are stored bottom-to-top but displayed top-to-bottom in the UI.
 */
export function getDisplayLayers<T>(layers: T[]): T[] {
  return [...layers].reverse();
}

/**
 * Calculate the Z-axis start position for a layer.
 * Layers stack from bottom (index 0) upward.
 */
export function getLayerZStart(layerId: string, layers: Layer[]): number {
  let z = 0;
  for (const layer of layers) {
    if (layer.id === layerId) return z;
    z += layer.height;
  }
  throw new Error(`Layer not found: ${layerId}`);
}

/**
 * Get the 3D bounding box for a bin.
 * Includes clearanceHeight in the vertical extent for collision detection.
 */
export function getBin3DRect(bin: Bin, layers: Layer[]): Rect3D {
  const zStart = getLayerZStart(bin.layerId, layers);
  return {
    x: bin.x,
    y: bin.y,
    width: bin.width,
    depth: bin.depth,
    zStart,
    zEnd: zStart + bin.height + (bin.clearanceHeight || 0),
  };
}

/**
 * Check if two 2D rectangles overlap (footprint).
 */
export function footprintsOverlap(a: { x: number; y: number; width: number; depth: number },
                                   b: { x: number; y: number; width: number; depth: number }): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.depth &&
    b.y < a.y + a.depth
  );
}

/**
 * Check if two vertical ranges overlap.
 */
export function verticalRangesOverlap(a: { zStart: number; zEnd: number },
                                       b: { zStart: number; zEnd: number }): boolean {
  return a.zStart < b.zEnd && b.zStart < a.zEnd;
}

/**
 * Check if two bins collide in 3D space.
 * Bins must overlap in both footprint AND vertical range to collide.
 */
export function binsCollide(binA: Bin, binB: Bin, layers: Layer[]): boolean {
  // Staging bins don't collide with anything
  if (binA.layerId === STAGING_ID || binB.layerId === STAGING_ID) {
    return false;
  }

  // Check footprint overlap first (cheaper)
  if (!footprintsOverlap(binA, binB)) {
    return false;
  }

  const rectA = getBin3DRect(binA, layers);
  const rectB = getBin3DRect(binB, layers);

  return verticalRangesOverlap(rectA, rectB);
}

// Simple cache for getBlockedZones - avoids recomputation when called repeatedly
// with same inputs (common during drag/resize interactions)
let blockedZonesCache: {
  targetLayerId: string;
  bins: Bin[];
  layers: Layer[];
  result: BlockedZone[];
} | null = null;

/**
 * Find all blocked zones for a given layer.
 * A blocked zone is where a bin from a lower layer protrudes upward.
 * Results are cached by reference equality for performance during interactions.
 */
export function getBlockedZones(
  targetLayerId: string,
  bins: Bin[],
  layers: Layer[]
): BlockedZone[] {
  if (!targetLayerId) return [];

  // Check cache - use reference equality for arrays (Zustand returns same refs when unchanged)
  if (
    blockedZonesCache &&
    blockedZonesCache.targetLayerId === targetLayerId &&
    blockedZonesCache.bins === bins &&
    blockedZonesCache.layers === layers
  ) {
    return blockedZonesCache.result;
  }

  const targetLayerIndex = layers.findIndex(l => l.id === targetLayerId);
  if (targetLayerIndex === -1) return [];

  const targetZStart = getLayerZStart(targetLayerId, layers);

  const blocked: BlockedZone[] = [];

  for (const bin of bins) {
    if (bin.layerId === STAGING_ID) continue;

    const binLayerIndex = layers.findIndex(l => l.id === bin.layerId);
    if (binLayerIndex >= targetLayerIndex) continue;

    const binRect = getBin3DRect(bin, layers);
    if (binRect.zEnd > targetZStart) {
      blocked.push({
        x: bin.x,
        y: bin.y,
        width: bin.width,
        depth: bin.depth,
        sourceBinId: bin.id,
        sourceLayerId: bin.layerId,
      });
    }
  }

  // Update cache
  blockedZonesCache = { targetLayerId, bins, layers, result: blocked };

  return blocked;
}

/**
 * Check if a position is within a blocked zone.
 */
export function isInBlockedZone(
  x: number,
  y: number,
  blockedZones: BlockedZone[]
): BlockedZone | null {
  for (const zone of blockedZones) {
    if (
      x >= zone.x &&
      x < zone.x + zone.width &&
      y >= zone.y &&
      y < zone.y + zone.depth
    ) {
      return zone;
    }
  }
  return null;
}

/**
 * Check if reordering layers would cause any bin collisions.
 * Returns list of colliding bin pairs if invalid, empty array if valid.
 */
export function checkLayerReorderCollisions(
  bins: Bin[],
  _currentLayers: Layer[],
  newLayers: Layer[]
): Array<{ binA: Bin; binB: Bin }> {
  const collisions: Array<{ binA: Bin; binB: Bin }> = [];
  const placedBins = bins.filter(b => b.layerId !== STAGING_ID);

  for (let i = 0; i < placedBins.length; i++) {
    for (let j = i + 1; j < placedBins.length; j++) {
      const binA = placedBins[i];
      const binB = placedBins[j];

      if (!footprintsOverlap(binA, binB)) continue;

      const rectA = getBin3DRect(binA, newLayers);
      const rectB = getBin3DRect(binB, newLayers);

      if (verticalRangesOverlap(rectA, rectB)) {
        collisions.push({ binA, binB });
      }
    }
  }

  return collisions;
}
