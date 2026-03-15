import type {
  AbandonedBinEvent,
  BinDeletedEvent,
  BinMovedEvent,
  BinPlacementEvent,
  BinResizeEvent,
  BinRotatedEvent,
  CategoryChangeEvent,
  CrossLayoutPatternEvent,
  DrawerPurposeEvent,
  DrawerResizedEvent,
  FillOperationEvent,
  LabelUpdateEvent,
  LayerMoveEvent,
  LayoutQualityEvent,
  LayoutSnapshotEvent,
  PlacementRejectedEvent,
  QuickCorrectionEvent,
  SessionSummaryEvent,
  UndoEvent,
} from './types.js';

// ============================================
// AGGREGATION
// ============================================

export interface Increments {
  [key: string]: Record<string, number> | undefined;
}

/** Initialize a hash bucket if needed and increment a field by the given amount (default 1). */
function incr(inc: Increments, key: string, field: string, amount = 1): void {
  const b = (inc[key] ??= {});
  b[field] = (b[field] ?? 0) + amount;
}

/** Map a numeric value into a labeled bucket. Thresholds are [maxInclusive, label] pairs in ascending order. */
function bucket(
  value: number,
  thresholds: ReadonlyArray<readonly [number, string]>,
  overflow: string
): string {
  for (const [max, label] of thresholds) {
    if (value <= max) return label;
  }
  return overflow;
}

export function aggregateBinPlacement(event: BinPlacementEvent, inc: Increments): void {
  const { bin_size } = event;

  // 1. Global size frequency
  incr(inc, 'ml:sizes', bin_size);

  // 2. Transition matrix (if we have prev bin)
  if (event.prev_bin_size) {
    incr(inc, `ml:trans:${event.prev_bin_size}`, bin_size);
  }

  // 3. Drawer size correlation
  incr(inc, `ml:drawer:${event.drawer_size}`, bin_size);

  // 4. Label hash (PRIMARY - works for ANY language/domain)
  if (event.label_hash) {
    incr(inc, `ml:label_hash:${event.label_hash}`, bin_size);

    // Track unknown hashes for vocabulary expansion
    if (!event.label_normalized) {
      incr(inc, 'ml:unknown_hashes', event.label_hash);
    }
  }

  // 5. Normalized label (ENRICHMENT - when vocabulary matches)
  if (event.label_normalized) {
    incr(inc, `ml:label:${event.label_normalized}`, bin_size);
  }

  // 6. Label domain (FALLBACK - broader category)
  if (event.label_domain) {
    incr(inc, `ml:label_domain:${event.label_domain}`, bin_size);
  }

  // 6b. Embedding bucket (semantic similarity grouping)
  if (event.label_embedding_bucket) {
    incr(inc, `ml:embed:${event.label_embedding_bucket}`, bin_size);
  }

  // 7. Category
  incr(inc, `ml:cat:${event.category_id}`, bin_size);

  // 8. Gap fit pattern
  incr(inc, `ml:gapfit:${event.gap_fit}`, bin_size);

  // 9. Placement method
  incr(inc, `ml:method:${event.method}`, bin_size);

  // 10. Adjacent label co-occurrence (Priority 3)
  // Track which label hashes appear adjacent to each other
  if (event.label_hash && event.adjacent_label_hashes.length > 0) {
    for (const adjHash of event.adjacent_label_hashes) {
      // Store in lexicographic order to avoid duplicates
      const [first, second] = [event.label_hash, adjHash].sort();
      incr(inc, `ml:cooccur:${first}`, second);
    }
  }

  // Track adjacent bin count distribution
  const adjBucket = event.adjacent_count >= 4 ? '4+' : String(event.adjacent_count);
  incr(inc, 'ml:adjacent_counts', adjBucket);

  // 11. First-of-label tracking (Priority 5)
  // Track initial size choices for new item types - strong learning signal
  if (event.is_first_of_label && event.label_hash) {
    incr(inc, `ml:first_label:${event.label_hash}`, bin_size);
  }

  // Track placement sequence patterns (recent sizes)
  if (event.recent_sizes.length > 0) {
    const seqKey = event.recent_sizes.join('>');
    incr(inc, 'ml:sequences', seqKey);
  }
}

export function aggregateLabelUpdate(event: LabelUpdateEvent, inc: Increments): void {
  const { bin_size } = event;

  // Track new label associations
  if (event.new_label_hash) {
    incr(inc, `ml:label_hash:${event.new_label_hash}`, bin_size);

    if (!event.new_label_normalized) {
      incr(inc, 'ml:unknown_hashes', event.new_label_hash);
    }
  }

  if (event.new_label_normalized) {
    incr(inc, `ml:label:${event.new_label_normalized}`, bin_size);
  }

  if (event.new_label_domain) {
    incr(inc, `ml:label_domain:${event.new_label_domain}`, bin_size);
  }

  // Track embedding bucket for semantic similarity
  if (event.new_label_embedding_bucket) {
    incr(inc, `ml:embed:${event.new_label_embedding_bucket}`, bin_size);
  }
}

export function aggregateLayoutSnapshot(event: LayoutSnapshotEvent, inc: Increments): void {
  const { drawer_size, trigger, purpose } = event;

  // 1. Track size distribution by drawer size
  for (const [size, count] of Object.entries(event.size_distribution)) {
    incr(inc, `ml:drawer_sizes:${drawer_size}`, size, count);
  }

  // 2. Track domain distribution by drawer size
  for (const [domain, count] of Object.entries(event.domain_distribution)) {
    incr(inc, `ml:domains:${drawer_size}`, domain, count);
  }

  // 3. Build co-occurrence matrix from top label hashes
  // Track pairs of labels that appear together in the same layout
  const hashes = event.top_label_hashes;
  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      // Bidirectional: A->B and B->A
      incr(inc, `ml:cooccur:${hashes[i]}`, hashes[j]);
      incr(inc, `ml:cooccur:${hashes[j]}`, hashes[i]);
    }
  }

  // 4. Track snapshot trigger distribution
  incr(inc, 'ml:triggers', trigger);

  // 5. Track purpose if set
  if (purpose) {
    incr(inc, 'ml:purpose', purpose);

    // Track size distribution by purpose
    for (const [size, count] of Object.entries(event.size_distribution)) {
      incr(inc, `ml:purpose_sizes:${purpose}`, size, count);
    }
  }

  // 6. Track fill percentage buckets (0-25%, 25-50%, 50-75%, 75-100%)
  const fillBucket = Math.min(Math.floor(event.fill_percentage / 25), 3);
  incr(inc, `ml:fill_bucket:${fillBucket}`, drawer_size);

  // 7. Track labeled percentage buckets
  const labeledBucket = Math.min(Math.floor(event.labeled_percentage / 25), 3);
  incr(inc, `ml:labeled_bucket:${labeledBucket}`, drawer_size);

  // 8. Track quality tier distribution (for backend weighting)
  const { quality_tier } = event;
  incr(inc, 'ml:quality_tier', quality_tier);

  // 9. Track size distribution by quality tier (high-quality layouts are better training data)
  if (quality_tier === 'high' || quality_tier === 'medium') {
    for (const [size, count] of Object.entries(event.size_distribution)) {
      incr(inc, `ml:tier_sizes:${quality_tier}`, size, count);
    }
  }

  // 10. Track layout archetype distribution
  const { archetype, spatial_patterns, uniformity_score, edge_usage } = event;
  incr(inc, 'ml:archetype', archetype);

  // Track archetype by drawer size
  incr(inc, `ml:archetype:${drawer_size}`, archetype);

  // 11. Track spatial patterns
  for (const pattern of spatial_patterns) {
    incr(inc, 'ml:patterns', pattern);

    // Track pattern co-occurrence with archetype
    incr(inc, `ml:patterns:${archetype}`, pattern);
  }

  // 12. Track uniformity score buckets (0-0.25, 0.25-0.5, 0.5-0.75, 0.75-1.0)
  const uniformityBucket = Math.min(Math.floor(uniformity_score * 4), 3);
  incr(inc, 'ml:uniformity', `bucket_${uniformityBucket}`);

  // 13. Track edge usage patterns
  const edgeCount = [edge_usage.left, edge_usage.right, edge_usage.top, edge_usage.bottom].filter(
    Boolean
  ).length;
  incr(inc, 'ml:edge_count', `edges_${edgeCount}`);

  // Track specific edge combinations
  const edgeKey =
    `${edge_usage.left ? 'L' : ''}${edge_usage.right ? 'R' : ''}${edge_usage.top ? 'T' : ''}${edge_usage.bottom ? 'B' : ''}` ||
    'none';
  incr(inc, 'ml:edge_combo', edgeKey);

  // 14. Track temporal patterns
  const { hour_of_day, day_of_week, is_weekend, structure_hash } = event;

  // Track activity by hour (helps understand when users are most active)
  incr(inc, `ml:temporal:hour:${hour_of_day}`, 'count');

  // Track activity by day of week
  incr(inc, `ml:temporal:day:${day_of_week}`, 'count');

  // Track weekend vs weekday activity
  const weekendKey = is_weekend ? 'weekend' : 'weekday';
  incr(inc, 'ml:temporal:weekday', weekendKey);

  // 15. Track layout clusters by structure hash
  // This enables finding layouts with similar structural characteristics
  // Track size distribution within each cluster
  for (const [size, count] of Object.entries(event.size_distribution)) {
    incr(inc, `ml:clusters:${structure_hash}`, size, count);
  }

  // Track archetype correlations with clusters
  incr(inc, `ml:cluster_archetypes:${structure_hash}`, archetype);

  // Track cluster distribution (how common each structure hash is)
  incr(inc, 'ml:cluster_distribution', structure_hash);
}

export function aggregateQualitySignal(event: LayoutQualityEvent, inc: Increments): void {
  const { signal, confidence_breakdown, abandonment_type, time_since_last_edit_ms } = event;

  // Track quality signal frequency
  incr(inc, 'ml:quality', signal);

  // Track by age bucket (0-1 day, 1-7 days, 7-30 days, 30+ days)
  const ageBucket = bucket(
    event.days_since_creation,
    [
      [1, 'day1'],
      [7, 'week1'],
      [30, 'month1'],
    ],
    'older'
  );
  incr(inc, `ml:quality_age:${signal}`, ageBucket);

  // Track confidence breakdown distribution (if provided)
  if (confidence_breakdown) {
    // Track combined confidence in buckets
    const confBucket =
      confidence_breakdown.combined < 0.25
        ? 'very_low'
        : confidence_breakdown.combined < 0.5
          ? 'low'
          : confidence_breakdown.combined < 0.75
            ? 'medium'
            : 'high';
    incr(inc, 'ml:quality_confidence', confBucket);

    // Track confidence by signal type (export/share with high confidence = good data)
    incr(inc, `ml:quality_conf_by_signal:${signal}`, confBucket);

    // Track individual score distributions for analysis
    const scoreNames = [
      'undo_score',
      'completion_score',
      'session_score',
      'correction_score',
    ] as const;
    for (const scoreName of scoreNames) {
      const score = confidence_breakdown[scoreName];
      const scoreBucket = score < 0.4 ? 'low' : score < 0.7 ? 'medium' : 'high';
      incr(inc, `ml:quality_score:${scoreName}`, scoreBucket);
    }
  }

  // Track abandonment patterns
  if (abandonment_type) {
    incr(inc, 'ml:abandonment', abandonment_type);

    // Track abandonment by age (newer layouts abandoned more often = exploration)
    incr(inc, `ml:abandonment_age:${abandonment_type}`, ageBucket);
  }

  // Track time since last edit (dormancy detection)
  const dormancyBucket =
    time_since_last_edit_ms < 60_000
      ? 'active'
      : time_since_last_edit_ms < 300_000
        ? 'recent'
        : time_since_last_edit_ms < 1800_000
          ? 'idle'
          : 'dormant';
  incr(inc, 'ml:quality_dormancy', dormancyBucket);
}

export function aggregateDrawerPurpose(event: DrawerPurposeEvent, inc: Increments): void {
  const { purpose, is_custom } = event;

  // Track purpose frequency
  incr(inc, 'ml:purpose', purpose);

  // Track custom vs predefined
  const customKey = is_custom ? 'custom' : 'predefined';
  incr(inc, 'ml:purpose_type', customKey);
}

export function aggregateCategoryChange(event: CategoryChangeEvent, inc: Increments): void {
  const { bin_size, category_name_hash, label_hash, label_domain } = event;

  // Track which bin sizes are assigned to which categories (by name hash)
  // Only custom categories reach here (defaults filtered client-side)
  incr(inc, `ml:cat_sizes:${category_name_hash}`, bin_size);

  // Track label->category associations (helps learn what items go in what categories)
  if (label_hash) {
    incr(inc, `ml:label_cat:${label_hash}`, category_name_hash);
  }

  // Track domain->category associations (broader pattern)
  if (label_domain) {
    incr(inc, `ml:domain_cat:${label_domain}`, category_name_hash);
  }

  // Track total category change events
  incr(inc, 'ml:cat_changes', 'total');
}

export function aggregateBinResize(event: BinResizeEvent, inc: Increments): void {
  const { old_size, new_size, dimensions_changed, resize_direction, area_delta } = event;

  // Track resize transitions (what sizes users resize to what)
  incr(inc, `ml:resize:${old_size}`, new_size);

  // Track which dimensions are resized most often
  for (const dim of dimensions_changed) {
    incr(inc, 'ml:resize_dims', dim);
  }

  // Track total resize events
  incr(inc, 'ml:resizes', 'total');

  // Track resulting sizes (what users resize to)
  incr(inc, 'ml:resize_results', new_size);

  // Track resize direction (Priority 1)
  // grow = user made bin bigger (likely initial was too small)
  // shrink = user made bin smaller (likely initial was too big)
  incr(inc, 'ml:resize_direction', resize_direction);

  // Track area delta buckets (how much users adjust)
  const absAreaDelta = Math.abs(area_delta);
  const deltaBucket = bucket(
    absAreaDelta,
    [
      [0, '0'],
      [1, '0-1'],
      [4, '1-4'],
      [9, '4-9'],
    ],
    '9+'
  );

  const directionPrefix = area_delta > 0 ? '+' : area_delta < 0 ? '-' : '';
  incr(inc, 'ml:resize_delta', `${directionPrefix}${deltaBucket}`);
}

/**
 * Record metrics for a bin deletion event by incrementing the appropriate aggregate counters in the provided increments map.
 *
 * Updates the `inc` object with counts for negative-signal deletion metrics, including:
 * - `ml:neg:deleted_sizes` (by `bin_size`)
 * - `ml:neg:delete_methods` (by `method`)
 * - `ml:neg:delete_labeled` (`"labeled"` or `"unlabeled"`)
 * - `ml:neg:delete_domain:{domain}` (per-domain by `bin_size`, when `label_domain` is present)
 * - `ml:neg:deletions` (`total`)
 *
 * @param event - The BinDeletedEvent containing `bin_size`, `method`, `had_label`, and optional `label_domain`
 * @param inc - Mutable increments map that will be populated with hash-field count updates to write to Redis
 */
export function aggregateBinDeletion(event: BinDeletedEvent, inc: Increments): void {
  const { bin_size, method, had_label, label_domain } = event;

  // Track deleted sizes (important negative signal - what users rejected)
  incr(inc, 'ml:neg:deleted_sizes', bin_size);

  // Track deletion method distribution
  incr(inc, 'ml:neg:delete_methods', method);

  // Track whether deleted bins had labels (labeled bins being deleted may indicate bad ML suggestions)
  const labeledKey = had_label ? 'labeled' : 'unlabeled';
  incr(inc, 'ml:neg:delete_labeled', labeledKey);

  // Track deleted bins by domain
  if (label_domain) {
    incr(inc, `ml:neg:delete_domain:${label_domain}`, bin_size);
  }

  // Track total deletions
  incr(inc, 'ml:neg:deletions', 'total');
}

/**
 * Aggregate move-related telemetry from a bin move event into the provided increments map.
 *
 * Increments counters for moved bin sizes, move methods, distance buckets, and the overall move total.
 * Distance is mapped to one of the buckets: `micro` (<=1), `short` (2-3), `medium` (4-9), or `long` (10+).
 *
 * @param event - The bin move event containing `bin_size`, `distance`, and `method`
 * @param inc - Mutable increments map that will be updated with counters to write to Redis
 */
export function aggregateBinMove(event: BinMovedEvent, inc: Increments): void {
  const { bin_size, distance, method } = event;

  // Track moved sizes (helps understand position adjustment patterns)
  incr(inc, 'ml:moved_sizes', bin_size);

  // Track move method distribution (drag vs nudge)
  incr(inc, 'ml:move_methods', method);

  // Track move distance buckets (short, medium, long moves)
  const distanceBucket = bucket(
    distance,
    [
      [1, 'micro'], // 1 cell or less
      [3, 'short'], // 2-3 cells
      [9, 'medium'], // 4-9 cells
    ],
    'long'
  ); // 10+ cells (likely repositioning)
  incr(inc, 'ml:move_distances', distanceBucket);

  // Track total moves
  incr(inc, 'ml:moves', 'total');
}

export function aggregateDrawerResize(event: DrawerResizedEvent, inc: Increments): void {
  const { old_size, new_size, dimensions_changed, bins_staged } = event;

  // Track resize transitions (what drawer sizes users resize to)
  incr(inc, `ml:drawer_resize:${old_size}`, new_size);

  // Track which dimensions are changed most often
  for (const dim of dimensions_changed) {
    incr(inc, 'ml:drawer_resize_dims', dim);
  }

  // Track how often bins are staged due to resize
  if (bins_staged > 0) {
    incr(inc, 'ml:drawer_resize_staged', 'with_bins');
  } else {
    incr(inc, 'ml:drawer_resize_staged', 'no_bins');
  }

  // Track total drawer resizes
  incr(inc, 'ml:drawer_resizes', 'total');

  // Track resulting drawer sizes (what sizes users resize to)
  incr(inc, 'ml:drawer_resize_results', new_size);
}

export function aggregateFillOperation(event: FillOperationEvent, inc: Increments): void {
  const { method, fill_size, bins_created, drawer_size } = event;

  // Track fill method distribution (uniform vs gaps)
  incr(inc, 'ml:fill_methods', method);

  // Track which sizes users fill with (for uniform fill - strong preference signal!)
  if (fill_size) {
    incr(inc, 'ml:fill_sizes', fill_size);

    // Track fill size by drawer size (size preferences depend on container)
    incr(inc, `ml:fill_by_drawer:${drawer_size}`, fill_size);
  }

  // Track bins created per fill (helps understand fill efficiency)
  const binsBucket =
    bins_created <= 10
      ? 'small'
      : bins_created <= 50
        ? 'medium'
        : bins_created <= 100
          ? 'large'
          : 'xlarge';
  incr(inc, 'ml:fill_bins', binsBucket);

  // Track total fill operations
  incr(inc, 'ml:fills', 'total');
}

export function aggregateLayerMove(event: LayerMoveEvent, inc: Increments): void {
  const { bin_size, from_layer_index, to_layer_index, method } = event;

  // Track layer movement patterns (which layers users move bins between)
  const fromKey = from_layer_index === -1 ? 'staging' : `layer${from_layer_index}`;
  const toKey = to_layer_index === -1 ? 'staging' : `layer${to_layer_index}`;

  // Track from->to transitions
  incr(inc, `ml:layer_trans:${fromKey}`, toKey);

  // Track sizes moved between layers
  incr(inc, 'ml:layer_moved_sizes', bin_size);

  // Track layer move method distribution
  incr(inc, 'ml:layer_move_methods', method);

  // Track staging in/out specifically (important for understanding stash usage)
  if (from_layer_index === -1) {
    incr(inc, 'ml:staging_out', toKey);
  }
  if (to_layer_index === -1) {
    incr(inc, 'ml:staging_in', fromKey);
  }

  // Track total layer moves
  incr(inc, 'ml:layer_moves', 'total');
}

export function aggregateBinRotation(event: BinRotatedEvent, inc: Increments): void {
  const { old_size, new_size } = event;

  // Track rotation transitions (shows which sizes users rotate)
  incr(inc, `ml:rotate:${old_size}`, new_size);

  // Track total rotations
  incr(inc, 'ml:rotations', 'total');

  // Track rotated sizes (which sizes users rotate most)
  incr(inc, 'ml:rotated_sizes', old_size);
}

// ============================================
// NEGATIVE SIGNAL AGGREGATION
// ============================================

/**
 * Aggregate placement rejection events (negative signal).
 * Tracks why users abandon draw/paint interactions.
 *
 * Redis keys:
 * - ml:rejections                     -> Total rejection count by reason
 * - ml:reject_modes                   -> Rejection count by draw/paint mode
 * - ml:reject_sizes                   -> Intended sizes that were rejected (negative signal)
 * - ml:neg:reject_by_drawer:{size}    -> Rejected sizes by drawer size (negative signal)
 */
export function aggregatePlacementRejection(event: PlacementRejectedEvent, inc: Increments): void {
  const { rejection_reason, intended_size, mode, drawer_size } = event;

  // Track rejection reasons
  incr(inc, 'ml:rejections', rejection_reason);

  // Track by mode (draw vs paint)
  incr(inc, 'ml:reject_modes', mode);

  // Track rejected sizes (important negative signal - what users tried but abandoned)
  if (intended_size) {
    incr(inc, 'ml:reject_sizes', intended_size);

    // Negative signal: size rejection by drawer size
    incr(inc, `ml:neg:reject_by_drawer:${drawer_size}`, intended_size);
  }

  // Track total rejections
  incr(inc, 'ml:rejections', 'total');
}

/**
 * Aggregate an undo (negative signal) event into telemetry counters.
 *
 * Increments counters that record what action was undone, how quickly it was undone,
 * combined action+timing counts, the scale of the undo by number of bins affected,
 * and a total undo counter.
 *
 * Timing buckets: `immediate` (< 2000 ms), `quick` (2000-9999 ms), `delayed` (>= 10000 ms).
 * Undo scale buckets: `single` (<=1), `few` (2-5), `many` (6-20), `bulk` (>20).
 *
 * @param event - The undo event; uses `action_undone`, `bins_affected`, and `time_since_action_ms`.
 * @param inc - Mutable increments map to update with counts keyed by Redis metric names.
 */
export function aggregateUndo(event: UndoEvent, inc: Increments): void {
  const { action_undone, bins_affected, time_since_action_ms } = event;

  // Track what actions get undone (strong negative signal)
  incr(inc, 'ml:neg:undos', action_undone);

  // Track timing buckets (how fast did user regret?)
  const timingBucket = bucket(
    time_since_action_ms,
    [
      [1999, 'immediate'], // <2s: Likely accidental or instant regret
      [9999, 'quick'], // 2-10s: Realized mistake quickly
    ],
    'delayed'
  ); // >10s: Thought about it, then undid
  incr(inc, 'ml:neg:undo_timing', timingBucket);

  // Track by action + timing (e.g., "placement_immediate" indicates bad auto-suggestion)
  incr(inc, 'ml:neg:undo_action_timing', `${action_undone}_${timingBucket}`);

  // Track bins affected (bulk undos vs single-bin undos)
  const binsBucket = bucket(
    bins_affected,
    [
      [1, 'single'],
      [5, 'few'],
      [20, 'many'],
    ],
    'bulk'
  );
  incr(inc, 'ml:neg:undo_scale', binsBucket);

  // Track total undos
  incr(inc, 'ml:neg:undos', 'total');
}

/**
 * Aggregate quick correction events (negative signal).
 * Tracks bins that were created then immediately changed/deleted.
 * This is the strongest negative signal - user explicitly rejected the result.
 *
 * Redis keys:
 * - ml:neg:quick_corrections             -> Total quick correction count by type
 * - ml:neg:corrected_sizes               -> Sizes that get quickly corrected (BAD sizes)
 * - ml:neg:correct_by_method:{method}    -> Which placement methods produce corrections
 * - ml:neg:correction_timing             -> How fast corrections happen
 * - ml:neg:resize_correct:{size}         -> What users resize corrected bins to
 */
export function aggregateQuickCorrection(event: QuickCorrectionEvent, inc: Increments): void {
  const { correction_type, original_size, new_size, placement_method, time_to_correction_ms } =
    event;

  // Track correction type (delete, resize, move)
  incr(inc, 'ml:neg:quick_corrections', correction_type);

  // STRONG NEGATIVE SIGNAL: Track which sizes get quickly corrected
  incr(inc, 'ml:neg:corrected_sizes', original_size);

  // Track which placement methods produce quick corrections
  incr(inc, `ml:neg:correct_by_method:${placement_method}`, correction_type);

  // Track correction timing
  const timingBucket = bucket(
    time_to_correction_ms,
    [
      [4999, 'very_quick'], // <5s: probably obvious mistake
      [14999, 'quick'], // 5-15s
    ],
    'considered'
  ); // 15s+
  incr(inc, 'ml:neg:correction_timing', timingBucket);

  // For resize corrections, track the size transition (what user ACTUALLY wanted)
  if (correction_type === 'resize' && new_size) {
    incr(inc, `ml:neg:resize_correct:${original_size}`, new_size);
  }

  // Track total quick corrections
  incr(inc, 'ml:neg:quick_corrections', 'total');
}

/**
 * Aggregate bin abandonment events (Priority 4).
 * Tracks bins that users placed but never labeled or used - strong negative signal.
 *
 * Redis keys:
 * - ml:neg:abandoned_sizes        -> Sizes that get abandoned most
 * - ml:neg:abandoned_by_method    -> Abandonment rate by creation method
 * - ml:neg:abandon_lifetime       -> How long bins existed before being abandoned
 * - ml:neg:abandonment_total      -> Total abandoned bins
 */
export function aggregateBinAbandonment(event: AbandonedBinEvent, inc: Increments): void {
  const { bin_size, creation_method, lifetime_ms, drawer_size } = event;

  // STRONG NEGATIVE SIGNAL: Track which sizes get abandoned
  incr(inc, 'ml:neg:abandoned_sizes', bin_size);

  // Track abandonment by creation method
  incr(inc, `ml:neg:abandoned_by_method:${creation_method}`, bin_size);

  // Track lifetime buckets
  const lifetimeBucket = bucket(
    lifetime_ms,
    [
      [59999, '<1min'],
      [299999, '1-5min'],
      [1799999, '5-30min'],
    ],
    '>30min'
  );
  incr(inc, 'ml:neg:abandon_lifetime', lifetimeBucket);

  // Track by drawer size (some drawer contexts may have more abandoned bins)
  incr(inc, `ml:neg:abandoned_by_drawer:${drawer_size}`, bin_size);

  // Track total
  incr(inc, 'ml:neg:abandonment_total', 'total');
}

/**
 * Aggregate cross-layout pattern events.
 * Tracks label-size consistency and inferred purposes across layouts.
 *
 * Redis keys:
 * - ml:inferred_purpose:{drawer}      -> Inferred purposes by drawer size
 * - ml:purpose_confidence             -> Purpose confidence distribution
 * - ml:label_consistency              -> Label-size consistency rates
 * - ml:user_patterns                  -> Pattern count by user hash (for sampling)
 * - ml:cross_layout_total             -> Total cross-layout events
 */
export function aggregateCrossLayoutPattern(event: CrossLayoutPatternEvent, inc: Increments): void {
  const { drawer_size, inferred_purpose, inferred_purpose_confidence, label_size_consistency } =
    event;

  // Track inferred purpose by drawer size
  if (inferred_purpose) {
    const purposeKey = `ml:inferred_purpose:${drawer_size}`;
    inc[purposeKey] = inc[purposeKey] || {};
    inc[purposeKey][inferred_purpose] = (inc[purposeKey][inferred_purpose] || 0) + 1;
  }

  // Track confidence distribution (bucketed)
  const confidenceBucket =
    inferred_purpose_confidence < 0.4
      ? 'low'
      : inferred_purpose_confidence < 0.7
        ? 'medium'
        : 'high';
  inc['ml:purpose_confidence'] = inc['ml:purpose_confidence'] || {};
  inc['ml:purpose_confidence'][confidenceBucket] =
    (inc['ml:purpose_confidence'][confidenceBucket] || 0) + 1;

  // Track label-size consistency
  let consistentCount = 0;
  let inconsistentCount = 0;
  for (const item of label_size_consistency) {
    if (item.is_consistent) {
      consistentCount++;
    } else {
      inconsistentCount++;
      // Track sizes used for inconsistent labels (users might be experimenting)
      for (const size of item.sizes_used) {
        inc['ml:inconsistent_sizes'] = inc['ml:inconsistent_sizes'] || {};
        inc['ml:inconsistent_sizes'][size] = (inc['ml:inconsistent_sizes'][size] || 0) + 1;
      }
    }
  }

  inc['ml:label_consistency'] = inc['ml:label_consistency'] || {};
  inc['ml:label_consistency']['consistent'] =
    (inc['ml:label_consistency']['consistent'] || 0) + consistentCount;
  inc['ml:label_consistency']['inconsistent'] =
    (inc['ml:label_consistency']['inconsistent'] || 0) + inconsistentCount;

  // Track total cross-layout events
  inc['ml:cross_layout_total'] = inc['ml:cross_layout_total'] || {};
  inc['ml:cross_layout_total']['total'] = (inc['ml:cross_layout_total']['total'] || 0) + 1;
}

// ============================================
// SESSION SUMMARY AGGREGATION
// ============================================

/**
 * Aggregate session summary events.
 * Tracks workflow patterns and session quality metrics.
 *
 * Redis keys:
 * - ml:session:bins_placed           -> Histogram of bins placed per session
 * - ml:session:edit_ratio            -> Edit-to-done ratio buckets (low/medium/high)
 * - ml:session:time_to_first         -> Time to first bin buckets
 * - ml:session:confidence            -> Confidence score distribution
 * - ml:session:duration              -> Session duration buckets
 * - ml:size_seq:{drawer}             -> Common size sequences by drawer
 * - ml:session:totals                -> Total session counts
 */
export function aggregateSessionSummary(event: SessionSummaryEvent, inc: Increments): void {
  const {
    bins_placed,
    edit_to_done_ratio,
    time_to_first_bin_ms,
    session_duration_ms,
    confidence_score,
    drawer_size,
    size_sequence,
    undo_count,
  } = event;

  // 1. Track bins placed per session (histogram buckets)
  const binsBucket =
    bins_placed === 0
      ? '0'
      : bins_placed <= 5
        ? '1-5'
        : bins_placed <= 10
          ? '6-10'
          : bins_placed <= 20
            ? '11-20'
            : bins_placed <= 50
              ? '21-50'
              : '51+';
  inc['ml:session:bins_placed'] = inc['ml:session:bins_placed'] || {};
  inc['ml:session:bins_placed'][binsBucket] = (inc['ml:session:bins_placed'][binsBucket] || 0) + 1;

  // 2. Track edit-to-done ratio buckets
  const editRatioBucket =
    edit_to_done_ratio === 0
      ? 'zero'
      : edit_to_done_ratio < 0.3
        ? 'low'
        : edit_to_done_ratio < 0.6
          ? 'medium'
          : 'high';
  inc['ml:session:edit_ratio'] = inc['ml:session:edit_ratio'] || {};
  inc['ml:session:edit_ratio'][editRatioBucket] =
    (inc['ml:session:edit_ratio'][editRatioBucket] || 0) + 1;

  // 3. Track time to first bin buckets
  if (time_to_first_bin_ms !== null) {
    const ttfbBucket =
      time_to_first_bin_ms < 10_000
        ? 'quick' // <10s
        : time_to_first_bin_ms < 30_000
          ? 'normal' // 10-30s
          : time_to_first_bin_ms < 120_000
            ? 'slow'
            : 'very_slow'; // 30-120s, >120s
    inc['ml:session:time_to_first'] = inc['ml:session:time_to_first'] || {};
    inc['ml:session:time_to_first'][ttfbBucket] =
      (inc['ml:session:time_to_first'][ttfbBucket] || 0) + 1;
  }

  // 4. Track confidence score distribution (buckets of 0.2)
  const confidenceBucket =
    confidence_score < 0.2
      ? 'very_low'
      : confidence_score < 0.4
        ? 'low'
        : confidence_score < 0.6
          ? 'medium'
          : confidence_score < 0.8
            ? 'high'
            : 'very_high';
  inc['ml:session:confidence'] = inc['ml:session:confidence'] || {};
  inc['ml:session:confidence'][confidenceBucket] =
    (inc['ml:session:confidence'][confidenceBucket] || 0) + 1;

  // 5. Track session duration buckets
  const durationBucket =
    session_duration_ms < 60_000
      ? '<1min'
      : session_duration_ms < 300_000
        ? '1-5min'
        : session_duration_ms < 900_000
          ? '5-15min'
          : session_duration_ms < 1800_000
            ? '15-30min'
            : '30min+';
  inc['ml:session:duration'] = inc['ml:session:duration'] || {};
  inc['ml:session:duration'][durationBucket] =
    (inc['ml:session:duration'][durationBucket] || 0) + 1;

  // 6. Track size sequences by drawer (first 5 sizes as pattern)
  if (size_sequence.length >= 2) {
    const seqPattern = size_sequence.slice(0, 5).join('>');
    const seqKey = `ml:size_seq:${drawer_size}`;
    inc[seqKey] = inc[seqKey] || {};
    inc[seqKey][seqPattern] = (inc[seqKey][seqPattern] || 0) + 1;
  }

  // 7. Track undo count distribution
  const undoBucket =
    undo_count === 0 ? '0' : undo_count <= 2 ? '1-2' : undo_count <= 5 ? '3-5' : '6+';
  inc['ml:session:undo_count'] = inc['ml:session:undo_count'] || {};
  inc['ml:session:undo_count'][undoBucket] = (inc['ml:session:undo_count'][undoBucket] || 0) + 1;

  // 8. Track confidence by drawer size (helps identify difficult drawer sizes)
  const confByDrawerKey = `ml:session:conf_by_drawer:${drawer_size}`;
  inc[confByDrawerKey] = inc[confByDrawerKey] || {};
  inc[confByDrawerKey][confidenceBucket] = (inc[confByDrawerKey][confidenceBucket] || 0) + 1;

  // 9. Track total sessions
  inc['ml:session:totals'] = inc['ml:session:totals'] || {};
  inc['ml:session:totals']['total'] = (inc['ml:session:totals']['total'] || 0) + 1;
}
