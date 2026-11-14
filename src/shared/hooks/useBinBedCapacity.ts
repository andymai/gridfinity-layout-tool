import { useCallback } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { BedCapacity } from '@/core/constants';
import { useLayoutStore } from '@/core/store/layout';
import { effectiveGridUnitMmY, type DesignId } from '@/core/types';
import type { OverhangSource } from '@/shared/utils/drawerMargin';
import { placedBinBedCapacity } from '@/shared/utils/binSplitFit';
import { useBinOverhang } from './useBinOverhangSpan';
import { useLinkedDesignsKeptWhole } from './useLinkedDesignsKeptWhole';

type PlacedBin = OverhangSource & { readonly linkedDesignId?: DesignId };

/**
 * The layout's print bed fitted to one placed bin, as the print list and the
 * layout ZIP cut it: either way round, its overhang charged, and its linked
 * design's split switch applied.
 */
export function useBinBedCapacity(): (bin: PlacedBin) => BedCapacity {
  const { printBedSize, printBedDepth, gridUnitMm, gridUnitMmY } = useLayoutStore(
    useShallow((state) => ({
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth,
      gridUnitMm: state.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(state.layout),
    }))
  );
  const overhangFor = useBinOverhang();
  const keptWhole = useLinkedDesignsKeptWhole();
  return useCallback(
    (bin) =>
      placedBinBedCapacity(
        {
          width: bin.width,
          depth: bin.depth,
          gridUnitMm,
          gridUnitMmY,
          overhang: overhangFor(bin),
          splitToFitBed: !(bin.linkedDesignId !== undefined && keptWhole.has(bin.linkedDesignId)),
        },
        printBedSize,
        printBedDepth
      ),
    [printBedSize, printBedDepth, gridUnitMm, gridUnitMmY, overhangFor, keptWhole]
  );
}
