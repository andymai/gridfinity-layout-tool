/**
 * Linkage queries - pure query functions for finding linked entities.
 *
 * No side effects. These functions filter and aggregate data.
 */

import type { Bin } from '@/core/types';
import type { BinId, DesignId, DesignLinkedBinsSummary, SyncableDimensions } from '../types';
import type { CustomBinRef } from '@/features/bin-designer';
import { dimensionsMatch } from './linkingRules';

// =============================================================================
// Single Entity Queries
// =============================================================================

/**
 * Get the linked design ID for a bin (or null if not linked).
 */
export function getLinkedDesignId(bin: Bin): DesignId | null {
  return bin.linkedDesignId ?? null;
}

/**
 * Check if a bin is linked to any design.
 */
export function isLinked(bin: Bin): boolean {
  return bin.linkedDesignId !== undefined;
}

/**
 * Check if a bin is linked to a specific design.
 */
export function isLinkedTo(bin: Bin, designId: DesignId): boolean {
  return bin.linkedDesignId === designId;
}

// =============================================================================
// Collection Queries
// =============================================================================

/**
 * Get all bins linked to a specific design.
 */
export function getBinsLinkedToDesign(bins: Bin[], designId: DesignId): Bin[] {
  return bins.filter((bin) => bin.linkedDesignId === designId);
}

/**
 * Get IDs of all bins linked to a specific design.
 */
export function getBinIdsLinkedToDesign(bins: Bin[], designId: DesignId): BinId[] {
  return getBinsLinkedToDesign(bins, designId).map((bin) => bin.id);
}

/**
 * Check if any bins are linked to a design.
 */
export function hasLinkedBins(bins: Bin[], designId: DesignId): boolean {
  return bins.some((bin) => bin.linkedDesignId === designId);
}

/**
 * Count bins linked to a design.
 */
export function countLinkedBins(bins: Bin[], designId: DesignId): number {
  return getBinsLinkedToDesign(bins, designId).length;
}

/**
 * Get all unique design IDs that bins are linked to.
 */
export function getLinkedDesignIds(bins: Bin[]): DesignId[] {
  const ids = new Set<DesignId>();
  for (const bin of bins) {
    if (bin.linkedDesignId) {
      ids.add(bin.linkedDesignId);
    }
  }
  return Array.from(ids);
}

/**
 * Get all linked bins (bins that have a linkedDesignId).
 */
export function getLinkedBins(bins: Bin[]): Bin[] {
  return bins.filter((bin) => bin.linkedDesignId !== undefined);
}

// =============================================================================
// Dimension Mismatch Queries
// =============================================================================

/**
 * Check if a bin's dimensions match its linked design.
 */
export function binMatchesDesign(bin: Bin, designDimensions: SyncableDimensions): boolean {
  return dimensionsMatch(
    { width: bin.width, depth: bin.depth, height: bin.height },
    designDimensions
  );
}

/**
 * Find bins linked to a design that have dimension mismatches.
 */
export function getBinsWithDimensionMismatch(
  bins: Bin[],
  designId: DesignId,
  designDimensions: SyncableDimensions
): Bin[] {
  return getBinsLinkedToDesign(bins, designId).filter(
    (bin) => !binMatchesDesign(bin, designDimensions)
  );
}

// =============================================================================
// Summary Builders
// =============================================================================

/**
 * Build a summary of bins linked to a specific design.
 */
export function buildLinkedBinsSummary(
  designId: DesignId,
  designName: string,
  bins: Bin[],
  designDimensions: SyncableDimensions
): DesignLinkedBinsSummary {
  const linkedBins = getBinsLinkedToDesign(bins, designId);
  const hasMismatch = linkedBins.some((bin) => !binMatchesDesign(bin, designDimensions));

  return {
    designId,
    designName,
    linkedBinCount: linkedBins.length,
    linkedBinIds: linkedBins.map((b) => b.id),
    hasDimensionMismatch: hasMismatch,
  };
}

/**
 * Resolve a linked design from the registry.
 * Returns the design ref if found, null if not found (design may have been deleted).
 */
export function resolveLinkedDesign(
  linkedDesignId: DesignId | undefined,
  registry: CustomBinRef[]
): CustomBinRef | null {
  if (!linkedDesignId) return null;
  return registry.find((ref) => ref.id === linkedDesignId) ?? null;
}

/**
 * Check if a linked design still exists in the registry.
 */
export function linkedDesignExists(
  linkedDesignId: DesignId | undefined,
  registry: CustomBinRef[]
): boolean {
  if (!linkedDesignId) return false;
  return registry.some((ref) => ref.id === linkedDesignId);
}
