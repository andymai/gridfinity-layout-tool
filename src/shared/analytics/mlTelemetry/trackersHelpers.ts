/**
 * Shared helpers for the ML telemetry trackers.
 *
 * - `isEnabled` — gate function read by every tracker before emitting.
 * - `getAdjacentBinContext` — collects label hashes + sizes of bins on the
 *   same layer adjacent to the subject bin (used by placement tracking).
 */

import type { Bin, Layout } from '@/core/types';
import { useSettingsStore } from '@/core/store/settings';
import { processLabel } from '../labelVocabulary';
import { areBinsAdjacent } from '../layoutPatterns';

/** Check if analytics/telemetry is enabled. */
export function isEnabled(): boolean {
  const settings = useSettingsStore.getState().settings;
  return settings.analyticsEnabled;
}

/** Get labels and sizes of bins adjacent to the given bin on the same layer. */
export function getAdjacentBinContext(
  bin: Bin,
  layout: Layout
): { labelHashes: string[]; sizes: string[]; count: number } {
  const sameLevelBins = layout.bins.filter((b) => b.layerId === bin.layerId && b.id !== bin.id);

  const adjacentLabelHashes: string[] = [];
  const adjacentSizes: string[] = [];

  for (const other of sameLevelBins) {
    if (areBinsAdjacent(bin, other)) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
      if (other.label?.trim()) {
        const labelData = processLabel(other.label);
        adjacentLabelHashes.push(labelData.hash);
      }
      adjacentSizes.push(`${other.width}x${other.depth}x${other.height}`);
    }
  }

  return {
    labelHashes: adjacentLabelHashes.slice(0, 4),
    sizes: adjacentSizes.slice(0, 4),
    count: adjacentSizes.length,
  };
}
