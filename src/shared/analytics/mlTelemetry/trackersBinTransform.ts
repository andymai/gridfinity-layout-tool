/**
 * Bin transform trackers — resize, move, deletion, rotation.
 *
 * Each event captures the dimensional change and updates the running session
 * counts that feed the session-confidence score and abandonment detection.
 *
 * Deletion has special-case logic for the `bin_abandoned` event: if a single
 * unlabeled bin is removed within ABANDONED_THRESHOLD_MS of placement, the
 * tracker emits an abandonment event in addition to the normal bin_deleted.
 */

import type { Layout, Bin } from '@/core/types';
import type {
  BinResizeEvent,
  BinDeletedEvent,
  AbandonedBinEvent,
  BinMovedEvent,
  BinRotatedEvent,
  DeleteMethod,
  MoveMethod,
} from './types';
import { bufferEvent } from './eventBuffer';
import { layoutSession, removeBinCreationRecord, markEditActivity } from './sessionState';
import { computeFillPercentage } from './computations';
import { STAGING_ID } from '@/core/constants';
import { processLabel } from '../labelVocabulary';
import { isEnabled } from './trackersHelpers';

/** Track a bin resize event. */
export function trackBinResize(
  oldRect: { width: number; depth: number },
  newRect: { width: number; depth: number },
  height: number,
  layout: Layout,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  if (oldRect.width === newRect.width && oldRect.depth === newRect.depth) return;

  const dimensionsChanged: ('width' | 'depth')[] = [];
  if (oldRect.width !== newRect.width) dimensionsChanged.push('width');
  if (oldRect.depth !== newRect.depth) dimensionsChanged.push('depth');

  const oldArea = oldRect.width * oldRect.depth;
  const newArea = newRect.width * newRect.depth;
  const areaDelta = newArea - oldArea;

  const widthGrew = newRect.width > oldRect.width;
  const depthGrew = newRect.depth > oldRect.depth;
  const widthShrank = newRect.width < oldRect.width;
  const depthShrank = newRect.depth < oldRect.depth;

  let resizeDirection: 'grow' | 'shrink' | 'mixed';
  if ((widthGrew || depthGrew) && !widthShrank && !depthShrank) {
    resizeDirection = 'grow';
  } else if ((widthShrank || depthShrank) && !widthGrew && !depthGrew) {
    resizeDirection = 'shrink';
  } else {
    resizeDirection = 'mixed';
  }

  const event: BinResizeEvent = {
    type: 'bin_resized',
    old_size: `${oldRect.width}x${oldRect.depth}x${height}`,
    new_size: `${newRect.width}x${newRect.depth}x${height}`,
    dimensions_changed: dimensionsChanged,
    batch_size: batchSize,
    fill_pct: computeFillPercentage(layout),
    resize_direction: resizeDirection,
    area_delta: areaDelta,
  };

  layoutSession.resizeCount += batchSize;
  layoutSession.lastEditTime = Date.now();

  bufferEvent(event);
}

/** Track a bin deletion event. Also emits bin_abandoned for short-lived unlabeled bins. */
export function trackBinDeletion(
  bin: Bin,
  layout: Layout,
  method: DeleteMethod,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  let labelDomain: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelDomain = labelData.domain;
  }

  const currentFill = computeFillPercentage(layout);
  const totalArea = layout.drawer.width * layout.drawer.depth;
  const binArea = bin.width * bin.depth;
  const subtractsFromFill = bin.layerId !== STAGING_ID;
  const fillAfter =
    totalArea > 0
      ? subtractsFromFill
        ? Math.max(0, currentFill - Math.round((binArea / totalArea) * 100))
        : currentFill
      : 0;

  const creationRecord = removeBinCreationRecord(bin.id);
  const ageMs = creationRecord ? Date.now() - creationRecord.createdAt : null;

  const ABANDONED_THRESHOLD_MS = 300_000;

  if (
    creationRecord &&
    ageMs !== null &&
    ageMs < ABANDONED_THRESHOLD_MS &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
    !bin.label?.trim() &&
    batchSize === 1
  ) {
    const abandonedEvent: AbandonedBinEvent = {
      type: 'bin_abandoned',
      bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
      position: `${bin.x},${bin.y}`,
      layer_index: layerIndex >= 0 ? layerIndex : 0,
      lifetime_ms: ageMs,
      creation_method: creationRecord.method,
      fill_pct: fillAfter,
      drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    };
    bufferEvent(abandonedEvent);
  }

  const event: BinDeletedEvent = {
    type: 'bin_deleted',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    position: `${bin.x},${bin.y}`,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
    had_label: Boolean(bin.label?.trim()),
    label_domain: labelDomain,
    age_ms: ageMs,
    batch_size: batchSize,
    fill_pct: fillAfter,
    method,
  };

  layoutSession.deletedCount += batchSize;
  layoutSession.lastEditTime = Date.now();

  bufferEvent(event);
}

/** Track a bin move event. */
export function trackBinMove(
  bin: Bin,
  oldPosition: { x: number; y: number },
  layout: Layout,
  method: MoveMethod,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  if (oldPosition.x === bin.x && oldPosition.y === bin.y) return;

  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);
  const distance = Math.abs(bin.x - oldPosition.x) + Math.abs(bin.y - oldPosition.y);

  const event: BinMovedEvent = {
    type: 'bin_moved',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    old_position: `${oldPosition.x},${oldPosition.y}`,
    new_position: `${bin.x},${bin.y}`,
    distance,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    batch_size: batchSize,
    method,
  };

  layoutSession.moveCount += batchSize;
  layoutSession.lastEditTime = Date.now();

  bufferEvent(event);
}

/** Track a bin rotation event. */
export function trackBinRotation(bin: Bin, batchSize: number = 1): void {
  if (!isEnabled()) return;

  const event: BinRotatedEvent = {
    type: 'bin_rotated',
    old_size: `${bin.width}x${bin.depth}x${bin.height}`,
    new_size: `${bin.depth}x${bin.width}x${bin.height}`,
    batch_size: batchSize,
  };

  markEditActivity();
  layoutSession.lastEditTime = Date.now();

  bufferEvent(event);
}
