import type { Bin } from '@/core/types';
import { useBinBedCapacity } from '@/shared/hooks/useBinBedCapacity';

/** `keptWhole`: larger than the bed, and its design turns splitting off. */
export type BinBedFit = 'fits' | 'split' | 'keptWhole';

export function useBinBedFit(bin: Bin): BinBedFit {
  const capacity = useBinBedCapacity()(bin);
  if (capacity.keptWhole) return 'keptWhole';
  return bin.width > capacity.width || bin.depth > capacity.depth ? 'split' : 'fits';
}
