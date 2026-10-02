import { registerLinkedExcessResolver } from '@/shared/utils/collision';
import { linkedStackExcessUnits, stackJunctionMm } from '@/shared/utils/heightUnits';
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

function invalidate(): void {
  refsById = null;
  registryTick += 1;
}

subscribeToRegistry(invalidate);

// The registry subscriber only sees same-tab writes; a design saved in another
// tab arrives as a storage event (same key handling as `useCustomBins`).
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'gridfinity-custom-bins-v1' || e.key === null) invalidate();
  });
}

registerLinkedExcessResolver(
  (bin: Bin): number => {
    if (bin.linkedDesignId === undefined) return 0;
    const ref = refs().get(bin.linkedDesignId);
    if (ref?.assembledRiseMm === undefined) return 0;
    const { layout } = useLayoutStore.getState();
    // Only a parametric bin is rebuilt on the layout's foot; an assembly or an
    // imported mesh keeps the stock one.
    const isBin = ref.kind === undefined || ref.kind === 'bin';
    const low = layout.lowProfileBase === true && isBin;
    return linkedStackExcessUnits(
      bin.height,
      layout.heightUnitMm,
      {
        riseMm: ref.assembledRiseMm - (low ? (ref.lowProfileRiseDeltaMm ?? 0) : 0),
        hasLip: ref.hasLip,
      },
      stackJunctionMm(low)
    );
  },
  (): unknown => {
    const { layout } = useLayoutStore.getState();
    return `${registryTick}:${layout.heightUnitMm}:${layout.lowProfileBase === true}`;
  }
);

/**
 * Eager mount anchor. Renders nothing; its only job is to keep this module in
 * the shell's import graph so the registration above always runs.
 */
export function LinkedRiseRegistration(): null {
  return null;
}
