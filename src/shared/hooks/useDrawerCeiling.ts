/**
 * Drawer-ceiling fit for the whole layout.
 *
 * Joins the layout (bins, layers, height unit, baseplate) to the user's
 * measured drawer height, and resolves each linked bin's rise from the
 * custom-bin registry — the only synchronous view of a saved design.
 *
 * Returns null when the drawer is unmeasured, which is the signal for the
 * surfaces to prompt for a measurement instead of showing a fit answer.
 */

import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useLayoutStore } from '@/core/store/layout';
import { DEFAULT_BASEPLATE_PARAMS } from '@/core/baseplateDefaults';
import { useCustomBins } from '@/features/bin-designer';
import type { Bin } from '@/core/types';
import {
  drawerCeilingFit,
  type DrawerCeilingFit,
  type LinkedDesignRise,
} from '@/shared/utils/drawerCeiling';

export function useDrawerCeiling(): DrawerCeilingFit | null {
  const { bins, layers, heightUnitMm, storedPlate, lowProfileBase, ceilingMm } = useLayoutStore(
    useShallow((s) => ({
      bins: s.layout.bins,
      layers: s.layout.layers,
      heightUnitMm: s.layout.heightUnitMm,
      storedPlate: s.layout.baseplateParams ?? DEFAULT_BASEPLATE_PARAMS,
      lowProfileBase: s.layout.lowProfileBase === true,
      ceilingMm: s.layout.drawer.measuredMm?.height,
    }))
  );
  const customBins = useCustomBins();

  return useMemo(() => {
    const byId = new Map(customBins.map((ref) => [ref.id, ref]));
    const linkedRise = (bin: Bin): LinkedDesignRise | undefined => {
      if (bin.linkedDesignId === undefined) return undefined;
      const ref = byId.get(bin.linkedDesignId);
      // A registry entry saved before `assembledRiseMm` existed, or an imported
      // mesh that has no params to derive one from, measures as a plain bin.
      if (ref?.assembledRiseMm === undefined) return undefined;
      // Only a parametric bin is rebuilt on the layout's foot.
      const isBin = ref.kind === undefined || ref.kind === 'bin';
      return {
        riseMm:
          ref.assembledRiseMm - (lowProfileBase && isBin ? (ref.lowProfileRiseDeltaMm ?? 0) : 0),
        socketless: ref.socketless ?? false,
        hasLip: ref.hasLip,
        standardFoot: !isBin,
      };
    };

    const plate = lowProfileBase ? { ...storedPlate, lowProfileBase } : storedPlate;
    return drawerCeilingFit({ bins, layers, heightUnitMm, plate, ceilingMm, linkedRise });
  }, [bins, layers, heightUnitMm, storedPlate, lowProfileBase, ceilingMm, customBins]);
}
