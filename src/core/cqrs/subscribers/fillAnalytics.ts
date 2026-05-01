/**
 * Fill Analytics Event Subscriber
 *
 * Replaces the v1 `_fillMeta` side-channel: instead of the bulkActions
 * setter writing transient metadata into the layout store for the
 * `layoutAnalytics` subscriber to read-and-clear, the v2 fill commands
 * carry `fillType` / `width` / `depth` directly in the `bin.layerFilled`
 * event payload, and this subscriber forwards to the existing PostHog +
 * mlTracking helpers.
 *
 * v1 events without `fillType` (pre-migration persisted events replayed
 * via the event store) are silently ignored here — the analytics call
 * sites all expected the metadata, and re-emitting them after the fact
 * would distort current-period metrics.
 */

import { mlTracking } from '@/shared/analytics/useMLTracking';
import { markFeatureUsed, trackFillOperation, trackBinCreated } from '@/shared/analytics/posthog';
import type { UnsubscribeFn } from '../types';
import type { EventBus } from '../bus/eventBus';

/**
 * Connect the fill-analytics subscriber to the event bus. Returns an
 * unsubscribe function for symmetry with the other subscribers.
 */
export function connectFillAnalytics(bus: EventBus): UnsubscribeFn {
  return bus.subscribe('bin.layerFilled', (event) => {
    const { layerId, fillType, width, depth, bins } = event.payload;
    if (!fillType) return; // pre-v2 event without enough metadata

    const count = bins.length;
    if (count === 0) return;

    // Derive layerHeight from the placed bins — the v1 _fillMeta field
    // stored layer.height which (after a fill) equals every fill-bin's
    // height. Using the bin avoids a separate layout lookup.
    const layerHeight = bins[0].height as number;

    mlTracking.trackFill(
      fillType,
      count,
      layerId,
      fillType === 'uniform' && width !== undefined && depth !== undefined
        ? { width, depth }
        : undefined
    );
    markFeatureUsed('fill');
    trackFillOperation(fillType === 'uniform' ? 'fill_layer' : 'fill_gaps', count);
    trackBinCreated({
      method: fillType === 'uniform' ? 'fill_layer' : 'fill_gaps',
      count,
      ...(fillType === 'uniform' && width !== undefined && depth !== undefined
        ? { width, depth, height: layerHeight }
        : {}),
    });
  });
}
