import { registerLinkedExcessResolver } from '@/shared/utils/collision';
import { linkedStackExcessUnits } from '@/shared/utils/heightUnits';
import { loadRegistry, subscribeToRegistry } from '@/features/bin-designer';
import type { CustomBinRef } from '@/features/bin-designer';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin, DesignId } from '@/core/types';

/**
 * Composition root wiring the bin-designer registry's assembled-rise data into
 * the collision module's linked-excess resolver, so blocked zones and
 * placement validation charge a linked design's real standing height without a
 * `shared/utils → feature` import.
 *
 * Registration runs at module load (like `DesignStoreRegistration`) so the
 * first render's blocked-zone pass already sees linked excess; the resolver
 * reads lazily, so nothing touches localStorage until collision asks.
 */

let refsById: Map<DesignId, CustomBinRef> | null = null;
let registryTick = 0;

function refs(): Map<DesignId, CustomBinRef> {
  refsById ??= new Map(loadRegistry().map((ref) => [ref.id, ref]));
  return refsById;
}

subscribeToRegistry(() => {
  refsById = null;
  registryTick += 1;
});

registerLinkedExcessResolver(
  (bin: Bin): number => {
    if (bin.linkedDesignId === undefined) return 0;
    const ref = refs().get(bin.linkedDesignId);
    if (ref?.assembledRiseMm === undefined) return 0;
    return linkedStackExcessUnits(bin.height, useLayoutStore.getState().layout.heightUnitMm, {
      riseMm: ref.assembledRiseMm,
      hasLip: ref.hasLip,
    });
  },
  (): unknown => `${registryTick}:${useLayoutStore.getState().layout.heightUnitMm}`
);

/**
 * Eager mount anchor. Renders nothing; its only job is to keep this module in
 * the shell's import graph so the registration above always runs.
 */
export function LinkedRiseRegistration(): null {
  return null;
}
