/**
 * Store analytics subscribers.
 *
 * Reacts to store state changes and fires analytics events.
 * This keeps analytics concerns out of the store actions themselves,
 * making them pure state mutations that are easier to test.
 *
 * Note: fill-operation analytics (uniform/gaps fills) used to live here
 * via the `_fillMeta` side-channel set by bulkActions. As of the v2
 * defineCommand migration that path is gone — fill events now flow via
 * `cqrs/subscribers/fillAnalytics.ts` which subscribes to the
 * `bin.layerFilled` domain event directly.
 */

import { markFeatureUsed, trackPaintMode } from '@/shared/analytics/posthog';
import { useLayoutStore } from './layout';
import { useInteractionStore, type PaintSize } from './interaction';

/**
 * Initialize store analytics subscribers.
 * Call once at app startup to begin tracking store mutations.
 */
export function initLayoutAnalytics(): () => void {
  const initialLayout = useLayoutStore.getState().layout;
  let prevLayerCount = initialLayout.layers.length;
  let prevCategoryCount = initialLayout.categories.length;
  let prevPaintSize: PaintSize | null = useInteractionStore.getState().paintSize;

  const unsubLayout = useLayoutStore.subscribe((state) => {
    const curr = state.layout;

    // Track multi-layer usage when a new layer is added (2+ layers)
    if (curr.layers.length > prevLayerCount && curr.layers.length >= 2) {
      markFeatureUsed('multi_layer');
    }

    // Track custom category usage when a category is added
    if (curr.categories.length > prevCategoryCount) {
      markFeatureUsed('custom_categories');
    }

    prevLayerCount = curr.layers.length;
    prevCategoryCount = curr.categories.length;
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
