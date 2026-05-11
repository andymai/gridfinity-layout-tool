/**
 * Layout-level trackers — snapshot, drawer purpose, drawer resize, fill,
 * layer move, and the cross-layout pattern emitter that fires from snapshot
 * commits.
 *
 * `trackLayoutSnapshot` rate-limits via MIN_SNAPSHOT_INTERVAL_MS unless the
 * trigger is share or print, and at "permanent" trigger points (save, share,
 * session_end) it also schedules a `trackCrossLayoutPattern` emission for
 * the cross-layout user-pattern model.
 */

import type { Layout, Bin } from '@/core/types';
import type {
  LayoutSnapshotEvent,
  DrawerPurposeEvent,
  DrawerResizedEvent,
  FillOperationEvent,
  LayerMoveEvent,
  CrossLayoutPatternEvent,
  LayoutSnapshotTrigger,
  FillMethod,
  LayerMoveMethod,
} from './types';
import { bufferEvent } from './eventBuffer';
import { layoutSession, MIN_SNAPSHOT_INTERVAL_MS, markEditActivity } from './sessionState';
import {
  computeLayoutHash,
  computeSizeDistribution,
  computeCategoryDistribution,
  computeDomainDistribution,
  computeTopLabelHashes,
  computeLabelSizePairs,
  computeFillPercentage,
  computeLabeledPercentage,
  assessLayoutQuality,
  getUserHash,
} from './computations';
import { STAGING_ID } from '@/core/constants';
import { getGridBins, getLabeledBins } from '@/shared/utils/bins';
import { processLabel, VOCAB_VERSION } from '../labelVocabulary';
import {
  detectArchetype,
  detectSpatialPatterns,
  computeUniformityScore,
  computeEdgeUsage,
} from '../layoutPatterns';
import { computeStructureHash, computeTemporalFields } from '../structureHash';
import {
  inferDrawerPurpose,
  getLabelSizeConsistency,
  recordLayoutLabelSizes,
} from '../purposeInference';
import { isEnabled } from './trackersHelpers';

/** Track a layout snapshot at a commit point. */
export function trackLayoutSnapshot(layout: Layout, trigger: LayoutSnapshotTrigger): void {
  if (!isEnabled()) return;

  const layoutHash = computeLayoutHash(layout);
  const now = Date.now();

  if (trigger !== 'share' && trigger !== 'print') {
    const lastTime = layoutSession.lastSnapshotTime.get(layoutHash);
    if (lastTime && now - lastTime < MIN_SNAPSHOT_INTERVAL_MS) {
      return;
    }
  }

  layoutSession.lastSnapshotTime.set(layoutHash, now);
  const snapshotIndex = (layoutSession.snapshotCounts.get(layoutHash) || 0) + 1;
  layoutSession.snapshotCounts.set(layoutHash, snapshotIndex);

  const bins = getGridBins(layout.bins);
  const temporal = computeTemporalFields();
  const qualityTier = assessLayoutQuality(layout);

  const event: LayoutSnapshotEvent = {
    type: 'layout_snapshot',
    trigger,
    layout_hash: layoutHash,
    snapshot_index: snapshotIndex,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    layer_count: layout.layers.length,
    purpose: layout.purpose || null,
    bin_count: bins.length,
    size_distribution: computeSizeDistribution(layout.bins),
    category_distribution: computeCategoryDistribution(layout.bins),
    domain_distribution: computeDomainDistribution(layout.bins, processLabel),
    top_label_hashes: computeTopLabelHashes(layout.bins, 10, processLabel),
    // Only populated for high-tier snapshots — the server discards pairs from
    // other tiers, so paying the per-bin walk + payload on every idle /
    // layout_switch is pure waste.
    label_size_pairs:
      qualityTier === 'high' ? computeLabelSizePairs(layout.bins, processLabel) : undefined,
    fill_percentage: computeFillPercentage(layout),
    labeled_percentage: computeLabeledPercentage(layout.bins),
    session_duration_ms: layoutSession.editCount > 0 ? Date.now() - layoutSession.startTime : 0,
    edit_count: layoutSession.editCount,
    quality_tier: qualityTier,
    archetype: detectArchetype(layout),
    spatial_patterns: detectSpatialPatterns(layout),
    uniformity_score: computeUniformityScore(bins),
    edge_usage: computeEdgeUsage(bins, layout.drawer),
    hour_of_day: temporal.hour_of_day,
    day_of_week: temporal.day_of_week,
    is_weekend: temporal.is_weekend,
    structure_hash: computeStructureHash(layout),
    vocab_version: VOCAB_VERSION,
  };

  if (trigger === 'save' || trigger === 'share' || trigger === 'session_end') {
    setTimeout(() => trackCrossLayoutPattern(layout), 0);
  }

  bufferEvent(event);
}

/** Track when user sets drawer purpose. */
export function trackDrawerPurpose(
  layout: Layout,
  purpose: string,
  isCustom: boolean = false
): void {
  if (!isEnabled()) return;

  const layoutHash = computeLayoutHash(layout);

  const event: DrawerPurposeEvent = {
    type: 'drawer_purpose',
    layout_hash: layoutHash,
    purpose: purpose.toLowerCase().trim(),
    is_custom: isCustom,
  };

  bufferEvent(event);
}

/** Track a drawer resize event. */
export function trackDrawerResize(
  oldDrawer: { width: number; depth: number; height: number },
  newDrawer: { width: number; depth: number; height: number },
  layout: Layout,
  binsStaged: number = 0
): void {
  if (!isEnabled()) return;

  if (
    oldDrawer.width === newDrawer.width &&
    oldDrawer.depth === newDrawer.depth &&
    oldDrawer.height === newDrawer.height
  )
    return;

  const dimensionsChanged: ('width' | 'depth' | 'height')[] = [];
  if (oldDrawer.width !== newDrawer.width) dimensionsChanged.push('width');
  if (oldDrawer.depth !== newDrawer.depth) dimensionsChanged.push('depth');
  if (oldDrawer.height !== newDrawer.height) dimensionsChanged.push('height');

  const event: DrawerResizedEvent = {
    type: 'drawer_resized',
    old_size: `${oldDrawer.width}x${oldDrawer.depth}x${oldDrawer.height}`,
    new_size: `${newDrawer.width}x${newDrawer.depth}x${newDrawer.height}`,
    dimensions_changed: dimensionsChanged,
    bins_staged: binsStaged,
    fill_pct: computeFillPercentage(layout),
  };

  bufferEvent(event);
}

/** Track a fill operation. */
export function trackFillOperation(
  method: FillMethod,
  binsCreated: number,
  layerId: string,
  layout: Layout,
  fillSize?: { width: number; depth: number }
): void {
  if (!isEnabled()) return;

  if (binsCreated === 0) return;

  const layerIndex = layout.layers.findIndex((l) => l.id === layerId);

  const event: FillOperationEvent = {
    type: 'fill_operation',
    method,
    fill_size: fillSize ? `${fillSize.width}x${fillSize.depth}` : null,
    bins_created: binsCreated,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    fill_pct: computeFillPercentage(layout),
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
  };

  bufferEvent(event);
}

/** Track bins moving between layers. */
export function trackLayerMove(
  bin: Bin,
  fromLayerId: string,
  toLayerId: string,
  layout: Layout,
  method: LayerMoveMethod,
  batchSize: number = 1
): void {
  if (!isEnabled()) return;

  if (fromLayerId === toLayerId) return;

  const fromIndex =
    fromLayerId === STAGING_ID ? -1 : layout.layers.findIndex((l) => l.id === fromLayerId);
  const toIndex =
    toLayerId === STAGING_ID ? -1 : layout.layers.findIndex((l) => l.id === toLayerId);

  const event: LayerMoveEvent = {
    type: 'layer_move',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    from_layer_index: fromIndex >= 0 ? fromIndex : fromLayerId === STAGING_ID ? -1 : 0,
    to_layer_index: toIndex >= 0 ? toIndex : toLayerId === STAGING_ID ? -1 : 0,
    batch_size: batchSize,
    method,
  };

  markEditActivity();
  layoutSession.lastEditTime = Date.now();

  bufferEvent(event);
}

/**
 * Track cross-layout patterns at commit points. Internal — scheduled by
 * `trackLayoutSnapshot` when the trigger is permanent (save / share /
 * session_end).
 */
function trackCrossLayoutPattern(layout: Layout): void {
  if (!isEnabled()) return;

  const gridBins = getGridBins(layout.bins);

  const labeledBins = getLabeledBins(gridBins);
  if (labeledBins.length === 0) return;

  recordLayoutLabelSizes(layout);

  const consistency = getLabelSizeConsistency(layout)
    .sort((a, b) => b.sizesUsed.length - a.sizesUsed.length)
    .slice(0, 10);

  if (consistency.length === 0) return;

  const inference = inferDrawerPurpose(layout);

  const event: CrossLayoutPatternEvent = {
    type: 'cross_layout_pattern',
    user_hash: getUserHash(),
    label_size_consistency: consistency.map((c) => ({
      label_hash: c.labelHash,
      sizes_used: c.sizesUsed,
      is_consistent: c.isConsistent,
    })),
    inferred_purpose: inference.purpose,
    inferred_purpose_confidence: inference.confidence,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
  };

  bufferEvent(event);
}
