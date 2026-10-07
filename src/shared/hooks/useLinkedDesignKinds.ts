/**
 * The item kind of each saved design, read straight off the registry.
 *
 * Layout surfaces need to tell a parametric bin from an imported mesh or an
 * assembly synchronously, to agree with the export on what a placed bin can do
 * (see `designKindExtendsToMargin`), and the full design lives in IndexedDB.
 * Only entries that record a kind appear; absent reads as a parametric bin.
 */

import type { DesignId } from '@/core/types';
import type { ItemKind } from '@/shared/types/item';
import { useCustomBins } from '@/features/bin-designer';
import type { CustomBinRef } from '@/features/bin-designer';

// Keyed by the registry snapshot, which `useCustomBins` keeps referentially
// stable until the registry changes: the 2D grid calls this once per bin, and
// every caller should share one projection rather than each building its own.
const kindsBySnapshot = new WeakMap<readonly CustomBinRef[], ReadonlyMap<DesignId, ItemKind>>();

function kindsOf(registry: readonly CustomBinRef[]): ReadonlyMap<DesignId, ItemKind> {
  const cached = kindsBySnapshot.get(registry);
  if (cached) return cached;
  const byId = new Map<DesignId, ItemKind>();
  for (const ref of registry) {
    if (ref.kind !== undefined) byId.set(ref.id, ref.kind);
  }
  kindsBySnapshot.set(registry, byId);
  return byId;
}

export function useLinkedDesignKinds(): ReadonlyMap<DesignId, ItemKind> {
  return kindsOf(useCustomBins());
}
