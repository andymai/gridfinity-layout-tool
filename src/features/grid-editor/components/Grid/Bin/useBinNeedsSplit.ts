import { useShallow } from 'zustand/react/shallow';
import { calcBedCapacityForBin } from '@/core/constants';
import { useLayoutStore } from '@/core/store';
import { effectiveGridUnitMmY, type Bin } from '@/core/types';
import { useBinOverhangSpan } from '@/shared/hooks/useBinOverhangSpan';

export function useBinNeedsSplit(bin: Bin): boolean {
  const { printBedSize, printBedDepth, gridUnitMm, gridUnitMmY } = useLayoutStore(
    useShallow((state) => ({
      printBedSize: state.layout.printBedSize,
      printBedDepth: state.layout.printBedDepth,
      gridUnitMm: state.layout.gridUnitMm,
      gridUnitMmY: effectiveGridUnitMmY(state.layout),
    }))
  );
  const overhangSpanFor = useBinOverhangSpan();
  const maxGrid = calcBedCapacityForBin(
    bin.width,
    bin.depth,
    printBedSize,
    gridUnitMm,
    printBedDepth,
    gridUnitMmY,
    overhangSpanFor(bin)
  );
  return bin.width > maxGrid.width || bin.depth > maxGrid.depth;
}
