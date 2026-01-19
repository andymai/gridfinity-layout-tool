/**
 * Hook for integrating ML telemetry tracking into bin operations.
 *
 * Usage:
 * ```tsx
 * const { trackPlacement, trackLabel } = useMLTracking();
 *
 * // After successful bin creation
 * const result = addBin(binData);
 * if (isOk(result)) {
 *   trackPlacement(binData, 'draw');
 * }
 *
 * // After label update
 * trackLabel(bin, oldLabel, newLabel);
 * ```
 */

import { useCallback } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin } from '@/core/types';
import { trackBinPlacement, trackLabelUpdate, trackBulkPlacement, type PlacementMethod } from './mlTelemetry';

/**
 * Hook that provides ML telemetry tracking functions.
 * Automatically captures current layout context.
 */
export function useMLTracking() {
  /**
   * Track a single bin placement.
   */
  const trackPlacement = useCallback((bin: Bin, method: PlacementMethod) => {
    const layout = useLayoutStore.getState().layout;
    trackBinPlacement(bin, layout, method);
  }, []);

  /**
   * Track a label update on an existing bin.
   */
  const trackLabel = useCallback(
    (bin: Bin, oldLabel: string | undefined | null, newLabel: string | undefined | null) => {
      trackLabelUpdate(bin, oldLabel, newLabel);
    },
    []
  );

  /**
   * Track bulk bin placement (e.g., from fill operation).
   */
  const trackBulk = useCallback((bins: Bin[], method: PlacementMethod) => {
    const layout = useLayoutStore.getState().layout;
    trackBulkPlacement(bins, layout, method);
  }, []);

  return {
    trackPlacement,
    trackLabel,
    trackBulk,
  };
}

/**
 * Non-hook version for use outside of React components.
 * Use this in store actions or event handlers.
 */
export const mlTracking = {
  /**
   * Track a single bin placement.
   */
  trackPlacement(bin: Bin, method: PlacementMethod): void {
    const layout = useLayoutStore.getState().layout;
    trackBinPlacement(bin, layout, method);
  },

  /**
   * Track a label update.
   */
  trackLabel(bin: Bin, oldLabel: string | undefined | null, newLabel: string | undefined | null): void {
    trackLabelUpdate(bin, oldLabel, newLabel);
  },

  /**
   * Track bulk placement.
   */
  trackBulk(bins: Bin[], method: PlacementMethod): void {
    const layout = useLayoutStore.getState().layout;
    trackBulkPlacement(bins, layout, method);
  },
};
