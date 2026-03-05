import type { LayoutArchetype, SpatialPattern, EdgeUsage } from '../layoutPatterns';

// ============================================
// EVENT TYPES
// ============================================

/**
 * Bin placement event for ML training.
 */
export interface BinPlacementEvent {
  type: 'bin_placed';

  // === Core (for transition matrix) ===
  /** Bin size as "WxDxH" string */
  bin_size: string;
  /** Previous bin size this session, or null if first bin */
  prev_bin_size: string | null;
  /** Drawer size as "WxDxH" string */
  drawer_size: string;

  // === Spatial context ===
  /** Position as "X,Y" string */
  position: string;
  /** Layer index (0 = bottom) */
  layer_index: number;
  /** Largest empty rectangle as "WxD" string */
  largest_gap: string;
  /** Fill percentage (0-100) */
  fill_pct: number;
  /** Whether bin fills a gap exactly, partially, or not at all */
  gap_fit: 'exact' | 'partial' | 'none';

  // === Label data (hash-first strategy) ===
  /** Label hash - ALWAYS populated if label exists */
  label_hash: string | null;
  /** Normalized label from vocabulary, or null */
  label_normalized: string | null;
  /** Label domain category, or null */
  label_domain: string | null;
  /** Embedding bucket for semantic similarity (4-char hex) */
  label_embedding_bucket: string | null;
  /** Category ID from the layout */
  category_id: string;

  // === Adjacent context (for co-location learning) ===
  /** Label hashes of adjacent bins on same layer (max 4) */
  adjacent_label_hashes: string[];
  /** Sizes of adjacent bins on same layer (max 4) */
  adjacent_sizes: string[];
  /** Number of adjacent bins */
  adjacent_count: number;

  // === Sequence context (for workflow learning) ===
  /** Sizes of last 3 placements in this session */
  recent_sizes: string[];
  /** Time since last placement in ms, or null if first placement */
  time_since_last_ms: number | null;
  /** Whether this is the first bin with this label in the session */
  is_first_of_label: boolean;

  // === Context ===
  /** How the bin was placed */
  method: PlacementMethod;
  /** nth bin placed this session */
  session_index: number;

  // === Versioning ===
  /** Vocabulary version for label normalization */
  vocab_version: string;
}

/**
 * Label update event - when user adds/edits a label on existing bin.
 */
export interface LabelUpdateEvent {
  type: 'label_updated';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  // Old label data
  old_label_hash: string | null;
  old_label_normalized: string | null;

  // New label data
  new_label_hash: string | null;
  new_label_normalized: string | null;
  new_label_domain: string | null;
  new_label_embedding_bucket: string | null;

  vocab_version: string;
}

/**
 * Layout snapshot event - captures complete layout state at commit points.
 * Used for training smart layout generation models.
 */
export interface LayoutSnapshotEvent {
  type: 'layout_snapshot';

  // === Trigger context ===
  /** What action triggered the snapshot */
  trigger: LayoutSnapshotTrigger;

  // === Layout identity ===
  /** Hash of layout for deduplication */
  layout_hash: string;
  /** nth snapshot of this layout in current session */
  snapshot_index: number;

  // === Drawer context ===
  /** Drawer size as "WxDxH" string */
  drawer_size: string;
  /** Number of layers in the layout */
  layer_count: number;
  /** Optional drawer purpose if set */
  purpose: string | null;

  // === Composition (aggregated, not positions) ===
  /** Total number of bins (excluding staging) */
  bin_count: number;
  /** Distribution of bin sizes: {"1x1x6": 4, "2x2x3": 2} */
  size_distribution: Record<string, number>;
  /** Distribution by category ID: {"cat_abc": 6} */
  category_distribution: Record<string, number>;
  /** Distribution by label domain: {"tools": 5, "fasteners": 3} */
  domain_distribution: Record<string, number>;

  // === Label data (for co-occurrence learning) ===
  /** Top 10 most common label hashes in layout */
  top_label_hashes: string[];

  // === Quality metrics ===
  /** Percentage of drawer filled (0-100) */
  fill_percentage: number;
  /** Percentage of bins with labels (0-100) */
  labeled_percentage: number;

  // === Session context ===
  /** Milliseconds since session started */
  session_duration_ms: number;
  /** Number of edits in current session */
  edit_count: number;

  // === Quality tier ===
  /** Assessed quality tier for backend weighting */
  quality_tier: LayoutQualityTier;

  // === Pattern detection ===
  /** High-level layout archetype */
  archetype: LayoutArchetype;
  /** Spatial patterns detected in layout */
  spatial_patterns: SpatialPattern[];
  /** Bin size uniformity score (0-1) */
  uniformity_score: number;
  /** Which drawer edges have bins touching */
  edge_usage: EdgeUsage;

  // === Temporal patterns ===
  /** Hour of day when snapshot was taken (0-23) */
  hour_of_day: number;
  /** Day of week (0 = Sunday, 6 = Saturday) */
  day_of_week: number;
  /** Whether this is a weekend day */
  is_weekend: boolean;

  // === Structure clustering ===
  /** Structural fingerprint hash for clustering similar layouts */
  structure_hash: string;

  vocab_version: string;
}

/**
 * Confidence breakdown - detailed quality scoring components.
 * Helps ML understand WHY a layout is high/low quality.
 */
export interface ConfidenceBreakdown {
  /** Score based on undo frequency (0-1, fewer undos = higher) */
  undo_score: number;
  /** Score based on fill % and labeling rate (0-1) */
  completion_score: number;
  /** Score based on session time spent (0-1) */
  session_score: number;
  /** Score based on quick correction rate (0-1, fewer = higher) */
  correction_score: number;
  /** Combined weighted score (0-1) */
  combined: number;
}

/**
 * Types of layout abandonment.
 * Helps identify negative training signals.
 */
export type AbandonmentType =
  | 'incomplete' // User stopped mid-layout (low fill, short session)
  | 'deleted' // Layout was explicitly deleted
  | 'dormant' // Layout untouched for extended period
  | 'superseded'; // Layout replaced by a newer version

/**
 * Quality signal event - tracks what happens to layouts after creation.
 * Used to weight training data (shared layouts are higher quality).
 */
export interface LayoutQualityEvent {
  type: 'layout_quality';

  /** Hash of layout for correlation */
  layout_hash: string;

  /** Type of quality signal */
  signal: QualitySignal;

  /** Days since layout was created */
  days_since_creation: number;

  /** Detailed confidence breakdown (optional for backward compat) */
  confidence_breakdown?: ConfidenceBreakdown;

  /** Type of abandonment if applicable */
  abandonment_type: AbandonmentType | null;

  /** Milliseconds since last edit */
  time_since_last_edit_ms: number;
}

/**
 * Drawer purpose event - user-specified categorization.
 * Enables purpose→composition correlation learning.
 */
export interface DrawerPurposeEvent {
  type: 'drawer_purpose';

  /** Hash of layout */
  layout_hash: string;

  /** Selected or entered purpose */
  purpose: string;

  /** True if user entered custom text */
  is_custom: boolean;
}

/**
 * Category change event - when user assigns/changes a bin's category.
 * Tracks category assignment patterns for learning grouping behavior.
 *
 * Only tracks changes to custom categories (user-created names).
 * Default color-based categories (Coral, Sky, Green, etc.) are skipped.
 */
export interface CategoryChangeEvent {
  type: 'category_changed';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  /** Hash of the NEW category name (for pattern learning) */
  category_name_hash: string;

  /** Number of bins changed in this batch (for bulk operations) */
  batch_size: number;

  /** Label data for context (helps correlate item types with categories) */
  label_hash: string | null;
  label_domain: string | null;

  vocab_version: string;
}

/**
 * Bin resize event - when user manually resizes a bin.
 * Tracks size adjustment patterns after initial placement.
 */
export interface BinResizeEvent {
  type: 'bin_resized';

  /** Original size as "WxDxH" string */
  old_size: string;

  /** New size as "WxDxH" string */
  new_size: string;

  /** Which dimension(s) changed */
  dimensions_changed: ('width' | 'depth')[];

  /** Number of bins resized together (for multi-select resize) */
  batch_size: number;

  /** Fill percentage after resize */
  fill_pct: number;

  /** Direction of resize: 'grow' = bin got larger, 'shrink' = smaller, 'mixed' = one grew, one shrank */
  resize_direction: 'grow' | 'shrink' | 'mixed';

  /** Area change in grid units squared (positive = grew, negative = shrank) */
  area_delta: number;
}

/**
 * Bin deletion event - when user deletes a bin.
 * Important negative signal for ML training - helps identify
 * which placements users reject or find unsuitable.
 */
export interface BinDeletedEvent {
  type: 'bin_deleted';

  /** Size of deleted bin as "WxDxH" string */
  bin_size: string;

  /** Position of deleted bin as "X,Y" string */
  position: string;

  /** Layer index where bin was (0 = bottom) */
  layer_index: number;

  /** Whether bin had a label (indicates intentional placement) */
  had_label: boolean;

  /** Label domain if present (for correlation) */
  label_domain: string | null;

  /** How long bin existed before deletion (ms), or null if unknown */
  age_ms: number | null;

  /** Number of bins deleted together (for bulk delete) */
  batch_size: number;

  /** Fill percentage after deletion */
  fill_pct: number;

  /** Delete method */
  method: DeleteMethod;
}

/**
 * Abandoned bin: unlabeled bin deleted shortly after creation.
 * Strong negative signal - user created bin but couldn't figure out what to put there.
 */
export interface AbandonedBinEvent {
  type: 'bin_abandoned';

  /** Size of abandoned bin as "WxDxH" string */
  bin_size: string;

  /** Position where it was placed as "X,Y" string */
  position: string;

  /** Layer index */
  layer_index: number;

  /** How long the bin existed before deletion (ms) */
  lifetime_ms: number;

  /** How the bin was created */
  creation_method: PlacementMethod;

  /** Fill percentage when abandoned */
  fill_pct: number;

  /** Drawer size for context */
  drawer_size: string;
}

/**
 * Bin move event - when user moves/nudges a bin after placement.
 * Tracks position adjustment patterns to understand preferred layouts.
 */
export interface BinMovedEvent {
  type: 'bin_moved';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  /** Original position as "X,Y" string */
  old_position: string;

  /** New position as "X,Y" string */
  new_position: string;

  /** Manhattan distance moved (grid units) */
  distance: number;

  /** Layer index (0 = bottom) */
  layer_index: number;

  /** Number of bins moved together (for multi-select move) */
  batch_size: number;

  /** Move method */
  method: MoveMethod;
}

/**
 * Drawer resize event - when user changes drawer dimensions.
 * Essential context for understanding container constraints.
 */
export interface DrawerResizedEvent {
  type: 'drawer_resized';

  /** Old size as "WxDxH" string */
  old_size: string;

  /** New size as "WxDxH" string */
  new_size: string;

  /** Which dimension(s) changed */
  dimensions_changed: ('width' | 'depth' | 'height')[];

  /** Number of bins moved to staging due to resize */
  bins_staged: number;

  /** Fill percentage after resize */
  fill_pct: number;
}

/**
 * Fill operation event - when user uses fill to populate the grid.
 * Direct statement of user's preferred bin size for the area.
 */
export interface FillOperationEvent {
  type: 'fill_operation';

  /** Fill method: 'uniform' for fillAllWithSize, 'gaps' for fillGaps */
  method: FillMethod;

  /** Bin size used for uniform fill as "WxD" (no height - layer determines it) */
  fill_size: string | null;

  /** Number of bins created by the fill */
  bins_created: number;

  /** Layer index where fill was applied */
  layer_index: number;

  /** Fill percentage after operation */
  fill_pct: number;

  /** Drawer size for context */
  drawer_size: string;
}

/**
 * Layer movement event - when bins are moved between layers.
 * Reveals organizational strategy and layer usage patterns.
 */
export interface LayerMoveEvent {
  type: 'layer_move';

  /** Bin size as "WxDxH" string */
  bin_size: string;

  /** Source layer index (0 = bottom, -1 = staging) */
  from_layer_index: number;

  /** Target layer index (0 = bottom, -1 = staging) */
  to_layer_index: number;

  /** Number of bins moved together */
  batch_size: number;

  /** How the move was initiated */
  method: LayerMoveMethod;
}

/**
 * Bin rotation event - when user swaps width and depth.
 * Completes the picture of dimension adjustments.
 */
export interface BinRotatedEvent {
  type: 'bin_rotated';

  /** Original size as "WxDxH" string */
  old_size: string;

  /** New size (rotated) as "WxDxH" string */
  new_size: string;

  /** Number of bins rotated together (for multi-select) */
  batch_size: number;
}

// ============================================
// NEGATIVE SIGNAL EVENT TYPES
// ============================================

/**
 * Placement rejected event - when user cancels a draw/paint interaction.
 * Critical negative signal showing what users DON'T want.
 */
export interface PlacementRejectedEvent {
  type: 'placement_rejected';

  /** Why the placement was rejected */
  rejection_reason: RejectionReason;

  /** Intended bin size as "WxD" string (if determinable) */
  intended_size: string | null;

  /** Intended position as "X,Y" string (if determinable) */
  intended_position: string | null;

  /** Layer index where placement was attempted */
  layer_index: number;

  /** Drawer size for context */
  drawer_size: string;

  /** Fill percentage at rejection time */
  fill_pct: number;

  /** Whether it was paint mode (multi-bin) or draw mode (single bin) */
  mode: 'draw' | 'paint';
}

/**
 * Undo event - when user undoes an action.
 * Strong signal that previous action was a mistake.
 */
export interface UndoEvent {
  type: 'undo';

  /** What type of action was undone */
  action_undone: UndoActionType;

  /** Number of bins affected by the undo */
  bins_affected: number;

  /** Milliseconds since the action was originally performed */
  time_since_action_ms: number;

  /** Drawer size for context */
  drawer_size: string;
}

/**
 * Quick correction event - when user deletes or resizes a bin shortly after placing it.
 * Indicates the original placement was wrong.
 */
export interface QuickCorrectionEvent {
  type: 'quick_correction';

  /** Type of correction */
  correction_type: 'delete' | 'resize' | 'move';

  /** Original bin size as "WxDxH" string */
  original_size: string;

  /** New size (for resize) or null (for delete) */
  new_size: string | null;

  /** How the bin was originally placed */
  placement_method: PlacementMethod;

  /** Milliseconds between placement and correction */
  time_to_correction_ms: number;

  /** Layer index */
  layer_index: number;
}

// ============================================
// SESSION SUMMARY EVENT (PR 1)
// ============================================

/**
 * Session summary event - captures workflow metrics at session end.
 * Used to understand user behavior patterns and assess data quality.
 */
export interface SessionSummaryEvent {
  type: 'session_summary';

  // === Session activity ===
  /** Total bins placed this session */
  bins_placed: number;
  /** Total bins deleted this session */
  bins_deleted: number;
  /** Total edit actions this session */
  edits_total: number;

  // === Timing ===
  /** Milliseconds from session start to first bin placement, or null if no bins */
  time_to_first_bin_ms: number | null;
  /** Total session duration in milliseconds */
  session_duration_ms: number;

  // === Size sequence ===
  /** Full ordered sequence of bin sizes placed (max 100) */
  size_sequence: string[];

  // === Workflow quality ===
  /** Ratio of corrections (deletes+resizes+moves) to total bins */
  edit_to_done_ratio: number;
  /** Number of undo operations this session */
  undo_count: number;
  /** Confidence score 0-1 based on workflow signals */
  confidence_score: number;

  // === Final state ===
  /** Drawer size as "WxDxH" string */
  drawer_size: string;
  /** Final fill percentage (0-100) */
  final_fill_pct: number;
}

// ============================================
// CROSS-LAYOUT PATTERN EVENT (PR 4)
// ============================================

/**
 * Cross-layout pattern event - tracks label-size consistency across layouts.
 * Helps ML learn which labels typically use which bin sizes.
 */
export interface CrossLayoutPatternEvent {
  type: 'cross_layout_pattern';

  /** Hashed user identifier (device/session based, not reversible) */
  user_hash: string;

  /** Label-size consistency data (limited to top 10 by usage) */
  label_size_consistency: Array<{
    label_hash: string;
    sizes_used: string[];
    is_consistent: boolean;
  }>;

  /** Inferred drawer purpose from label domains */
  inferred_purpose: string | null;

  /** Confidence in the purpose inference (0-1) */
  inferred_purpose_confidence: number;

  /** Drawer size for context */
  drawer_size: string;
}

export type MLTelemetryEvent =
  | BinPlacementEvent
  | LabelUpdateEvent
  | LayoutSnapshotEvent
  | LayoutQualityEvent
  | DrawerPurposeEvent
  | CategoryChangeEvent
  | BinResizeEvent
  | BinDeletedEvent
  | AbandonedBinEvent
  | BinMovedEvent
  | DrawerResizedEvent
  | FillOperationEvent
  | LayerMoveEvent
  | BinRotatedEvent
  | PlacementRejectedEvent
  | UndoEvent
  | QuickCorrectionEvent
  | SessionSummaryEvent
  | CrossLayoutPatternEvent;

export type PlacementMethod = 'draw' | 'fill' | 'duplicate' | 'staging' | 'paint';

export type DeleteMethod = 'key' | 'context_menu' | 'bulk' | 'inspector';

export type MoveMethod = 'drag' | 'nudge' | 'swap';

export type FillMethod = 'uniform' | 'gaps';

export type LayerMoveMethod = 'inspector' | 'drag' | 'keyboard' | 'context_menu';

export type RejectionReason =
  | 'cancelled' // User pressed Escape or clicked away
  | 'second_touch' // Second finger arrived (two-finger pan)
  | 'pointer_cancel' // OS/browser interrupted the gesture (notification, system scroll)
  | 'outside_bounds' // Released outside grid bounds
  | 'too_small'; // Rectangle too small to create bin

export type UndoActionType =
  | 'placement' // Undid bin placement
  | 'deletion' // Undid bin deletion
  | 'move' // Undid bin move
  | 'resize' // Undid bin resize
  | 'fill' // Undid fill operation
  | 'layer_change' // Undid layer assignment
  | 'drawer_resize' // Undid drawer resize
  | 'other'; // Unknown/mixed action

export type LayoutSnapshotTrigger =
  | 'save'
  | 'export_json'
  | 'export_tsv'
  | 'share'
  | 'print'
  | 'session_end' // Tab close / navigate away
  | 'layout_switch' // Switched to different layout
  | 'idle' // No edits for 5+ minutes
  | 'print_preview'; // Opened print modal

export type QualitySignal =
  | 'shared' // User shared publicly (high confidence)
  | 'exported' // User exported to print (high confidence)
  | 'duplicated' // Used as starting point
  | 'deleted' // Negative signal
  | 'revisited_edited' // Came back and changed
  | 'revisited_kept' // Came back, no changes (validation)
  | 'modified'; // Layout modified (for abandonment detection)

/**
 * Quality tier for layout data.
 * Backend can use this to weight training data.
 */
export type LayoutQualityTier = 'high' | 'medium' | 'low' | 'skip';

// ============================================
// DRAWER PURPOSE CONSTANTS
// ============================================

export type DrawerPurpose =
  | 'workshop'
  | 'electronics'
  | 'office'
  | 'craft'
  | 'kitchen'
  | 'bathroom'
  | 'garage'
  | 'other';
