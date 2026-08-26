/**
 * Manages the cutout editor quickstart overlay localStorage flag.
 */

import { useCallback } from 'react';
import { createLocalStorageFlagStore } from '@/shared/hooks/createLocalStorageFlagStore';

const store = createLocalStorageFlagStore({
  quickstartSeen: 'gridfinity-cutout-quickstart-seen',
});

export interface UseCutoutQuickstartReturn {
  /** Whether the quickstart overlay has been dismissed at least once */
  quickstartSeen: boolean;
  /** Mark the quickstart as seen (persists to localStorage) */
  markQuickstartSeen: () => void;
}

export function useCutoutQuickstart(): UseCutoutQuickstartReturn {
  const { quickstartSeen } = store.useFlags();

  const markQuickstartSeen = useCallback(() => {
    store.setFlag('quickstartSeen');
  }, []);

  return { quickstartSeen, markQuickstartSeen };
}
