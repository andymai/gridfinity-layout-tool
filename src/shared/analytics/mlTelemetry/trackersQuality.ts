/**
 * Quality / negative-signal trackers — quality tier, placement rejections,
 * undo, quick corrections, and the session summary that fires at session-end
 * or layout-switch.
 *
 * These events feed the abandonment and confidence-scoring models that
 * decide whether a layout is "real" before downstream training pipelines
 * consume it.
 */

import type { Layout, Bin } from '@/core/types';
import type {
  LayoutQualityEvent,
  PlacementRejectedEvent,
  UndoEvent,
  QuickCorrectionEvent,
  SessionSummaryEvent,
  QualitySignal,
  RejectionReason,
  UndoActionType,
} from './types';
import { bufferEvent } from './eventBuffer';
import {
  sessionState,
  layoutSession,
  getBinCreationRecord,
  removeBinCreationRecord,
  getTimeSinceLastAction,
  markEditActivity,
  QUICK_CORRECTION_THRESHOLD_MS,
} from './sessionState';
import {
  computeLayoutHash,
  computeFillPercentage,
  computeSessionConfidence,
  computeConfidenceBreakdown,
  detectAbandonmentType,
} from './computations';
import { getGridBins } from '@/shared/utils/bins';
import { isEnabled } from './trackersHelpers';

/** Track a quality signal for a layout. */
export function trackQualitySignal(
  layout: Layout,
  signal: QualitySignal,
  createdAt?: Date | number
): void {
  if (!isEnabled()) return;

  const layoutHash = computeLayoutHash(layout);

  let daysSinceCreation = 0;
  if (createdAt) {
    const createdTime = typeof createdAt === 'number' ? createdAt : createdAt.getTime();
    daysSinceCreation = Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24));
  }

  const confidenceBreakdown = computeConfidenceBreakdown(layout);
  const abandonmentType = detectAbandonmentType(layout, signal);
  const timeSinceLastEditMs = Date.now() - layoutSession.lastEditTime;

  const event: LayoutQualityEvent = {
    type: 'layout_quality',
    layout_hash: layoutHash,
    signal,
    days_since_creation: daysSinceCreation,
    confidence_breakdown: confidenceBreakdown,
    abandonment_type: abandonmentType,
    time_since_last_edit_ms: timeSinceLastEditMs,
  };

  bufferEvent(event);
}

/** Track a placement rejection (cancelled draw/paint). */
export function trackPlacementRejection(
  reason: RejectionReason,
  mode: 'draw' | 'paint',
  interaction: { start: { x: number; y: number }; current: { x: number; y: number } } | null,
  layout: Layout,
  activeLayerId: string
): void {
  if (!isEnabled()) return;

  let intendedSize: string | null = null;
  let intendedPosition: string | null = null;

  if (interaction) {
    const x1 = Math.min(interaction.start.x, interaction.current.x);
    const y1 = Math.min(interaction.start.y, interaction.current.y);
    const x2 = Math.max(interaction.start.x, interaction.current.x);
    const y2 = Math.max(interaction.start.y, interaction.current.y);

    const width = x2 - x1 + 1;
    const depth = y2 - y1 + 1;

    if (width > 0 && depth > 0) {
      intendedSize = `${width}x${depth}`;
      intendedPosition = `${x1},${y1}`;
    }
  }

  if (!intendedSize && reason !== 'cancelled') return;

  const layerIndex = layout.layers.findIndex((l) => l.id === activeLayerId);

  const event: PlacementRejectedEvent = {
    type: 'placement_rejected',
    rejection_reason: reason,
    intended_size: intendedSize,
    intended_position: intendedPosition,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    fill_pct: computeFillPercentage(layout),
    mode,
  };

  bufferEvent(event);
}

/** Track an undo operation. */
export function trackUndo(previousLayout: Layout, currentLayout: Layout): void {
  if (!isEnabled()) return;

  const prevBins = getGridBins(previousLayout.bins);
  const currBins = getGridBins(currentLayout.bins);

  const prevBinIds = new Set(prevBins.map((b) => b.id));
  const currBinIds = new Set(currBins.map((b) => b.id));

  const addedBins = currBins.filter((b) => !prevBinIds.has(b.id));
  const removedBins = prevBins.filter((b) => !currBinIds.has(b.id));

  let actionUndone: UndoActionType = 'other';
  let binsAffected = 0;

  if (removedBins.length > 0 && addedBins.length === 0) {
    actionUndone = 'placement';
    binsAffected = removedBins.length;
  } else if (addedBins.length > 0 && removedBins.length === 0) {
    actionUndone = 'deletion';
    binsAffected = addedBins.length;
  } else if (addedBins.length === 0 && removedBins.length === 0) {
    const changedBins = currBins.filter((currBin) => {
      const prevBin = prevBins.find((b) => b.id === currBin.id);
      if (!prevBin) return false;
      return (
        prevBin.x !== currBin.x ||
        prevBin.y !== currBin.y ||
        prevBin.width !== currBin.width ||
        prevBin.depth !== currBin.depth ||
        prevBin.layerId !== currBin.layerId
      );
    });

    if (changedBins.length > 0) {
      const prevBin = prevBins.find((b) => b.id === changedBins[0].id);
      const currBin = changedBins[0];
      if (prevBin) {
        if (prevBin.width !== currBin.width || prevBin.depth !== currBin.depth) {
          actionUndone = 'resize';
        } else if (prevBin.layerId !== currBin.layerId) {
          actionUndone = 'layer_change';
        } else {
          actionUndone = 'move';
        }
      }
      binsAffected = changedBins.length;
    }
  } else {
    actionUndone = 'other';
    binsAffected = Math.max(addedBins.length, removedBins.length);
  }

  if (
    previousLayout.drawer.width !== currentLayout.drawer.width ||
    previousLayout.drawer.depth !== currentLayout.drawer.depth ||
    previousLayout.drawer.height !== currentLayout.drawer.height
  ) {
    actionUndone = 'drawer_resize';
  }

  if (actionUndone === 'placement' && binsAffected >= 3) {
    actionUndone = 'fill';
  }

  const event: UndoEvent = {
    type: 'undo',
    action_undone: actionUndone,
    bins_affected: binsAffected,
    time_since_action_ms: getTimeSinceLastAction(),
    drawer_size: `${currentLayout.drawer.width}x${currentLayout.drawer.depth}x${currentLayout.drawer.height}`,
  };

  layoutSession.undoCount++;
  markEditActivity();

  bufferEvent(event);
}

/** Track a quick correction (delete/resize shortly after placement). */
export function trackQuickCorrection(
  correctionType: 'delete' | 'resize' | 'move',
  binId: string,
  bin: Bin,
  layout: Layout,
  newSize?: { width: number; depth: number; height: number }
): void {
  if (!isEnabled()) return;

  const record =
    correctionType === 'delete' ? removeBinCreationRecord(binId) : getBinCreationRecord(binId);

  if (!record) return;

  const timeSincePlacement = Date.now() - record.createdAt;

  if (timeSincePlacement > QUICK_CORRECTION_THRESHOLD_MS) return;

  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  const event: QuickCorrectionEvent = {
    type: 'quick_correction',
    correction_type: correctionType,
    original_size: record.originalSize,
    new_size: newSize ? `${newSize.width}x${newSize.depth}x${newSize.height}` : null,
    placement_method: record.method,
    time_to_correction_ms: timeSincePlacement,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
  };

  bufferEvent(event);
}

/** Track a session summary event. */
export function trackSessionSummary(
  layout: Layout,
  trigger: 'session_end' | 'layout_switch'
): void {
  if (!isEnabled()) return;

  if (sessionState.sessionIndex === 0 && layoutSession.editCount === 0) return;

  const binsPlaced = sessionState.sessionIndex;
  const sessionDurationMs = Date.now() - layoutSession.startTime;

  const timeToFirstBinMs =
    sessionState.firstBinTime !== null ? sessionState.firstBinTime - layoutSession.startTime : null;

  const totalCorrections =
    layoutSession.deletedCount + layoutSession.resizeCount + layoutSession.moveCount;
  const editToDoneRatio =
    binsPlaced > 0 ? Math.round((totalCorrections / binsPlaced) * 100) / 100 : 0;

  const confidenceScore = computeSessionConfidence(
    binsPlaced,
    layoutSession.undoCount,
    layoutSession.deletedCount,
    layoutSession.resizeCount,
    layoutSession.moveCount,
    sessionDurationMs
  );

  const event: SessionSummaryEvent = {
    type: 'session_summary',
    bins_placed: binsPlaced,
    bins_deleted: layoutSession.deletedCount,
    edits_total: layoutSession.editCount,
    time_to_first_bin_ms: timeToFirstBinMs,
    session_duration_ms: sessionDurationMs,
    size_sequence: [...sessionState.sizeSequence],
    edit_to_done_ratio: editToDoneRatio,
    undo_count: layoutSession.undoCount,
    confidence_score: confidenceScore,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    final_fill_pct: computeFillPercentage(layout),
  };

  bufferEvent(event, trigger === 'session_end');
}
