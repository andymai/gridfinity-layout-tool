import { useSyncExternalStore } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import { linkedExcessCacheKey, subscribeLinkedExcess } from '@/shared/utils/collision';

function subscribe(onChange: () => void): () => void {
  const offRise = subscribeLinkedExcess(onChange);
  const offLayout = useLayoutStore.subscribe(onChange);
  return () => {
    offRise();
    offLayout();
  };
}

/**
 * Changes whenever a linked design's extra rise may have: a design saved in
 * any tab, or the layout's height unit or base profile. Resting heights read
 * that rise, so anything memoised on a layout's bins and layers alone must
 * also depend on this key.
 */
export function useLinkedRiseKey(): string {
  return useSyncExternalStore(subscribe, linkedExcessCacheKey);
}
