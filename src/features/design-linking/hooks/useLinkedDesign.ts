/**
 * Hook to resolve the linked design for a bin.
 *
 * Uses the lightweight CustomBinRegistry for fast synchronous lookups.
 * Returns null if the bin isn't linked or if the design was deleted.
 */

import { useMemo } from 'react';
import type { DesignId } from '@/core/types';
import { useCustomBins, type CustomBinRef } from '@/features/bin-designer';
import { resolveLinkedDesign, linkedDesignExists } from '../domain';

interface UseLinkedDesignResult {
  /** The linked design reference, or null if not linked or design deleted */
  linkedDesign: CustomBinRef | null;
  /** True if bin has a linkedDesignId but design no longer exists */
  isStale: boolean;
  /** True if bin has a linkedDesignId (regardless of whether design exists) */
  hasLink: boolean;
}

/**
 * Resolve the linked design for a bin.
 *
 * @param linkedDesignId - The bin's linkedDesignId (can be undefined)
 * @returns Object with linkedDesign, isStale flag, and hasLink flag
 */
export function useLinkedDesign(linkedDesignId: DesignId | undefined): UseLinkedDesignResult {
  const registry = useCustomBins();

  return useMemo(() => {
    const hasLink = linkedDesignId !== undefined;
    const linkedDesign = resolveLinkedDesign(linkedDesignId, registry);
    const isStale = hasLink && !linkedDesignExists(linkedDesignId, registry);

    return {
      linkedDesign,
      isStale,
      hasLink,
    };
  }, [linkedDesignId, registry]);
}
