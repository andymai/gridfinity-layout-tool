import type { Bin, Layout, Coord, LayerId, BinId } from '@/core/types';
import { canPlaceBin } from './validation';

/**
 * Result of finding a nearby valid position.
 */
export interface NearbyPosition {
  x: number;
  y: number;
  distance: number; // Manhattan distance from original
}

/**
 * Result of checking swap compatibility between two bins.
 */
export interface SwapCompatibility {
  compatible: boolean;
  requiresRotation: boolean;
  reason?: 'size_mismatch' | 'layer_mismatch' | 'placement_invalid';
}

/**
 * Generate spiral offsets from origin for position searching.
 * Pattern: adjacent cells (distance 1) first, then expanding outward.
 * Prioritizes cardinal directions before diagonals at each distance.
 *
 * @param maxRadius - Maximum Manhattan distance to search
 * @param step - Position increment (0.5 for half-bin mode, 1 for normal)
 * @yields Coordinate offsets in spiral order
 */
function* spiralOffsets(
  maxRadius: number,
  step: number
): Generator<{ dx: number; dy: number; distance: number }> {
  // Origin is not yielded - caller handles original position separately

  for (let radius = step; radius <= maxRadius; radius += step) {
    // Cardinal directions first (most intuitive for users)
    yield { dx: radius, dy: 0, distance: radius }; // right
    yield { dx: 0, dy: radius, distance: radius }; // up
    yield { dx: -radius, dy: 0, distance: radius }; // left
    yield { dx: 0, dy: -radius, distance: radius }; // down

    // Then positions along edges of this radius "ring"
    for (let offset = step; offset < radius; offset += step) {
      const dist = radius + offset;
      yield { dx: radius, dy: offset, distance: dist };
      yield { dx: radius, dy: -offset, distance: dist };
      yield { dx: -radius, dy: offset, distance: dist };
      yield { dx: -radius, dy: -offset, distance: dist };
      yield { dx: offset, dy: radius, distance: dist };
      yield { dx: -offset, dy: radius, distance: dist };
      yield { dx: offset, dy: -radius, distance: dist };
      yield { dx: -offset, dy: -radius, distance: dist };
    }

    // Corners at this radius
    const cornerDist = radius * 2;
    yield { dx: radius, dy: radius, distance: cornerDist };
    yield { dx: radius, dy: -radius, distance: cornerDist };
    yield { dx: -radius, dy: radius, distance: cornerDist };
    yield { dx: -radius, dy: -radius, distance: cornerDist };
  }
}

/**
 * Find the nearest valid position for a bin with given dimensions.
 * Searches in a spiral pattern outward from the original position.
 *
 * @param originalPos - Starting position to search from
 * @param width - Bin width (may be rotated dimensions)
 * @param depth - Bin depth (may be rotated dimensions)
 * @param height - Bin height
 * @param layerId - Target layer
 * @param layout - Current layout for validation
 * @param excludeBinId - Bin ID to exclude from collision checks (the bin being moved)
 * @param maxDistance - Maximum search radius in grid units (default: 3)
 * @returns Nearest valid position or null if none found within radius
 */
export function findNearbyValidPosition(
  originalPos: Coord,
  width: number,
  depth: number,
  height: number,
  layerId: LayerId,
  layout: Layout,
  excludeBinId: BinId,
  maxDistance = 3,
  clearanceHeight?: number
): NearbyPosition | null {
  // Determine step size based on whether dimensions are fractional (half-bin mode)
  const hasFractional =
    originalPos.x % 1 !== 0 || originalPos.y % 1 !== 0 || width % 1 !== 0 || depth % 1 !== 0;
  const step = hasFractional ? 0.5 : 1;

  for (const { dx, dy, distance } of spiralOffsets(maxDistance, step)) {
    const candidateX = originalPos.x + dx;
    const candidateY = originalPos.y + dy;

    // Quick bounds check before expensive validation
    if (
      candidateX < 0 ||
      candidateY < 0 ||
      candidateX + width > layout.drawer.width ||
      candidateY + depth > layout.drawer.depth
    ) {
      continue;
    }

    // Full validation at candidate position
    const result = canPlaceBin(
      { x: candidateX, y: candidateY, width, depth, height, clearanceHeight },
      layerId,
      layout,
      excludeBinId
    );

    if (result.valid) {
      return { x: candidateX, y: candidateY, distance };
    }
  }

  return null;
}

/**
 * Check if two bins are size-compatible for swapping.
 * Compatible if: exact dimension match OR rotated match (2×3 ↔ 3×2).
 *
 * @param binA - First bin dimensions
 * @param binB - Second bin dimensions
 * @returns Compatibility result with rotation flag
 */
export function areSizeCompatible(
  binA: { width: number; depth: number },
  binB: { width: number; depth: number }
): { compatible: boolean; requiresRotation: boolean } {
  // Exact match - dimensions identical
  if (binA.width === binB.width && binA.depth === binB.depth) {
    return { compatible: true, requiresRotation: false };
  }

  // Rotated match - A's dimensions equal B's swapped dimensions
  if (binA.width === binB.depth && binA.depth === binB.width) {
    return { compatible: true, requiresRotation: true };
  }

  return { compatible: false, requiresRotation: false };
}

/**
 * Validate if two bins can be swapped.
 * Checks:
 * 1. Same layer (bins must be on same layer to swap)
 * 2. Size compatibility (exact or rotated match)
 * 3. Both bins can be placed at each other's positions after swap
 *
 * @param binA - First bin to swap
 * @param binB - Second bin to swap
 * @param layout - Current layout for validation
 * @returns Swap validation result with rotation requirement
 */
export function canSwapBins(binA: Bin, binB: Bin, layout: Layout): SwapCompatibility {
  // Must be on same layer
  if (binA.layerId !== binB.layerId) {
    return { compatible: false, requiresRotation: false, reason: 'layer_mismatch' };
  }

  // Check size compatibility
  const sizeCheck = areSizeCompatible(binA, binB);
  if (!sizeCheck.compatible) {
    return { compatible: false, requiresRotation: false, reason: 'size_mismatch' };
  }

  // Exclude both bins from collision checks during validation
  const excludeIds = new Set([binA.id, binB.id]);

  // Determine dimensions for A at B's position (rotate if needed)
  const aWidth = sizeCheck.requiresRotation ? binA.depth : binA.width;
  const aDepth = sizeCheck.requiresRotation ? binA.width : binA.depth;

  // Validate A can be placed at B's position
  const canPlaceAatB = canPlaceBin(
    {
      x: binB.x,
      y: binB.y,
      width: aWidth,
      depth: aDepth,
      height: binA.height,
      clearanceHeight: binA.clearanceHeight,
    },
    binA.layerId,
    layout,
    binA.id,
    excludeIds
  );

  if (!canPlaceAatB.valid) {
    return {
      compatible: false,
      requiresRotation: sizeCheck.requiresRotation,
      reason: 'placement_invalid',
    };
  }

  // Validate B can be placed at A's position (B doesn't rotate - only source bin rotates)
  const canPlaceBatA = canPlaceBin(
    {
      x: binA.x,
      y: binA.y,
      width: binB.width,
      depth: binB.depth,
      height: binB.height,
      clearanceHeight: binB.clearanceHeight,
    },
    binB.layerId,
    layout,
    binB.id,
    excludeIds
  );

  if (!canPlaceBatA.valid) {
    return {
      compatible: false,
      requiresRotation: sizeCheck.requiresRotation,
      reason: 'placement_invalid',
    };
  }

  return { compatible: true, requiresRotation: sizeCheck.requiresRotation };
}

/**
 * Find the bin at a given grid coordinate on a specific layer.
 * Useful for detecting swap targets during drag.
 *
 * @param coord - Grid coordinate to check
 * @param layerId - Layer to search on
 * @param layout - Current layout
 * @param excludeBinIds - Bin IDs to exclude from search
 * @returns Bin at position or null if none found
 */
export function findBinAtPosition(
  coord: Coord,
  layerId: string,
  layout: Layout,
  excludeBinIds: Set<string>
): Bin | null {
  return (
    layout.bins.find((bin) => {
      if (excludeBinIds.has(bin.id)) return false;
      if (bin.layerId !== layerId) return false;
      return (
        coord.x >= bin.x &&
        coord.x < bin.x + bin.width &&
        coord.y >= bin.y &&
        coord.y < bin.y + bin.depth
      );
    }) ?? null
  );
}
