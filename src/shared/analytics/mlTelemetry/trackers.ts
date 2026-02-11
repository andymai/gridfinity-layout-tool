import type { Layout, Bin } from '@/core/types';
import type {
  BinPlacementEvent,
  LabelUpdateEvent,
  LayoutSnapshotEvent,
  LayoutQualityEvent,
  DrawerPurposeEvent,
  CategoryChangeEvent,
  BinResizeEvent,
  BinDeletedEvent,
  AbandonedBinEvent,
  BinMovedEvent,
  DrawerResizedEvent,
  FillOperationEvent,
  LayerMoveEvent,
  BinRotatedEvent,
  PlacementRejectedEvent,
  UndoEvent,
  QuickCorrectionEvent,
  SessionSummaryEvent,
  CrossLayoutPatternEvent,
  PlacementMethod,
  DeleteMethod,
  MoveMethod,
  FillMethod,
  LayerMoveMethod,
  RejectionReason,
  UndoActionType,
  LayoutSnapshotTrigger,
  QualitySignal,
} from './types';
import { bufferEvent, SAMPLING_THRESHOLD, SAMPLING_RATE } from './eventBuffer';
import {
  sessionState,
  layoutSession,
  MIN_SNAPSHOT_INTERVAL_MS,
  recordBinCreation,
  getBinCreationRecord,
  removeBinCreationRecord,
  getTimeSinceLastAction,
  markEditActivity,
  QUICK_CORRECTION_THRESHOLD_MS,
} from './sessionState';
import {
  assessLayoutQuality,
  isSubstantialLayout,
  computeLayoutHash,
  computeSizeDistribution,
  computeCategoryDistribution,
  computeDomainDistribution,
  computeTopLabelHashes,
  computeFillPercentage,
  computeLabeledPercentage,
  computeSessionConfidence,
  computeConfidenceBreakdown,
  detectAbandonmentType,
  isDefaultCategoryName,
  hashCategoryName,
  getUserHash,
} from './computations';
import { STAGING_ID } from '@/core/constants';
import { getGridBins, getLabeledBins } from '@/shared/utils/bins';
import { useSettingsStore } from '@/core/store/settings';
import { processLabel, VOCAB_VERSION } from '../labelVocabulary';
import { analyzeGaps } from '../gapAnalysis';
import {
  detectArchetype,
  detectSpatialPatterns,
  computeUniformityScore,
  computeEdgeUsage,
  areBinsAdjacent,
} from '../layoutPatterns';
import { computeStructureHash, computeTemporalFields } from '../structureHash';
import {
  inferDrawerPurpose,
  getLabelSizeConsistency,
  recordLayoutLabelSizes,
} from '../purposeInference';

// ============================================
// COMMON UTILITIES
// ============================================

/**
 * Check if analytics/telemetry is enabled.
 */
export function isEnabled(): boolean {
  const settings = useSettingsStore.getState().settings;
  return settings.analyticsEnabled;
}

/**
 * Get labels and sizes of bins adjacent to the given bin on the same layer.
 */
function getAdjacentBinContext(
  bin: Bin,
  layout: Layout
): { labelHashes: string[]; sizes: string[]; count: number } {
  const sameLevelBins = layout.bins.filter((b) => b.layerId === bin.layerId && b.id !== bin.id);

  const adjacentLabelHashes: string[] = [];
  const adjacentSizes: string[] = [];

  for (const other of sameLevelBins) {
    if (areBinsAdjacent(bin, other)) {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
      if (other.label?.trim()) {
        const labelData = processLabel(other.label);
        adjacentLabelHashes.push(labelData.hash);
      }
      adjacentSizes.push(`${other.width}x${other.depth}x${other.height}`);
    }
  }

  return {
    labelHashes: adjacentLabelHashes.slice(0, 4),
    sizes: adjacentSizes.slice(0, 4),
    count: adjacentSizes.length,
  };
}

// ============================================
// BIN PLACEMENT TRACKING
// ============================================

/**
 * Track a bin placement event.
 */
export function trackBinPlacement(bin: Bin, layout: Layout, method: PlacementMethod): void {
  if (!isEnabled()) return;

  // Apply sampling for high-volume sessions
  const shouldSample =
    sessionState.sessionIndex >= SAMPLING_THRESHOLD &&
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
    !bin.label?.trim() &&
    Math.random() > SAMPLING_RATE;

  if (shouldSample) {
    const binSize = `${bin.width}x${bin.depth}x${bin.height}`;
    sessionState.prevBinSize = binSize;
    sessionState.sessionIndex++;
    if (sessionState.sizeSequence.length < 100) {
      sessionState.sizeSequence.push(binSize);
    }
    if (sessionState.firstBinTime === null) {
      sessionState.firstBinTime = Date.now();
    }
    layoutSession.lastEditTime = Date.now();
    return;
  }

  const layerIndex = layout.layers.findIndex((l) => l.id === bin.layerId);

  const gapAnalysis = analyzeGaps(layout, bin.layerId, {
    width: bin.width,
    depth: bin.depth,
  });

  let labelHash: string | null = null;
  let labelNormalized: string | null = null;
  let labelDomain: string | null = null;
  let labelEmbeddingBucket: string | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelHash = labelData.hash;
    labelNormalized = labelData.normalized;
    labelDomain = labelData.domain;
    labelEmbeddingBucket = labelData.embedding_bucket;
  }

  const adjacentContext = getAdjacentBinContext(bin, layout);

  const now = Date.now();
  const lastPlacement = layoutSession.recentPlacements[layoutSession.recentPlacements.length - 1];
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- recentPlacements can be empty at runtime
  const timeSinceLastMs = lastPlacement ? now - lastPlacement.timestamp : null;

  const isFirstOfLabel =
    labelHash !== null && !layoutSession.recentPlacements.some((p) => p.labelHash === labelHash);

  const recentSizes = layoutSession.recentPlacements.slice(-3).map((p) => p.size);

  const binSize = `${bin.width}x${bin.depth}x${bin.height}`;

  const event: BinPlacementEvent = {
    type: 'bin_placed',
    bin_size: binSize,
    prev_bin_size: sessionState.prevBinSize,
    drawer_size: `${layout.drawer.width}x${layout.drawer.depth}x${layout.drawer.height}`,
    position: `${bin.x},${bin.y}`,
    layer_index: layerIndex >= 0 ? layerIndex : 0,
    largest_gap: gapAnalysis.largestGap,
    fill_pct: gapAnalysis.fillPct,
    gap_fit: gapAnalysis.gapFit,
    label_hash: labelHash,
    label_normalized: labelNormalized,
    label_domain: labelDomain,
    label_embedding_bucket: labelEmbeddingBucket,
    category_id: bin.category,
    adjacent_label_hashes: adjacentContext.labelHashes,
    adjacent_sizes: adjacentContext.sizes,
    adjacent_count: adjacentContext.count,
    recent_sizes: recentSizes,
    time_since_last_ms: timeSinceLastMs,
    is_first_of_label: isFirstOfLabel,
    method,
    session_index: sessionState.sessionIndex,
    vocab_version: VOCAB_VERSION,
  };

  sessionState.prevBinSize = binSize;
  sessionState.sessionIndex++;

  if (sessionState.sizeSequence.length < 100) {
    sessionState.sizeSequence.push(binSize);
  }

  if (sessionState.firstBinTime === null) {
    sessionState.firstBinTime = Date.now();
  }

  layoutSession.recentPlacements.push({
    size: binSize,
    labelHash,
    position: `${bin.x},${bin.y}`,
    timestamp: now,
  });
  if (layoutSession.recentPlacements.length > 5) {
    layoutSession.recentPlacements.shift();
  }

  layoutSession.lastEditTime = Date.now();

  bufferEvent(event);
}

/**
 * Track a label update event.
 */
export function trackLabelUpdate(
  bin: Bin,
  oldLabel: string | undefined | null,
  newLabel: string | undefined | null
): void {
  if (!isEnabled()) return;

  const oldTrimmed = oldLabel?.trim() || '';
  const newTrimmed = newLabel?.trim() || '';
  if (oldTrimmed === newTrimmed) return;

  let oldLabelHash: string | null = null;
  let oldLabelNormalized: string | null = null;
  if (oldTrimmed) {
    const oldData = processLabel(oldTrimmed);
    oldLabelHash = oldData.hash;
    oldLabelNormalized = oldData.normalized;
  }

  let newLabelHash: string | null = null;
  let newLabelNormalized: string | null = null;
  let newLabelDomain: string | null = null;
  let newLabelEmbeddingBucket: string | null = null;
  if (newTrimmed) {
    const newData = processLabel(newTrimmed);
    newLabelHash = newData.hash;
    newLabelNormalized = newData.normalized;
    newLabelDomain = newData.domain;
    newLabelEmbeddingBucket = newData.embedding_bucket;
  }

  const event: LabelUpdateEvent = {
    type: 'label_updated',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    old_label_hash: oldLabelHash,
    old_label_normalized: oldLabelNormalized,
    new_label_hash: newLabelHash,
    new_label_normalized: newLabelNormalized,
    new_label_domain: newLabelDomain,
    new_label_embedding_bucket: newLabelEmbeddingBucket,
    vocab_version: VOCAB_VERSION,
  };

  bufferEvent(event);
}

/**
 * Track multiple bins placed at once (e.g., from fill operation).
 */
export function trackBulkPlacement(bins: Bin[], layout: Layout, method: PlacementMethod): void {
  if (!isEnabled()) return;
  if (bins.length === 0) return;

  const sampleSize = Math.min(bins.length, 5);
  const stride = Math.max(1, Math.floor(bins.length / sampleSize));
  const sampledBins = bins.filter((_, i) => i % stride === 0).slice(0, sampleSize);

  for (const bin of sampledBins) {
    trackBinPlacement(bin, layout, method);
  }
}

// ============================================
// LAYOUT SNAPSHOT TRACKING
// ============================================

/**
 * Track a layout snapshot at a commit point.
 */
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
    fill_percentage: computeFillPercentage(layout),
    labeled_percentage: computeLabeledPercentage(layout.bins),
    session_duration_ms: layoutSession.editCount > 0 ? Date.now() - layoutSession.startTime : 0,
    edit_count: layoutSession.editCount,
    quality_tier: assessLayoutQuality(layout),
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

// ============================================
// QUALITY SIGNAL TRACKING
// ============================================

/**
 * Track a quality signal for a layout.
 */
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

// ============================================
// DRAWER PURPOSE TRACKING
// ============================================

/**
 * Track when user sets drawer purpose.
 */
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

// ============================================
// CATEGORY CHANGE TRACKING
// ============================================

/**
 * Track a category change event.
 */
export function trackCategoryChange(bin: Bin, categoryName: string, batchSize: number = 1): void {
  if (!isEnabled()) return;

  if (isDefaultCategoryName(categoryName)) return;

  let labelHash: string | null = null;
  let labelDomain: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- label can be undefined at runtime despite types
  if (bin.label?.trim()) {
    const labelData = processLabel(bin.label);
    labelHash = labelData.hash;
    labelDomain = labelData.domain;
  }

  const event: CategoryChangeEvent = {
    type: 'category_changed',
    bin_size: `${bin.width}x${bin.depth}x${bin.height}`,
    category_name_hash: hashCategoryName(categoryName),
    batch_size: batchSize,
    label_hash: labelHash,
    label_domain: labelDomain,
    vocab_version: VOCAB_VERSION,
  };

  bufferEvent(event);
}

// ============================================
// BIN RESIZE TRACKING
// ============================================

/**
 * Track a bin resize event.
 */
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

// ============================================
// BIN DELETION TRACKING
// ============================================

/**
 * Track a bin deletion event.
 */
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

// ============================================
// BIN MOVE TRACKING
// ============================================

/**
 * Track a bin move event.
 */
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

// ============================================
// DRAWER RESIZE TRACKING
// ============================================

/**
 * Track a drawer resize event.
 */
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

// ============================================
// FILL OPERATION TRACKING
// ============================================

/**
 * Track a fill operation.
 */
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

// ============================================
// LAYER MOVEMENT TRACKING
// ============================================

/**
 * Track bins moving between layers.
 */
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

  bufferEvent(event);
}

// ============================================
// BIN ROTATION TRACKING
// ============================================

/**
 * Track a bin rotation event.
 */
export function trackBinRotation(bin: Bin, batchSize: number = 1): void {
  if (!isEnabled()) return;

  const event: BinRotatedEvent = {
    type: 'bin_rotated',
    old_size: `${bin.width}x${bin.depth}x${bin.height}`,
    new_size: `${bin.depth}x${bin.width}x${bin.height}`,
    batch_size: batchSize,
  };

  markEditActivity();

  bufferEvent(event);
}

// ============================================
// NEGATIVE SIGNAL TRACKING
// ============================================

/**
 * Track a placement rejection (cancelled draw/paint).
 */
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

/**
 * Track an undo operation.
 */
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

/**
 * Track a quick correction (delete/resize shortly after placement).
 */
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

// ============================================
// SESSION SUMMARY TRACKING
// ============================================

/**
 * Track a session summary event.
 */
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

// ============================================
// CROSS-LAYOUT PATTERN TRACKING
// ============================================

/**
 * Track cross-layout patterns at commit points.
 */
export function trackCrossLayoutPattern(layout: Layout): void {
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

// Re-export functions that are used by init module
export { isSubstantialLayout, recordBinCreation };
