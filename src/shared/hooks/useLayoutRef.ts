/**
 * Subscribes to the layout store and keeps a mutable ref with the latest layout.
 *
 * Useful for event-bus handlers that need the current layout without
 * triggering re-renders or risking stale closures.
 */

import { useEffect, useRef } from 'react';
import { useLayoutStore } from '@/core/store';
import type { Layout } from '@/core/types';

export function useLayoutRef(): React.RefObject<Layout> {
  const ref = useRef(useLayoutStore.getState().layout);

  useEffect(() => {
    return useLayoutStore.subscribe((state) => {
      ref.current = state.layout;
    });
  }, []);

  return ref;
}
