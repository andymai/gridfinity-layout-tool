/**
 * Hook for integrating ML telemetry tracking into bin operations.
 *
 * All tracking functions are lazily loaded — the heavy mlTelemetry module
 * (~104 KB) is only fetched on first tracking call, not at page load.
 *
 * Usage:
 * ```tsx
 * import { mlTracking } from '@/shared/analytics/useMLTracking';
 *
 * // After successful bin creation
 * const result = addBin(binData);
 * if (isOk(result)) {
 *   mlTracking.trackPlacement(binData, 'draw');
 * }
 * ```
 */

import { useCallback } from 'react';
import { useLayoutStore } from '@/core/store/layout';
import type { Bin, Layout } from '@/core/types';
import { useSelectionStore } from '@/core/store/selection';
import type {
  PlacementMethod,
  LayoutSnapshotTrigger,
  QualitySignal,
  DeleteMethod,
  MoveMethod,
  FillMethod,
  LayerMoveMethod,
  RejectionReason,
} from './mlTelemetry/types';
import type * as MlTelemetryNS from './mlTelemetry';

// Re-export types so callers don't need a separate import
export type {
  PlacementMethod,
  LayoutSnapshotTrigger,
  QualitySignal,
  DeleteMethod,
  MoveMethod,
  FillMethod,
  LayerMoveMethod,
  RejectionReason,
};

type MlTelemetryModule = typeof MlTelemetryNS;

// Lazily loaded module cache
let _mlTelemetry: MlTelemetryModule | undefined;
function getMlTelemetry(): Promise<MlTelemetryModule> {
  if (_mlTelemetry) return Promise.resolve(_mlTelemetry);
  return import('./mlTelemetry').then((mod) => {
    _mlTelemetry = mod;
    return mod;
  });
}

/** Fire-and-forget tracking — silently ignores errors (analytics should never crash the app) */
function track(fn: (m: MlTelemetryModule) => void): void {
  void getMlTelemetry()
    .then(fn)
    .catch((error: unknown) => {
      if (import.meta.env.DEV) {
        console.error('[mlTelemetry] tracking failed:', error);
      }
    });
}

/**
 * Hook that provides ML telemetry tracking functions.
 * Automatically captures current layout context.
 */
export function useMLTracking() {
  const trackPlacement = useCallback((bin: Bin, method: PlacementMethod) => {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBinPlacement(bin, layout, method));
  }, []);

  const trackLabel = useCallback(
    (bin: Bin, oldLabel: string | undefined | null, newLabel: string | undefined | null) => {
      track((m) => m.trackLabelUpdate(bin, oldLabel, newLabel));
    },
    []
  );

  const trackBulk = useCallback((bins: Bin[], method: PlacementMethod) => {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBulkPlacement(bins, layout, method));
  }, []);

  const trackSnapshot = useCallback((trigger: LayoutSnapshotTrigger) => {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackLayoutSnapshot(layout, trigger));
  }, []);

  const trackQuality = useCallback((signal: QualitySignal, createdAt?: Date | number) => {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackQualitySignal(layout, signal, createdAt));
  }, []);

  const trackPurpose = useCallback((purpose: string, isCustom: boolean = false) => {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackDrawerPurpose(layout, purpose, isCustom));
  }, []);

  const trackCategory = useCallback((bin: Bin, categoryName: string, batchSize?: number) => {
    track((m) => m.trackCategoryChange(bin, categoryName, batchSize));
  }, []);

  const trackResize = useCallback(
    (
      oldRect: { width: number; depth: number },
      newRect: { width: number; depth: number },
      height: number,
      batchSize?: number
    ) => {
      const layout = useLayoutStore.getState().layout;
      track((m) => m.trackBinResize(oldRect, newRect, height, layout, batchSize));
    },
    []
  );

  const trackDeletion = useCallback((bin: Bin, method: DeleteMethod, batchSize?: number) => {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBinDeletion(bin, layout, method, batchSize));
  }, []);

  const trackMove = useCallback(
    (bin: Bin, oldPosition: { x: number; y: number }, method: MoveMethod, batchSize?: number) => {
      const layout = useLayoutStore.getState().layout;
      track((m) => m.trackBinMove(bin, oldPosition, layout, method, batchSize));
    },
    []
  );

  const trackDrawerResizeHook = useCallback(
    (
      oldDrawer: { width: number; depth: number; height: number },
      newDrawer: { width: number; depth: number; height: number },
      binsStaged?: number
    ) => {
      const layout = useLayoutStore.getState().layout;
      track((m) => m.trackDrawerResize(oldDrawer, newDrawer, layout, binsStaged));
    },
    []
  );

  const trackFill = useCallback(
    (
      method: FillMethod,
      binsCreated: number,
      layerId: string,
      fillSize?: { width: number; depth: number }
    ) => {
      const layout = useLayoutStore.getState().layout;
      track((m) => m.trackFillOperation(method, binsCreated, layerId, layout, fillSize));
    },
    []
  );

  const trackLayerMoveHook = useCallback(
    (
      bin: Bin,
      fromLayerId: string,
      toLayerId: string,
      method: LayerMoveMethod,
      batchSize?: number
    ) => {
      const layout = useLayoutStore.getState().layout;
      track((m) => m.trackLayerMove(bin, fromLayerId, toLayerId, layout, method, batchSize));
    },
    []
  );

  const trackRotation = useCallback((bin: Bin, batchSize?: number) => {
    track((m) => m.trackBinRotation(bin, batchSize));
  }, []);

  return {
    trackPlacement,
    trackLabel,
    trackBulk,
    trackSnapshot,
    trackQuality,
    trackPurpose,
    trackCategory,
    trackResize,
    trackDeletion,
    trackMove,
    trackDrawerResize: trackDrawerResizeHook,
    trackFill,
    trackLayerMove: trackLayerMoveHook,
    trackRotation,
  };
}

/**
 * Non-hook version for use outside of React components.
 * Use this in store actions or event handlers.
 *
 * All methods fire-and-forget: the heavy mlTelemetry module is lazily
 * loaded on first call and cached for subsequent calls.
 */
export const mlTracking = {
  trackPlacement(bin: Bin, method: PlacementMethod): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBinPlacement(bin, layout, method));
  },

  trackLabel(
    bin: Bin,
    oldLabel: string | undefined | null,
    newLabel: string | undefined | null
  ): void {
    track((m) => m.trackLabelUpdate(bin, oldLabel, newLabel));
  },

  trackBulk(bins: Bin[], method: PlacementMethod): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBulkPlacement(bins, layout, method));
  },

  trackSnapshot(trigger: LayoutSnapshotTrigger): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackLayoutSnapshot(layout, trigger));
  },

  trackQuality(signal: QualitySignal, createdAt?: Date | number): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackQualitySignal(layout, signal, createdAt));
  },

  trackPurpose(purpose: string, isCustom: boolean = false): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackDrawerPurpose(layout, purpose, isCustom));
  },

  trackCategory(bin: Bin, categoryName: string, batchSize?: number): void {
    track((m) => m.trackCategoryChange(bin, categoryName, batchSize));
  },

  trackResize(
    oldRect: { width: number; depth: number },
    newRect: { width: number; depth: number },
    height: number,
    batchSize?: number
  ): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBinResize(oldRect, newRect, height, layout, batchSize));
  },

  trackDeletion(bin: Bin, method: DeleteMethod, batchSize?: number): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBinDeletion(bin, layout, method, batchSize));
  },

  trackMove(
    bin: Bin,
    oldPosition: { x: number; y: number },
    method: MoveMethod,
    batchSize?: number
  ): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackBinMove(bin, oldPosition, layout, method, batchSize));
  },

  incrementEdit(): void {
    track((m) => m.incrementEditCount());
  },

  markActivity(): void {
    track((m) => m.markEditActivity());
  },

  trackSession(trigger: 'session_end' | 'layout_switch'): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackSessionSummary(layout, trigger));
  },

  trackDrawerResize(
    oldDrawer: { width: number; depth: number; height: number },
    newDrawer: { width: number; depth: number; height: number },
    binsStaged?: number
  ): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackDrawerResize(oldDrawer, newDrawer, layout, binsStaged));
  },

  trackFill(
    method: FillMethod,
    binsCreated: number,
    layerId: string,
    fillSize?: { width: number; depth: number }
  ): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackFillOperation(method, binsCreated, layerId, layout, fillSize));
  },

  trackLayerMove(
    bin: Bin,
    fromLayerId: string,
    toLayerId: string,
    method: LayerMoveMethod,
    batchSize?: number
  ): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackLayerMove(bin, fromLayerId, toLayerId, layout, method, batchSize));
  },

  trackRotation(bin: Bin, batchSize?: number): void {
    track((m) => m.trackBinRotation(bin, batchSize));
  },

  trackRejection(
    reason: RejectionReason,
    mode: 'draw' | 'paint',
    interaction: { start: { x: number; y: number }; current: { x: number; y: number } } | null
  ): void {
    const layout = useLayoutStore.getState().layout;
    const activeLayerId = useSelectionStore.getState().activeLayerId;
    track((m) => m.trackPlacementRejection(reason, mode, interaction, layout, activeLayerId));
  },

  trackUndoOp(previousLayout: Layout, currentLayout: Layout): void {
    track((m) => m.trackUndo(previousLayout, currentLayout));
  },

  trackQuickCorrect(
    correctionType: 'delete' | 'resize' | 'move',
    binId: string,
    bin: Bin,
    newSize?: { width: number; depth: number; height: number }
  ): void {
    const layout = useLayoutStore.getState().layout;
    track((m) => m.trackQuickCorrection(correctionType, binId, bin, layout, newSize));
  },

  recordCreation(binId: string, method: PlacementMethod, size: string): void {
    track((m) => m.recordBinCreation(binId, method, size));
  },

  recordAction(): void {
    track((m) => m.recordActionTimestamp());
  },

  // ── High-level convenience methods ──────────────────────────────
  // These combine multiple low-level calls that are always used together.
  // Using these instead of the individual calls ensures consistent tracking
  // and avoids forgetting steps like quick-correction detection.

  /**
   * Track deletion of one or more bins, including quick-correction detection.
   *
   * Replaces the 5-line pattern:
   * ```ts
   * mlTracking.trackDeletion(bins[0], source, bins.length);
   * for (const bin of bins) {
   *   mlTracking.trackQuickCorrect('delete', bin.id, bin);
   * }
   * ```
   */
  trackBinsDeletion(bins: Bin[], method: DeleteMethod): void {
    if (bins.length === 0) return;
    this.trackDeletion(bins[0], method, bins.length);
    for (const bin of bins) {
      this.trackQuickCorrect('delete', bin.id, bin);
    }
  },

  /**
   * Track placement of a single bin and record its creation for quick-correction detection.
   *
   * Replaces the 2-line pattern:
   * ```ts
   * mlTracking.trackPlacement(bin, source);
   * mlTracking.recordCreation(bin.id, source, `${bin.width}x${bin.depth}x${bin.height}`);
   * ```
   */
  trackBinCreation(bin: Bin, method: PlacementMethod): void {
    this.trackPlacement(bin, method);
    this.recordCreation(bin.id, method, `${bin.width}x${bin.depth}x${bin.height}`);
  },

  /**
   * Track bulk placement and record creation for each bin (quick-correction detection).
   *
   * Replaces the pattern:
   * ```ts
   * mlTracking.trackBulk(bins, source);
   * for (const bin of bins) {
   *   mlTracking.recordCreation(bin.id, source, `${bin.width}x${bin.depth}x${bin.height}`);
   * }
   * ```
   */
  trackBulkCreation(bins: Bin[], method: PlacementMethod): void {
    if (bins.length === 0) return;
    this.trackBulk(bins, method);
    for (const bin of bins) {
      this.recordCreation(bin.id, method, `${bin.width}x${bin.depth}x${bin.height}`);
    }
  },
};
