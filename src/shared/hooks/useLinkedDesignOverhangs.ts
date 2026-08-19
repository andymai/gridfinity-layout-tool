/**
 * The overhang each linked design carries, read straight off the registry.
 *
 * `resolveBinOverhang` answers this question for a PLACED bin and deliberately
 * returns `null` for its third tier — the design's own `params.overhang` — so
 * that layout code is not forced to import the bin designer. The full params
 * live in IndexedDB, which a synchronous selector cannot await; the registry
 * carries the resolved footprint reach (`CustomBinRef.overhangMm`) precisely so
 * this tier is reachable without them.
 *
 * Footprint only: `feet` and `taper` are not carried, and neither changes how
 * far the body reaches. Anything that needs to RENDER an overhang wants the
 * real params, not this.
 */

import { useMemo } from 'react';
import type { DesignId } from '@/core/types';
import type { OverhangConfig } from '@/shared/types/bin';
import { useCustomBins } from '@/features/bin-designer';

export function useLinkedDesignOverhangs(): ReadonlyMap<DesignId, OverhangConfig> {
  const registry = useCustomBins();
  return useMemo(() => {
    const byId = new Map<DesignId, OverhangConfig>();
    for (const ref of registry) {
      // Absent means nothing to charge — either the design has no overhang, or
      // the entry predates the field and gains one on its next save.
      if (!ref.overhangMm) continue;
      byId.set(ref.id, { ...ref.overhangMm, enabled: true });
    }
    return byId;
  }, [registry]);
}
