// ============================================
// TYPES
// ============================================

export interface BinPlacementEvent {
  type: 'bin_placed';
  bin_size: string;
  prev_bin_size: string | null;
  drawer_size: string;
  position: string;
  layer_index: number;
  largest_gap: string;
  fill_pct: number;
  gap_fit: 'exact' | 'partial' | 'none';
  label_hash: string | null;
  label_normalized: string | null;
  label_domain: string | null;
  label_embedding_bucket: string | null;
  category_id: string;
  // Adjacent context
  adjacent_label_hashes: string[];
  adjacent_sizes: string[];
  adjacent_count: number;
  // Sequence context
  recent_sizes: string[];
  time_since_last_ms: number | null;
  is_first_of_label: boolean;
  // Context
  method: string;
  session_index: number;
  vocab_version: string;
}

export interface LabelUpdateEvent {
  type: 'label_updated';
  bin_size: string;
  old_label_hash: string | null;
  old_label_normalized: string | null;
  new_label_hash: string | null;
  new_label_normalized: string | null;
  new_label_domain: string | null;
  new_label_embedding_bucket: string | null;
  vocab_version: string;
}

export type LayoutArchetype = 'uniform' | 'mixed' | 'border_fill' | 'compartmentalized' | 'layered';
export type SpatialPattern =
  | 'corner_start'
  | 'large_first'
  | 'category_grouped'
  | 'edge_aligned'
  | 'center_out';

export interface EdgeUsage {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

export interface LayoutSnapshotEvent {
  type: 'layout_snapshot';
  trigger:
    | 'save'
    | 'export_json'
    | 'export_tsv'
    | 'share'
    | 'print'
    | 'session_end'
    | 'layout_switch'
    | 'idle'
    | 'print_preview';
  layout_hash: string;
  snapshot_index: number;
  drawer_size: string;
  layer_count: number;
  purpose: string | null;
  bin_count: number;
  size_distribution: Record<string, number>;
  category_distribution: Record<string, number>;
  domain_distribution: Record<string, number>;
  top_label_hashes: string[];
  fill_percentage: number;
  labeled_percentage: number;
  session_duration_ms: number;
  edit_count: number;
  quality_tier: 'high' | 'medium' | 'low' | 'skip';
  archetype: LayoutArchetype;
  spatial_patterns: SpatialPattern[];
  uniformity_score: number;
  edge_usage: EdgeUsage;
  hour_of_day: number;
  day_of_week: number;
  is_weekend: boolean;
  structure_hash: string;
  vocab_version: string;
}

export interface ConfidenceBreakdown {
  undo_score: number;
  completion_score: number;
  session_score: number;
  correction_score: number;
  combined: number;
}

export type AbandonmentType = 'incomplete' | 'deleted' | 'dormant' | 'superseded';

export interface LayoutQualityEvent {
  type: 'layout_quality';
  layout_hash: string;
  signal:
    | 'shared'
    | 'exported'
    | 'duplicated'
    | 'deleted'
    | 'revisited_edited'
    | 'revisited_kept'
    | 'modified';
  days_since_creation: number;
  confidence_breakdown?: ConfidenceBreakdown;
  abandonment_type: AbandonmentType | null;
  time_since_last_edit_ms: number;
}

export interface DrawerPurposeEvent {
  type: 'drawer_purpose';
  layout_hash: string;
  purpose: string;
  is_custom: boolean;
}

export interface CategoryChangeEvent {
  type: 'category_changed';
  bin_size: string;
  /** Hash of the category name (custom categories only, defaults skipped client-side) */
  category_name_hash: string;
  batch_size: number;
  label_hash: string | null;
  label_domain: string | null;
  vocab_version: string;
}

export interface BinResizeEvent {
  type: 'bin_resized';
  old_size: string;
  new_size: string;
  dimensions_changed: ('width' | 'depth')[];
  batch_size: number;
  fill_pct: number;
  resize_direction: 'grow' | 'shrink' | 'mixed';
  area_delta: number;
}

export interface BinDeletedEvent {
  type: 'bin_deleted';
  bin_size: string;
  position: string;
  layer_index: number;
  had_label: boolean;
  label_domain: string | null;
  age_ms: number | null;
  batch_size: number;
  fill_pct: number;
  method: 'key' | 'context_menu' | 'bulk' | 'inspector';
}

export interface AbandonedBinEvent {
  type: 'bin_abandoned';
  bin_size: string;
  position: string;
  layer_index: number;
  lifetime_ms: number;
  creation_method: string;
  fill_pct: number;
  drawer_size: string;
}

export interface BinMovedEvent {
  type: 'bin_moved';
  bin_size: string;
  old_position: string;
  new_position: string;
  distance: number;
  layer_index: number;
  batch_size: number;
  method: 'drag' | 'nudge';
}

export interface DrawerResizedEvent {
  type: 'drawer_resized';
  old_size: string;
  new_size: string;
  dimensions_changed: ('width' | 'depth' | 'height')[];
  bins_staged: number;
  fill_pct: number;
}

export interface FillOperationEvent {
  type: 'fill_operation';
  method: 'uniform' | 'gaps';
  fill_size: string | null;
  bins_created: number;
  layer_index: number;
  fill_pct: number;
  drawer_size: string;
}

export interface LayerMoveEvent {
  type: 'layer_move';
  bin_size: string;
  from_layer_index: number;
  to_layer_index: number;
  batch_size: number;
  method: 'inspector' | 'drag' | 'keyboard' | 'context_menu';
}

export interface BinRotatedEvent {
  type: 'bin_rotated';
  old_size: string;
  new_size: string;
  batch_size: number;
}

// ============================================
// NEGATIVE SIGNAL EVENT TYPES
// ============================================

export interface PlacementRejectedEvent {
  type: 'placement_rejected';
  rejection_reason: 'cancelled' | 'second_touch' | 'outside_bounds' | 'too_small';
  intended_size: string | null;
  intended_position: string | null;
  layer_index: number;
  drawer_size: string;
  fill_pct: number;
  mode: 'draw' | 'paint';
}

export interface UndoEvent {
  type: 'undo';
  action_undone:
    | 'placement'
    | 'deletion'
    | 'move'
    | 'resize'
    | 'fill'
    | 'layer_change'
    | 'drawer_resize'
    | 'other';
  bins_affected: number;
  time_since_action_ms: number;
  drawer_size: string;
}

export interface QuickCorrectionEvent {
  type: 'quick_correction';
  correction_type: 'delete' | 'resize' | 'move';
  original_size: string;
  new_size: string | null;
  placement_method: 'draw' | 'fill' | 'duplicate' | 'staging' | 'paint';
  time_to_correction_ms: number;
  layer_index: number;
}

// ============================================
// SESSION SUMMARY EVENT TYPE
// ============================================

export interface SessionSummaryEvent {
  type: 'session_summary';
  bins_placed: number;
  bins_deleted: number;
  edits_total: number;
  time_to_first_bin_ms: number | null;
  session_duration_ms: number;
  size_sequence: string[];
  edit_to_done_ratio: number;
  undo_count: number;
  confidence_score: number;
  drawer_size: string;
  final_fill_pct: number;
}

// ============================================
// CROSS-LAYOUT PATTERN EVENT TYPE
// ============================================

export interface CrossLayoutPatternEvent {
  type: 'cross_layout_pattern';
  user_hash: string;
  label_size_consistency: Array<{
    label_hash: string;
    sizes_used: string[];
    is_consistent: boolean;
  }>;
  inferred_purpose: string | null;
  inferred_purpose_confidence: number;
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
