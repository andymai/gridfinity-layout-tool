import type { ConfidenceBreakdown, EdgeUsage, MLTelemetryEvent, SpatialPattern } from './types.js';

// ============================================
// VALIDATION
// ============================================

const VALID_BIN_SIZE_REGEX = /^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/;
const VALID_DRAWER_SIZE_REGEX = /^\d+(\.\d+)?x\d+(\.\d+)?x\d+(\.\d+)?$/;
const VALID_GAP_FIT = new Set(['exact', 'partial', 'none']);
const VALID_METHODS = new Set(['draw', 'fill', 'duplicate', 'staging', 'paint']);

// Security: Strict validation for fields used in Redis keys to prevent injection
const VALID_LABEL_HASH_REGEX = /^[a-f0-9]{8}$/; // 8-char hex hash
const VALID_LAYOUT_HASH_REGEX = /^[a-f0-9]{8}$/; // 8-char hex hash
const VALID_NORMALIZED_LABEL_REGEX = /^[a-z][a-z0-9_]{0,31}$/; // lowercase, alphanumeric + underscore
const VALID_CATEGORY_ID_REGEX = /^[a-zA-Z0-9_-]{1,36}$/; // UUID-like or simple ID
const VALID_EMBEDDING_BUCKET_REGEX = /^[a-f0-9]{4}$/; // 4-char hex embedding bucket
const VALID_DOMAINS = new Set([
  'tools',
  'fasteners',
  'electronics',
  'office',
  'craft',
  'printing_3d',
  'cosmetics',
  'misc',
]);

// Layout snapshot validation
const VALID_TRIGGERS = new Set([
  'save',
  'export_json',
  'export_tsv',
  'share',
  'print',
  'session_end',
  'layout_switch',
  'idle',
  'print_preview',
]);
const VALID_QUALITY_SIGNALS = new Set([
  'shared',
  'exported',
  'duplicated',
  'deleted',
  'revisited_edited',
  'revisited_kept',
  'modified',
]);
const VALID_ABANDONMENT_TYPES = new Set(['incomplete', 'deleted', 'dormant', 'superseded']);
const VALID_PURPOSES = new Set([
  'workshop',
  'electronics',
  'office',
  'craft',
  'kitchen',
  'bathroom',
  'garage',
  'other',
]);
const VALID_PURPOSE_REGEX = /^[a-z][a-z0-9_-]{0,31}$/; // For custom purposes
const VALID_QUALITY_TIERS = new Set(['high', 'medium', 'low', 'skip']);
const VALID_DELETE_METHODS = new Set(['key', 'context_menu', 'bulk', 'inspector']);
const VALID_MOVE_METHODS = new Set(['drag', 'nudge']);
const VALID_POSITION_REGEX = /^\d+(\.\d+)?,\d+(\.\d+)?$/; // e.g., "3,5" or "3.5,2.5"
const VALID_FILL_METHODS = new Set(['uniform', 'gaps']);
const VALID_LAYER_MOVE_METHODS = new Set(['inspector', 'drag', 'keyboard', 'context_menu']);
const VALID_FILL_SIZE_REGEX = /^\d+(\.\d+)?x\d+(\.\d+)?$/; // WxD (no height)

// Negative signal validation
const VALID_REJECTION_REASONS = new Set([
  'cancelled',
  'second_touch',
  'outside_bounds',
  'too_small',
]);
const VALID_DRAW_MODES = new Set(['draw', 'paint']);
const VALID_UNDO_ACTIONS = new Set([
  'placement',
  'deletion',
  'move',
  'resize',
  'fill',
  'layer_change',
  'drawer_resize',
  'other',
]);
const VALID_CORRECTION_TYPES = new Set(['delete', 'resize', 'move']);
const VALID_RESIZE_DIRECTIONS = new Set(['grow', 'shrink', 'mixed']);

// Pattern detection validation
const VALID_ARCHETYPES = new Set([
  'uniform',
  'mixed',
  'border_fill',
  'compartmentalized',
  'layered',
]);
const VALID_SPATIAL_PATTERNS = new Set([
  'corner_start',
  'large_first',
  'category_grouped',
  'edge_aligned',
  'center_out',
]);

/**
 * Validate spatial patterns array.
 */
function validateSpatialPatterns(value: unknown): value is SpatialPattern[] {
  if (!Array.isArray(value)) return false;
  if (value.length > 10) return false; // Reasonable limit
  return value.every((p) => typeof p === 'string' && VALID_SPATIAL_PATTERNS.has(p));
}

/**
 * Validate edge usage object.
 */
function validateEdgeUsage(value: unknown): value is EdgeUsage {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return (
    typeof e.left === 'boolean' &&
    typeof e.right === 'boolean' &&
    typeof e.top === 'boolean' &&
    typeof e.bottom === 'boolean'
  );
}

/**
 * Validate confidence breakdown object.
 * All scores must be numbers between 0 and 1.
 */
function validateConfidenceBreakdown(value: unknown): value is ConfidenceBreakdown {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  const isValidScore = (v: unknown): boolean => typeof v === 'number' && v >= 0 && v <= 1;
  return (
    isValidScore(c.undo_score) &&
    isValidScore(c.completion_score) &&
    isValidScore(c.session_score) &&
    isValidScore(c.correction_score) &&
    isValidScore(c.combined)
  );
}

/**
 * Validate nullable string field used in Redis keys.
 * Returns true if null or matches the pattern.
 */
function validateNullableField(value: unknown, pattern: RegExp): value is string | null {
  if (value === null) return true;
  return typeof value === 'string' && pattern.test(value);
}

/**
 * Validate nullable domain field.
 * Returns true if null or is a known domain.
 */
function validateNullableDomain(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === 'string' && VALID_DOMAINS.has(value);
}

/**
 * Validate size distribution object (all keys are valid bin sizes, values are positive numbers).
 */
function validateSizeDistribution(value: unknown): value is Record<string, number> {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (!VALID_BIN_SIZE_REGEX.test(key)) return false;
    if (typeof val !== 'number' || val < 0 || val > 10000) return false;
  }
  return true;
}

/**
 * Validate category/domain distribution object (keys are valid IDs, values are positive numbers).
 */
function validateDistribution(value: unknown, keyPattern: RegExp): value is Record<string, number> {
  if (!value || typeof value !== 'object') return false;
  const obj = value as Record<string, unknown>;
  for (const [key, val] of Object.entries(obj)) {
    if (!keyPattern.test(key) && key !== 'uncategorized' && key !== 'unknown') return false;
    if (typeof val !== 'number' || val < 0 || val > 10000) return false;
  }
  return true;
}

/**
 * Validate label hash array (all are valid 8-char hex hashes).
 */
function validateLabelHashArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length > 20) return false; // Cap at 20 hashes
  for (const hash of value) {
    if (typeof hash !== 'string' || !VALID_LABEL_HASH_REGEX.test(hash)) return false;
  }
  return true;
}

/**
 * Validate size sequence array (all are valid bin sizes).
 */
function validateSizeSequenceArray(value: unknown): value is string[] {
  if (!Array.isArray(value)) return false;
  if (value.length > 100) return false; // Cap at 100 sizes
  for (const size of value) {
    if (typeof size !== 'string' || !VALID_BIN_SIZE_REGEX.test(size)) return false;
  }
  return true;
}

// Field validators for common patterns in validateEvent
function isBinSize(v: unknown): v is string {
  return typeof v === 'string' && VALID_BIN_SIZE_REGEX.test(v);
}
function isDrawerSize(v: unknown): v is string {
  return typeof v === 'string' && VALID_DRAWER_SIZE_REGEX.test(v);
}
function isLayerIndex(v: unknown): v is number {
  return typeof v === 'number' && v >= 0 && v <= 20;
}
function isFillPct(v: unknown): v is number {
  return typeof v === 'number' && v >= 0 && v <= 100;
}
function isBatchSize(v: unknown): v is number {
  return typeof v === 'number' && v > 0 && v < 1000;
}
function isCount(v: unknown, max = 10000): v is number {
  return typeof v === 'number' && v >= 0 && v < max;
}

export function validateEvent(event: unknown): event is MLTelemetryEvent {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;

  if (e.type === 'bin_placed') {
    return (
      isBinSize(e.bin_size) &&
      (e.prev_bin_size === null || isBinSize(e.prev_bin_size)) &&
      isDrawerSize(e.drawer_size) &&
      typeof e.gap_fit === 'string' &&
      VALID_GAP_FIT.has(e.gap_fit) &&
      typeof e.method === 'string' &&
      VALID_METHODS.has(e.method) &&
      isCount(e.session_index) &&
      // Security: Validate fields used in Redis keys
      validateNullableField(e.label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableField(e.label_normalized, VALID_NORMALIZED_LABEL_REGEX) &&
      validateNullableDomain(e.label_domain) &&
      validateNullableField(e.label_embedding_bucket, VALID_EMBEDDING_BUCKET_REGEX) &&
      typeof e.category_id === 'string' &&
      VALID_CATEGORY_ID_REGEX.test(e.category_id) &&
      // Adjacent context validation (Priority 3)
      Array.isArray(e.adjacent_label_hashes) &&
      e.adjacent_label_hashes.length <= 8 &&
      e.adjacent_label_hashes.every(
        (h: unknown) => typeof h === 'string' && VALID_LABEL_HASH_REGEX.test(h)
      ) &&
      Array.isArray(e.adjacent_sizes) &&
      e.adjacent_sizes.length <= 8 &&
      e.adjacent_sizes.every(
        (s: unknown) => typeof s === 'string' && VALID_BIN_SIZE_REGEX.test(s)
      ) &&
      typeof e.adjacent_count === 'number' &&
      e.adjacent_count >= 0 &&
      e.adjacent_count <= 8 &&
      // Sequence context validation (Priority 5)
      Array.isArray(e.recent_sizes) &&
      e.recent_sizes.length <= 5 &&
      e.recent_sizes.every((s: unknown) => typeof s === 'string' && VALID_BIN_SIZE_REGEX.test(s)) &&
      (e.time_since_last_ms === null ||
        (typeof e.time_since_last_ms === 'number' &&
          e.time_since_last_ms >= 0 &&
          e.time_since_last_ms < 86400000)) && // Max 24 hours
      typeof e.is_first_of_label === 'boolean'
    );
  }

  if (e.type === 'label_updated') {
    return (
      isBinSize(e.bin_size) &&
      // Security: Validate fields used in Redis keys
      validateNullableField(e.old_label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableField(e.old_label_normalized, VALID_NORMALIZED_LABEL_REGEX) &&
      validateNullableField(e.new_label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableField(e.new_label_normalized, VALID_NORMALIZED_LABEL_REGEX) &&
      validateNullableDomain(e.new_label_domain) &&
      validateNullableField(e.new_label_embedding_bucket, VALID_EMBEDDING_BUCKET_REGEX)
    );
  }

  if (e.type === 'layout_snapshot') {
    return (
      typeof e.trigger === 'string' &&
      VALID_TRIGGERS.has(e.trigger) &&
      typeof e.layout_hash === 'string' &&
      VALID_LAYOUT_HASH_REGEX.test(e.layout_hash) &&
      isCount(e.snapshot_index) &&
      isDrawerSize(e.drawer_size) &&
      isLayerIndex(e.layer_count) &&
      (e.purpose === null ||
        (typeof e.purpose === 'string' &&
          (VALID_PURPOSES.has(e.purpose) || VALID_PURPOSE_REGEX.test(e.purpose)))) &&
      isCount(e.bin_count) &&
      validateSizeDistribution(e.size_distribution) &&
      validateDistribution(e.category_distribution, VALID_CATEGORY_ID_REGEX) &&
      validateDistribution(e.domain_distribution, /^[a-z_]+$/) &&
      validateLabelHashArray(e.top_label_hashes) &&
      isFillPct(e.fill_percentage) &&
      isFillPct(e.labeled_percentage) &&
      typeof e.session_duration_ms === 'number' &&
      e.session_duration_ms >= 0 &&
      typeof e.edit_count === 'number' &&
      e.edit_count >= 0 &&
      typeof e.quality_tier === 'string' &&
      VALID_QUALITY_TIERS.has(e.quality_tier) &&
      // Pattern detection fields
      typeof e.archetype === 'string' &&
      VALID_ARCHETYPES.has(e.archetype) &&
      validateSpatialPatterns(e.spatial_patterns) &&
      typeof e.uniformity_score === 'number' &&
      e.uniformity_score >= 0 &&
      e.uniformity_score <= 1 &&
      validateEdgeUsage(e.edge_usage) &&
      // Temporal fields
      typeof e.hour_of_day === 'number' &&
      e.hour_of_day >= 0 &&
      e.hour_of_day <= 23 &&
      typeof e.day_of_week === 'number' &&
      e.day_of_week >= 0 &&
      e.day_of_week <= 6 &&
      typeof e.is_weekend === 'boolean' &&
      // Structure clustering
      typeof e.structure_hash === 'string' &&
      /^[a-f0-9]{8}$/.test(e.structure_hash)
    );
  }

  if (e.type === 'layout_quality') {
    return (
      typeof e.layout_hash === 'string' &&
      VALID_LAYOUT_HASH_REGEX.test(e.layout_hash) &&
      typeof e.signal === 'string' &&
      VALID_QUALITY_SIGNALS.has(e.signal) &&
      isCount(e.days_since_creation) &&
      // New fields for PR 5
      (e.confidence_breakdown === undefined ||
        validateConfidenceBreakdown(e.confidence_breakdown)) &&
      (e.abandonment_type === null ||
        (typeof e.abandonment_type === 'string' &&
          VALID_ABANDONMENT_TYPES.has(e.abandonment_type))) &&
      typeof e.time_since_last_edit_ms === 'number' &&
      e.time_since_last_edit_ms >= 0 &&
      e.time_since_last_edit_ms < 86400000 // Max 24 hours
    );
  }

  if (e.type === 'drawer_purpose') {
    return (
      typeof e.layout_hash === 'string' &&
      VALID_LAYOUT_HASH_REGEX.test(e.layout_hash) &&
      typeof e.purpose === 'string' &&
      (VALID_PURPOSES.has(e.purpose) || VALID_PURPOSE_REGEX.test(e.purpose)) &&
      typeof e.is_custom === 'boolean'
    );
  }

  if (e.type === 'category_changed') {
    return (
      isBinSize(e.bin_size) &&
      // Category name hash: 8-char hex (same format as label hashes)
      typeof e.category_name_hash === 'string' &&
      VALID_LABEL_HASH_REGEX.test(e.category_name_hash) &&
      isBatchSize(e.batch_size) &&
      validateNullableField(e.label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableDomain(e.label_domain)
    );
  }

  if (e.type === 'bin_resized') {
    const validDimensions =
      Array.isArray(e.dimensions_changed) &&
      e.dimensions_changed.length > 0 &&
      e.dimensions_changed.every((d: unknown) => d === 'width' || d === 'depth');
    return (
      isBinSize(e.old_size) &&
      isBinSize(e.new_size) &&
      validDimensions &&
      isBatchSize(e.batch_size) &&
      isFillPct(e.fill_pct) &&
      // Resize direction (Priority 1)
      typeof e.resize_direction === 'string' &&
      VALID_RESIZE_DIRECTIONS.has(e.resize_direction) &&
      typeof e.area_delta === 'number' &&
      Math.abs(e.area_delta) < 10000 // Reasonable bound for area change
    );
  }

  if (e.type === 'bin_deleted') {
    return (
      isBinSize(e.bin_size) &&
      typeof e.position === 'string' &&
      VALID_POSITION_REGEX.test(e.position) &&
      isLayerIndex(e.layer_index) &&
      typeof e.had_label === 'boolean' &&
      validateNullableDomain(e.label_domain) &&
      (e.age_ms === null || (typeof e.age_ms === 'number' && e.age_ms >= 0)) &&
      isBatchSize(e.batch_size) &&
      isFillPct(e.fill_pct) &&
      typeof e.method === 'string' &&
      VALID_DELETE_METHODS.has(e.method)
    );
  }

  if (e.type === 'bin_moved') {
    return (
      isBinSize(e.bin_size) &&
      typeof e.old_position === 'string' &&
      VALID_POSITION_REGEX.test(e.old_position) &&
      typeof e.new_position === 'string' &&
      VALID_POSITION_REGEX.test(e.new_position) &&
      isCount(e.distance, 1000) &&
      isLayerIndex(e.layer_index) &&
      isBatchSize(e.batch_size) &&
      typeof e.method === 'string' &&
      VALID_MOVE_METHODS.has(e.method)
    );
  }

  if (e.type === 'drawer_resized') {
    const validDimensions =
      Array.isArray(e.dimensions_changed) &&
      e.dimensions_changed.length > 0 &&
      e.dimensions_changed.every((d: unknown) => d === 'width' || d === 'depth' || d === 'height');
    return (
      isDrawerSize(e.old_size) &&
      isDrawerSize(e.new_size) &&
      validDimensions &&
      isCount(e.bins_staged) &&
      isFillPct(e.fill_pct)
    );
  }

  if (e.type === 'fill_operation') {
    return (
      typeof e.method === 'string' &&
      VALID_FILL_METHODS.has(e.method) &&
      (e.fill_size === null ||
        (typeof e.fill_size === 'string' && VALID_FILL_SIZE_REGEX.test(e.fill_size))) &&
      isCount(e.bins_created) &&
      e.bins_created > 0 &&
      isLayerIndex(e.layer_index) &&
      isFillPct(e.fill_pct) &&
      isDrawerSize(e.drawer_size)
    );
  }

  if (e.type === 'layer_move') {
    return (
      isBinSize(e.bin_size) &&
      typeof e.from_layer_index === 'number' &&
      e.from_layer_index >= -1 && // -1 = staging
      e.from_layer_index <= 20 &&
      typeof e.to_layer_index === 'number' &&
      e.to_layer_index >= -1 && // -1 = staging
      e.to_layer_index <= 20 &&
      isBatchSize(e.batch_size) &&
      typeof e.method === 'string' &&
      VALID_LAYER_MOVE_METHODS.has(e.method)
    );
  }

  if (e.type === 'bin_rotated') {
    return isBinSize(e.old_size) && isBinSize(e.new_size) && isBatchSize(e.batch_size);
  }

  // ============================================
  // NEGATIVE SIGNAL EVENT VALIDATION
  // ============================================

  if (e.type === 'placement_rejected') {
    return (
      typeof e.rejection_reason === 'string' &&
      VALID_REJECTION_REASONS.has(e.rejection_reason) &&
      // intended_size is 2D format (WxD) since height isn't known for rejected placements
      (e.intended_size === null ||
        (typeof e.intended_size === 'string' && VALID_FILL_SIZE_REGEX.test(e.intended_size))) &&
      (e.intended_position === null ||
        (typeof e.intended_position === 'string' &&
          VALID_POSITION_REGEX.test(e.intended_position))) &&
      isLayerIndex(e.layer_index) &&
      isDrawerSize(e.drawer_size) &&
      isFillPct(e.fill_pct) &&
      typeof e.mode === 'string' &&
      VALID_DRAW_MODES.has(e.mode)
    );
  }

  if (e.type === 'undo') {
    return (
      typeof e.action_undone === 'string' &&
      VALID_UNDO_ACTIONS.has(e.action_undone) &&
      isCount(e.bins_affected) &&
      typeof e.time_since_action_ms === 'number' &&
      e.time_since_action_ms >= 0 &&
      isDrawerSize(e.drawer_size)
    );
  }

  if (e.type === 'quick_correction') {
    return (
      typeof e.correction_type === 'string' &&
      VALID_CORRECTION_TYPES.has(e.correction_type) &&
      isBinSize(e.original_size) &&
      (e.new_size === null || isBinSize(e.new_size)) &&
      typeof e.placement_method === 'string' &&
      VALID_METHODS.has(e.placement_method) &&
      isCount(e.time_to_correction_ms, 600_000) && // Max 10 minutes
      isLayerIndex(e.layer_index)
    );
  }

  if (e.type === 'bin_abandoned') {
    return (
      isBinSize(e.bin_size) &&
      typeof e.position === 'string' &&
      VALID_POSITION_REGEX.test(e.position) &&
      isLayerIndex(e.layer_index) &&
      isCount(e.lifetime_ms, 86400000) && // Max 24 hours
      typeof e.creation_method === 'string' &&
      VALID_METHODS.has(e.creation_method) &&
      isFillPct(e.fill_pct) &&
      isDrawerSize(e.drawer_size)
    );
  }

  // ============================================
  // SESSION SUMMARY VALIDATION
  // ============================================

  if (e.type === 'session_summary') {
    return (
      isCount(e.bins_placed) &&
      isCount(e.bins_deleted) &&
      isCount(e.edits_total, 100000) &&
      (e.time_to_first_bin_ms === null || isCount(e.time_to_first_bin_ms, 86400000)) && // Max 24 hours
      isCount(e.session_duration_ms, 86400000) && // Max 24 hours
      validateSizeSequenceArray(e.size_sequence) &&
      isFillPct(e.edit_to_done_ratio) && // Ratio can exceed 1.0 when edits > bins (e.g., heavy editing then deleting)
      isCount(e.undo_count) &&
      typeof e.confidence_score === 'number' &&
      e.confidence_score >= 0 &&
      e.confidence_score <= 1 &&
      isDrawerSize(e.drawer_size) &&
      isFillPct(e.final_fill_pct)
    );
  }

  // ============================================
  // CROSS-LAYOUT PATTERN VALIDATION
  // ============================================

  if (e.type === 'cross_layout_pattern') {
    // Validate user_hash (UUID format from crypto.randomUUID() or simple alphanumeric)
    // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with hyphens)
    // Simple format: 8-20 lowercase alphanumeric chars
    if (typeof e.user_hash !== 'string' || !/^[a-z0-9-]{8,36}$/.test(e.user_hash)) {
      // Allow 'anonymous' as fallback
      if (e.user_hash !== 'anonymous') return false;
    }

    // Validate drawer_size
    if (!isDrawerSize(e.drawer_size)) {
      return false;
    }

    // Validate inferred_purpose
    if (
      e.inferred_purpose !== null &&
      (typeof e.inferred_purpose !== 'string' ||
        (!VALID_PURPOSES.has(e.inferred_purpose) && !VALID_PURPOSE_REGEX.test(e.inferred_purpose)))
    ) {
      return false;
    }

    // Validate confidence
    if (
      typeof e.inferred_purpose_confidence !== 'number' ||
      e.inferred_purpose_confidence < 0 ||
      e.inferred_purpose_confidence > 1
    ) {
      return false;
    }

    // Validate label_size_consistency array
    if (!Array.isArray(e.label_size_consistency) || e.label_size_consistency.length > 20) {
      return false;
    }

    for (const rawItem of e.label_size_consistency) {
      if (!rawItem || typeof rawItem !== 'object') return false;
      const item = rawItem as Record<string, unknown>;
      if (typeof item.label_hash !== 'string' || !VALID_LABEL_HASH_REGEX.test(item.label_hash)) {
        return false;
      }
      if (
        !Array.isArray(item.sizes_used) ||
        item.sizes_used.length === 0 ||
        item.sizes_used.length > 10
      ) {
        return false;
      }
      for (const size of item.sizes_used as unknown[]) {
        if (typeof size !== 'string' || !VALID_BIN_SIZE_REGEX.test(size)) {
          return false;
        }
      }
      if (typeof item.is_consistent !== 'boolean') {
        return false;
      }
    }

    return true;
  }

  return false;
}
