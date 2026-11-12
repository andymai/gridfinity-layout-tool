/**
 * The saved designs that turn splitting off, read straight off the registry.
 *
 * Layout surfaces ask "is this placed bin cut to fit the bed" synchronously,
 * and the switch lives in the design's params in IndexedDB; the registry
 * carries it (`CustomBinRef.splitToFitBed`) so the answer agrees with the
 * export without loading them.
 */

import type { DesignId } from '@/core/types';
import { useCustomBins } from '@/features/bin-designer';
import type { CustomBinRef } from '@/features/bin-designer';

// Keyed by the registry snapshot, which `useCustomBins` keeps referentially
// stable until the registry changes: the 2D grid calls this once per bin.
const keptWholeBySnapshot = new WeakMap<readonly CustomBinRef[], ReadonlySet<DesignId>>();

function keptWholeOf(registry: readonly CustomBinRef[]): ReadonlySet<DesignId> {
  const cached = keptWholeBySnapshot.get(registry);
  if (cached) return cached;
  const ids = new Set<DesignId>();
  for (const ref of registry) {
    if (ref.splitToFitBed === false) ids.add(ref.id);
  }
  keptWholeBySnapshot.set(registry, ids);
  return ids;
}

export function useLinkedDesignsKeptWhole(): ReadonlySet<DesignId> {
  return keptWholeOf(useCustomBins());
}
