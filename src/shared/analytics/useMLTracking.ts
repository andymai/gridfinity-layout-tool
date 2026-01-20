/**
 * Hook for integrating ML telemetry tracking into bin operations.
 *
 * Usage:
 * ```tsx
 * const { trackPlacement, trackLabel, trackSnapshot } = useMLTracking();
 *
 * // After successful bin creation
 * const result = addBin(binData);
 * if (isOk(result)) {
 *   trackPlacement(binData, 'draw');
 * }
 *
 * // After label update
 * trackLabel(bin, oldLabel, newLabel);
 *
 * // On layout save/export/share
 * trackSnapshot('save');
 * ```
 */

import { useCallback } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin } from '@/core/types';
import {
  trackBinPlacement,
  trackLabelUpdate,
  trackBulkPlacement,
  trackLayoutSnapshot,
  trackQualitySignal,
  trackDrawerPurpose,
  incrementEditCount,
  markEditActivity,
  type PlacementMethod,
  type LayoutSnapshotTrigger,
  type QualitySignal,
} from './mlTelemetry';

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

  /**
   * Track a layout snapshot at a commit point.
   */
  const trackSnapshot = useCallback((trigger: LayoutSnapshotTrigger) => {
    const layout = useLayoutStore.getState().layout;
    trackLayoutSnapshot(layout, trigger);
  }, []);

  /**
   * Track a quality signal for the current layout.
   */
  const trackQuality = useCallback((signal: QualitySignal, createdAt?: Date | number) => {
    const layout = useLayoutStore.getState().layout;
    trackQualitySignal(layout, signal, createdAt);
  }, []);

  /**
   * Track drawer purpose selection.
   */
  const trackPurpose = useCallback((purpose: string, isCustom: boolean = false) => {
    const layout = useLayoutStore.getState().layout;
    trackDrawerPurpose(layout, purpose, isCustom);
  }, []);

  return {
    trackPlacement,
    trackLabel,
    trackBulk,
    trackSnapshot,
    trackQuality,
    trackPurpose,
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

  /**
   * Track a layout snapshot at a commit point.
   */
  trackSnapshot(trigger: LayoutSnapshotTrigger): void {
    const layout = useLayoutStore.getState().layout;
    trackLayoutSnapshot(layout, trigger);
  },

  /**
   * Track a quality signal for the current layout.
   */
  trackQuality(signal: QualitySignal, createdAt?: Date | number): void {
    const layout = useLayoutStore.getState().layout;
    trackQualitySignal(layout, signal, createdAt);
  },

  /**
   * Track drawer purpose selection.
   */
  trackPurpose(purpose: string, isCustom: boolean = false): void {
    const layout = useLayoutStore.getState().layout;
    trackDrawerPurpose(layout, purpose, isCustom);
  },

  /**
   * Increment edit count for session tracking.
   * Call when bins are modified.
   */
  incrementEdit(): void {
    incrementEditCount();
  },

  /**
   * Mark that an edit occurred (resets idle timer).
   * Call when bins are modified.
   */
  markActivity(): void {
    markEditActivity();
  },
};
