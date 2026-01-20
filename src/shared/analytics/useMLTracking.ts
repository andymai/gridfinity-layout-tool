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
import { useSelectionStore } from '@/core/store/selection';
import {
  trackBinPlacement,
  trackLabelUpdate,
  trackBulkPlacement,
  trackLayoutSnapshot,
  trackQualitySignal,
  trackDrawerPurpose,
  trackCategoryChange,
  trackBinResize,
  trackBinDeletion,
  trackBinMove,
  trackDrawerResize,
  trackFillOperation,
  trackLayerMove,
  trackBinRotation,
  trackPlacementRejection,
  trackUndo,
  trackQuickCorrection,
  recordBinCreation,
  recordActionTimestamp,
  incrementEditCount,
  markEditActivity,
  type PlacementMethod,
  type LayoutSnapshotTrigger,
  type QualitySignal,
  type DeleteMethod,
  type MoveMethod,
  type FillMethod,
  type LayerMoveMethod,
  type RejectionReason,
} from './mlTelemetry';
import type { Layout } from '@/core/types';

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

  /**
   * Track a category change on a bin.
   * Only tracks custom categories - default color-based categories are skipped.
   */
  const trackCategory = useCallback(
    (bin: Bin, categoryName: string, batchSize?: number) => {
      trackCategoryChange(bin, categoryName, batchSize);
    },
    []
  );

  /**
   * Track a bin resize.
   */
  const trackResize = useCallback(
    (
      oldRect: { width: number; depth: number },
      newRect: { width: number; depth: number },
      height: number,
      batchSize?: number
    ) => {
      const layout = useLayoutStore.getState().layout;
      trackBinResize(oldRect, newRect, height, layout, batchSize);
    },
    []
  );

  /**
   * Track a bin deletion.
   * Important negative signal for ML training.
   */
  const trackDeletion = useCallback(
    (bin: Bin, method: DeleteMethod, batchSize?: number) => {
      const layout = useLayoutStore.getState().layout;
      trackBinDeletion(bin, layout, method, batchSize);
    },
    []
  );

  /**
   * Track a bin move.
   */
  const trackMove = useCallback(
    (bin: Bin, oldPosition: { x: number; y: number }, method: MoveMethod, batchSize?: number) => {
      const layout = useLayoutStore.getState().layout;
      trackBinMove(bin, oldPosition, layout, method, batchSize);
    },
    []
  );

  /**
   * Track a drawer resize.
   */
  const trackDrawerResizeHook = useCallback(
    (
      oldDrawer: { width: number; depth: number; height: number },
      newDrawer: { width: number; depth: number; height: number },
      binsStaged?: number
    ) => {
      const layout = useLayoutStore.getState().layout;
      trackDrawerResize(oldDrawer, newDrawer, layout, binsStaged);
    },
    []
  );

  /**
   * Track a fill operation.
   */
  const trackFill = useCallback(
    (
      method: FillMethod,
      binsCreated: number,
      layerId: string,
      fillSize?: { width: number; depth: number }
    ) => {
      const layout = useLayoutStore.getState().layout;
      trackFillOperation(method, binsCreated, layerId, layout, fillSize);
    },
    []
  );

  /**
   * Track a layer move.
   */
  const trackLayerMoveHook = useCallback(
    (
      bin: Bin,
      fromLayerId: string,
      toLayerId: string,
      method: LayerMoveMethod,
      batchSize?: number
    ) => {
      const layout = useLayoutStore.getState().layout;
      trackLayerMove(bin, fromLayerId, toLayerId, layout, method, batchSize);
    },
    []
  );

  /**
   * Track a bin rotation.
   */
  const trackRotation = useCallback((bin: Bin, batchSize?: number) => {
    trackBinRotation(bin, batchSize);
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
   * Track a category change.
   * Only tracks custom categories - default color-based categories are skipped.
   */
  trackCategory(bin: Bin, categoryName: string, batchSize?: number): void {
    trackCategoryChange(bin, categoryName, batchSize);
  },

  /**
   * Track a bin resize.
   */
  trackResize(
    oldRect: { width: number; depth: number },
    newRect: { width: number; depth: number },
    height: number,
    batchSize?: number
  ): void {
    const layout = useLayoutStore.getState().layout;
    trackBinResize(oldRect, newRect, height, layout, batchSize);
  },

  /**
   * Track a bin deletion.
   * Important negative signal for ML training.
   */
  trackDeletion(bin: Bin, method: DeleteMethod, batchSize?: number): void {
    const layout = useLayoutStore.getState().layout;
    trackBinDeletion(bin, layout, method, batchSize);
  },

  /**
   * Track a bin move.
   */
  trackMove(bin: Bin, oldPosition: { x: number; y: number }, method: MoveMethod, batchSize?: number): void {
    const layout = useLayoutStore.getState().layout;
    trackBinMove(bin, oldPosition, layout, method, batchSize);
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

  /**
   * Track a drawer resize.
   */
  trackDrawerResize(
    oldDrawer: { width: number; depth: number; height: number },
    newDrawer: { width: number; depth: number; height: number },
    binsStaged?: number
  ): void {
    const layout = useLayoutStore.getState().layout;
    trackDrawerResize(oldDrawer, newDrawer, layout, binsStaged);
  },

  /**
   * Track a fill operation.
   */
  trackFill(
    method: FillMethod,
    binsCreated: number,
    layerId: string,
    fillSize?: { width: number; depth: number }
  ): void {
    const layout = useLayoutStore.getState().layout;
    trackFillOperation(method, binsCreated, layerId, layout, fillSize);
  },

  /**
   * Track a layer move.
   */
  trackLayerMove(
    bin: Bin,
    fromLayerId: string,
    toLayerId: string,
    method: LayerMoveMethod,
    batchSize?: number
  ): void {
    const layout = useLayoutStore.getState().layout;
    trackLayerMove(bin, fromLayerId, toLayerId, layout, method, batchSize);
  },

  /**
   * Track a bin rotation.
   */
  trackRotation(bin: Bin, batchSize?: number): void {
    trackBinRotation(bin, batchSize);
  },

  // ============================================
  // NEGATIVE SIGNAL TRACKING
  // ============================================

  /**
   * Track a placement rejection (cancelled draw/paint).
   * Important negative signal showing what users DON'T want.
   */
  trackRejection(
    reason: RejectionReason,
    mode: 'draw' | 'paint',
    interaction: { start: { x: number; y: number }; current: { x: number; y: number } } | null
  ): void {
    const layout = useLayoutStore.getState().layout;
    const activeLayerId = useSelectionStore.getState().activeLayerId;
    trackPlacementRejection(reason, mode, interaction, layout, activeLayerId);
  },

  /**
   * Track an undo operation.
   * Strong signal that previous action was a mistake.
   */
  trackUndoOp(previousLayout: Layout, currentLayout: Layout): void {
    trackUndo(previousLayout, currentLayout);
  },

  /**
   * Track a quick correction (delete/resize shortly after placement).
   * Indicates the original placement was wrong.
   */
  trackQuickCorrect(
    correctionType: 'delete' | 'resize' | 'move',
    binId: string,
    bin: Bin,
    newSize?: { width: number; depth: number; height: number }
  ): void {
    const layout = useLayoutStore.getState().layout;
    trackQuickCorrection(correctionType, binId, bin, layout, newSize);
  },

  /**
   * Record that a bin was created (for quick-correction detection).
   * Call this after successful bin placement.
   */
  recordCreation(binId: string, method: PlacementMethod, size: string): void {
    recordBinCreation(binId, method, size);
  },

  /**
   * Record that an action was performed (for undo timing).
   * Call this before undoable actions.
   */
  recordAction(): void {
    recordActionTimestamp();
  },
};
