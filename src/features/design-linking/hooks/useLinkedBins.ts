/**
 * Hook to get all bins linked to a specific design.
 *
 * Used by the bin designer to show warnings when deleting a design.
 */

import { useMemo } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { useShallow } from 'zustand/react/shallow';
import { getBinsLinkedToDesign } from '../domain';
import type { Bin } from '@/core/types';
import type { DesignId } from '../types';

interface UseLinkedBinsResult {
  /** All bins linked to this design */
  linkedBins: Bin[];
  /** Count of linked bins */
  count: number;
  /** True if any bins are linked */
  hasLinkedBins: boolean;
}

/**
 * Get all bins in the current layout that are linked to a specific design.
 *
 * @param designId - The design ID to check for
 * @returns Object with linkedBins array, count, and hasLinkedBins flag
 */
export function useLinkedBins(designId: DesignId): UseLinkedBinsResult {
  const bins = useLayoutStore(useShallow((state) => state.layout.bins));

  return useMemo(() => {
    const linkedBins = getBinsLinkedToDesign(bins, designId);
    const count = linkedBins.length;
    const hasLinkedBins = count > 0;

    return {
      linkedBins,
      count,
      hasLinkedBins,
    };
  }, [bins, designId]);
}
