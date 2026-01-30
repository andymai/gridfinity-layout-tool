/**
 * Store analytics subscribers.
 *
 * Reacts to store state changes and fires analytics events.
 * This keeps analytics concerns out of the store actions themselves,
 * making them pure state mutations that are easier to test.
 */

import { mlTracking } from '@/shared/analytics/useMLTracking';
import {
  markFeatureUsed,
  trackFillOperation,
  trackBinCreated,
  trackPaintMode,
} from '@/shared/analytics/posthog';
import { useLayoutStore, type FillMeta } from './layout';
import { useInteractionStore, type PaintSize } from './interaction';
import type { Layout } from '@/core/types';

export type { FillMeta };

/**
 * Initialize store analytics subscribers.
 * Call once at app startup to begin tracking store mutations.
 */
export function initLayoutAnalytics(): () => void {
  let prevLayout: Layout = useLayoutStore.getState().layout;
  let prevPaintSize: PaintSize | null = useInteractionStore.getState().paintSize;

  const unsubLayout = useLayoutStore.subscribe((state) => {
    const curr = state.layout;

    // Track multi-layer usage when a new layer is added (2+ layers)
    if (curr.layers.length > prevLayout.layers.length && curr.layers.length >= 2) {
      markFeatureUsed('multi_layer');
    }

    // Track custom category usage when a category is added
    if (curr.categories.length > prevLayout.categories.length) {
      markFeatureUsed('custom_categories');
    }

    // Track fill operations via _fillMeta
    const meta = state._fillMeta;
    if (meta) {
      const w = meta.width ?? 1;
      const d = meta.depth ?? 1;
      mlTracking.trackFill(
        meta.type,
        meta.count,
        meta.layerId,
        meta.type === 'uniform' ? { width: w, depth: d } : undefined
      );
      markFeatureUsed('fill');
      trackFillOperation(meta.type === 'uniform' ? 'fill_layer' : 'fill_gaps', meta.count);
      trackBinCreated(
        meta.type === 'uniform' ? 'fill_layer' : 'fill_gaps',
        meta.count,
        meta.type === 'uniform' ? { width: w, depth: d, height: meta.layerHeight ?? 1 } : undefined
      );

      // Clear fill meta after consuming.
      // This setState triggers the subscriber again, but the if(meta) guard
      // above prevents any repeated work on the second invocation.
      useLayoutStore.setState({ _fillMeta: null });
    }

    prevLayout = curr;
  });

  // Track paint mode entry/exit
  const unsubInteraction = useInteractionStore.subscribe((state) => {
    const currPaintSize = state.paintSize;
    if (currPaintSize && !prevPaintSize) {
      trackPaintMode('entered');
    } else if (!currPaintSize && prevPaintSize) {
      trackPaintMode('exited');
    }
    prevPaintSize = currPaintSize;
  });

  return () => {
    unsubLayout();
    unsubInteraction();
  };
}
