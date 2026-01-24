import type { Bin } from '@/core/types';

export type Direction = 'up' | 'down' | 'left' | 'right';

/**
 * Find the nearest bin in a given direction using spatial navigation.
 * Uses hybrid alignment + distance scoring for intuitive navigation.
 *
 * @param currentBin - The currently focused bin
 * @param direction - Direction to navigate (up/down/left/right)
 * @param allBins - All bins on the current layer
 * @param activeLayerId - Current active layer ID
 * @returns The nearest bin in the specified direction, or null if none found
 */
export function findNearestBinInDirection(
  currentBin: Bin,
  direction: Direction,
  allBins: Bin[],
  activeLayerId: string
): Bin | null {
  const candidates = allBins.filter(
    (bin) => bin.layerId === activeLayerId && bin.id !== currentBin.id
  );

  if (candidates.length === 0) return null;

  const currentCenter = {
    x: currentBin.x + currentBin.width / 2,
    y: currentBin.y + currentBin.depth / 2,
  };

  const validCandidates = candidates.filter((candidate) => {
    const candidateCenter = {
      x: candidate.x + candidate.width / 2,
      y: candidate.y + candidate.depth / 2,
    };

    switch (direction) {
      case 'up':
        return candidateCenter.y > currentCenter.y;
      case 'down':
        return candidateCenter.y < currentCenter.y;
      case 'left':
        return candidateCenter.x < currentCenter.x;
      case 'right':
        return candidateCenter.x > currentCenter.x;
      default:
        return false;
    }
  });

  if (validCandidates.length === 0) return null;

  // Score each candidate based on alignment and distance
  const scored = validCandidates.map((candidate) => {
    const candidateCenter = {
      x: candidate.x + candidate.width / 2,
      y: candidate.y + candidate.depth / 2,
    };

    // Calculate alignment score (0-1, higher is better)
    let alignment: number;
    if (direction === 'up' || direction === 'down') {
      // For vertical movement, prioritize horizontal alignment
      const xDiff = Math.abs(candidateCenter.x - currentCenter.x);
      alignment = 1 / (1 + xDiff);
    } else {
      // For horizontal movement, prioritize vertical alignment
      const yDiff = Math.abs(candidateCenter.y - currentCenter.y);
      alignment = 1 / (1 + yDiff);
    }

    // Calculate distance
    const dx = candidateCenter.x - currentCenter.x;
    const dy = candidateCenter.y - currentCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Combined score: alignment * 100 + (1 / distance)
    // This heavily favors alignment but uses distance as tiebreaker
    const score = alignment * 100 + 1 / distance;

    return { bin: candidate, score };
  });

  // Sort by score (highest first) and return the best match
  scored.sort((a, b) => b.score - a.score);
  return scored[0].bin;
}
