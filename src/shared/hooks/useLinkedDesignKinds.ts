/**
 * The item kind of each saved design, read straight off the registry.
 *
 * Layout surfaces need to tell a parametric bin from an imported mesh or an
 * assembly synchronously, to agree with the export on what a placed bin can do
 * (see `designKindExtendsToMargin`), and the full design lives in IndexedDB.
 * Only entries that record a kind appear; absent reads as a parametric bin.
 */

import { useMemo } from 'react';
import type { DesignId } from '@/core/types';
import type { ItemKind } from '@/shared/types/item';
import { useCustomBins } from '@/features/bin-designer';

export function useLinkedDesignKinds(): ReadonlyMap<DesignId, ItemKind> {
  const registry = useCustomBins();
  return useMemo(() => {
    const byId = new Map<DesignId, ItemKind>();
    for (const ref of registry) {
      if (ref.kind !== undefined) byId.set(ref.id, ref.kind);
    }
    return byId;
  }, [registry]);
}
