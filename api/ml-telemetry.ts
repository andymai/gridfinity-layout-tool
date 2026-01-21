/**
 * ML Telemetry API Endpoint
 *
 * Receives batched telemetry events from clients and aggregates into Redis counters.
 * No raw events are stored - only aggregate counts for ML training.
 *
 * Redis Schema:
 *
 * === Bin Placement ===
 * - ml:sizes                  → Global bin size frequency
 * - ml:trans:{prev}           → Transition matrix (prev_size → next_size)
 * - ml:drawer:{size}          → Bin sizes per drawer size
 * - ml:label_hash:{hash}      → Bin sizes per label hash (PRIMARY - any language)
 * - ml:label:{normalized}     → Bin sizes per normalized label (ENRICHMENT)
 * - ml:label_domain:{domain}  → Bin sizes per domain category (FALLBACK)
 * - ml:cat:{category}         → Bin sizes per category
 * - ml:gapfit:{fit}           → Bin sizes per gap fit type
 * - ml:method:{method}        → Bin sizes per placement method
 * - ml:unknown_hashes         → Popular unknown label hashes (for vocab expansion)
 *
 * === Layout Snapshots ===
 * - ml:drawer_sizes:{drawer}  → Bin size distribution by drawer size
 * - ml:domains:{drawer}       → Domain distribution by drawer size
 * - ml:cooccur:{hash}         → Label co-occurrence matrix
 * - ml:triggers               → Snapshot trigger distribution
 * - ml:purpose:{purpose}      → Drawer purpose frequency
 * - ml:purpose_sizes:{purpose} → Bin sizes by drawer purpose
 *
 * === Quality Signals ===
 * - ml:quality:{signal}       → Quality signal counts
 * - ml:quality_layouts        → Layouts by quality signal type
 *
 * === Category Changes ===
 * - ml:cat_sizes:{cat_hash}   → Bin sizes assigned to each category (by name hash)
 * - ml:label_cat:{label_hash} → Which categories labeled items are assigned to
 * - ml:domain_cat:{domain}    → Category assignments by label domain
 * - ml:cat_changes            → Total category change event count
 *
 * === Bin Resizes ===
 * - ml:resize:{old_size}      → Resize transition matrix (old → new size)
 * - ml:resize_dims            → Which dimensions are resized (width/depth)
 * - ml:resizes                → Total resize event count
 * - ml:resize_results         → Distribution of resulting sizes after resize
 *
 * === Bin Deletions (Negative Signal) ===
 * - ml:deleted_sizes          → Size distribution of deleted bins (negative signal)
 * - ml:delete_methods         → Deletion method distribution (key/context_menu/bulk/inspector)
 * - ml:delete_labeled         → Labeled vs unlabeled deletion rate
 * - ml:delete_domain:{domain} → Deleted sizes by label domain
 * - ml:deletions              → Total deletion event count
 *
 * === Bin Moves ===
 * - ml:moved_sizes            → Size distribution of moved bins
 * - ml:move_methods           → Move method distribution (drag/nudge)
 * - ml:move_distances         → Move distance buckets (micro/short/medium/long)
 * - ml:moves                  → Total move event count
 *
 * === Placement Rejections (Negative Signal) ===
 * - ml:rejections             → Total rejection count by reason
 * - ml:reject_modes           → Rejection count by draw/paint mode
 * - ml:reject_sizes           → Intended sizes that were rejected
 * - ml:neg:reject_by_drawer:{size} → Rejected sizes by drawer size
 *
 * === Undo Events (Negative Signal) ===
 * - ml:undos                  → Total undo count by action type
 * - ml:undo_timing            → Undo timing buckets (immediate/quick/delayed)
 * - ml:undo_action_timing     → Action + timing combos (e.g., placement_immediate)
 * - ml:undo_scale             → Undo scale (single/few/many/bulk bins)
 *
 * === Quick Corrections (Negative Signal - STRONGEST) ===
 * - ml:quick_corrections      → Total quick correction count by type
 * - ml:neg:corrected_sizes    → Sizes that get quickly corrected (BAD sizes)
 * - ml:neg:correct_by_method:{method} → Corrections by placement method
 * - ml:correction_timing      → How fast corrections happen
 * - ml:neg:resize_correct:{size} → What users resize corrected bins to
 *
 * === Metadata ===
 * - ml:meta:*                 → Metadata counters
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import Redis from 'ioredis';

// ============================================
// TYPES
// ============================================

interface BinPlacementEvent {
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
  category_id: string;
  method: string;
  session_index: number;
  vocab_version: string;
}

interface LabelUpdateEvent {
  type: 'label_updated';
  bin_size: string;
  old_label_hash: string | null;
  old_label_normalized: string | null;
  new_label_hash: string | null;
  new_label_normalized: string | null;
  new_label_domain: string | null;
  vocab_version: string;
}

type LayoutArchetype = 'uniform' | 'mixed' | 'border_fill' | 'compartmentalized' | 'layered';
type SpatialPattern = 'corner_start' | 'large_first' | 'category_grouped' | 'edge_aligned' | 'center_out';

interface EdgeUsage {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

interface LayoutSnapshotEvent {
  type: 'layout_snapshot';
  trigger: 'save' | 'export_json' | 'export_tsv' | 'share' | 'print' | 'session_end' | 'layout_switch' | 'idle' | 'print_preview';
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
  vocab_version: string;
}

interface LayoutQualityEvent {
  type: 'layout_quality';
  layout_hash: string;
  signal: 'shared' | 'exported' | 'duplicated' | 'deleted' | 'revisited_edited' | 'revisited_kept';
  days_since_creation: number;
}

interface DrawerPurposeEvent {
  type: 'drawer_purpose';
  layout_hash: string;
  purpose: string;
  is_custom: boolean;
}

interface CategoryChangeEvent {
  type: 'category_changed';
  bin_size: string;
  /** Hash of the category name (custom categories only, defaults skipped client-side) */
  category_name_hash: string;
  batch_size: number;
  label_hash: string | null;
  label_domain: string | null;
  vocab_version: string;
}

interface BinResizeEvent {
  type: 'bin_resized';
  old_size: string;
  new_size: string;
  dimensions_changed: ('width' | 'depth')[];
  batch_size: number;
  fill_pct: number;
}

interface BinDeletedEvent {
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

interface BinMovedEvent {
  type: 'bin_moved';
  bin_size: string;
  old_position: string;
  new_position: string;
  distance: number;
  layer_index: number;
  batch_size: number;
  method: 'drag' | 'nudge';
}

interface DrawerResizedEvent {
  type: 'drawer_resized';
  old_size: string;
  new_size: string;
  dimensions_changed: ('width' | 'depth' | 'height')[];
  bins_staged: number;
  fill_pct: number;
}

interface FillOperationEvent {
  type: 'fill_operation';
  method: 'uniform' | 'gaps';
  fill_size: string | null;
  bins_created: number;
  layer_index: number;
  fill_pct: number;
  drawer_size: string;
}

interface LayerMoveEvent {
  type: 'layer_move';
  bin_size: string;
  from_layer_index: number;
  to_layer_index: number;
  batch_size: number;
  method: 'inspector' | 'drag' | 'keyboard' | 'context_menu';
}

interface BinRotatedEvent {
  type: 'bin_rotated';
  old_size: string;
  new_size: string;
  batch_size: number;
}

// ============================================
// NEGATIVE SIGNAL EVENT TYPES
// ============================================

interface PlacementRejectedEvent {
  type: 'placement_rejected';
  rejection_reason: 'cancelled' | 'second_touch' | 'outside_bounds' | 'too_small';
  intended_size: string | null;
  intended_position: string | null;
  layer_index: number;
  drawer_size: string;
  fill_pct: number;
  mode: 'draw' | 'paint';
}

interface UndoEvent {
  type: 'undo';
  action_undone: 'placement' | 'deletion' | 'move' | 'resize' | 'fill' | 'layer_change' | 'drawer_resize' | 'other';
  bins_affected: number;
  time_since_action_ms: number;
  drawer_size: string;
}

interface QuickCorrectionEvent {
  type: 'quick_correction';
  correction_type: 'delete' | 'resize' | 'move';
  original_size: string;
  new_size: string | null;
  placement_method: 'draw' | 'fill' | 'duplicate' | 'staging' | 'paint';
  time_to_correction_ms: number;
  layer_index: number;
}

type MLTelemetryEvent =
  | BinPlacementEvent
  | LabelUpdateEvent
  | LayoutSnapshotEvent
  | LayoutQualityEvent
  | DrawerPurposeEvent
  | CategoryChangeEvent
  | BinResizeEvent
  | BinDeletedEvent
  | BinMovedEvent
  | DrawerResizedEvent
  | FillOperationEvent
  | LayerMoveEvent
  | BinRotatedEvent
  | PlacementRejectedEvent
  | UndoEvent
  | QuickCorrectionEvent;

// ============================================
// REDIS CONNECTION
// ============================================

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      connectTimeout: 5000,
      commandTimeout: 5000,
    });
  }
  return redis;
}

// ============================================
// RATE LIMITING
// ============================================

/**
 * Simple rate limiting using IP hash.
 * 100 requests per minute per IP.
 */
async function checkRateLimit(ip: string, client: Redis): Promise<boolean> {
  const hashedIP = hashIP(ip);
  const key = `ml_ratelimit:${hashedIP}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - 60;

  try {
    const count = await client.zcount(key, windowStart, '+inf');
    if (count >= 100) {
      return false;
    }

    const pipe = client.pipeline();
    pipe.zadd(key, now, `${now}-${Math.random()}`);
    pipe.zremrangebyscore(key, '-inf', windowStart);
    pipe.expire(key, 120);
    await pipe.exec();

    return true;
  } catch {
    // On error, allow the request
    return true;
  }
}

function hashIP(ip: string): string {
  let hash = 0;
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).slice(0, 8);
}

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
]);
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
const VALID_REJECTION_REASONS = new Set(['cancelled', 'second_touch', 'outside_bounds', 'too_small']);
const VALID_DRAW_MODES = new Set(['draw', 'paint']);
const VALID_UNDO_ACTIONS = new Set(['placement', 'deletion', 'move', 'resize', 'fill', 'layer_change', 'drawer_resize', 'other']);
const VALID_CORRECTION_TYPES = new Set(['delete', 'resize', 'move']);

// Pattern detection validation
const VALID_ARCHETYPES = new Set(['uniform', 'mixed', 'border_fill', 'compartmentalized', 'layered']);
const VALID_SPATIAL_PATTERNS = new Set(['corner_start', 'large_first', 'category_grouped', 'edge_aligned', 'center_out']);

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
 * Validate nullable string field used in Redis keys.
 * Returns true if null or matches the pattern.
 */
function validateNullableField(
  value: unknown,
  pattern: RegExp
): value is string | null {
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
function validateDistribution(
  value: unknown,
  keyPattern: RegExp
): value is Record<string, number> {
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

function validateEvent(event: unknown): event is MLTelemetryEvent {
  if (!event || typeof event !== 'object') return false;

  const e = event as Record<string, unknown>;

  if (e.type === 'bin_placed') {
    return (
      typeof e.bin_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.bin_size) &&
      (e.prev_bin_size === null ||
        (typeof e.prev_bin_size === 'string' &&
          VALID_BIN_SIZE_REGEX.test(e.prev_bin_size))) &&
      typeof e.drawer_size === 'string' &&
      VALID_DRAWER_SIZE_REGEX.test(e.drawer_size) &&
      typeof e.gap_fit === 'string' &&
      VALID_GAP_FIT.has(e.gap_fit) &&
      typeof e.method === 'string' &&
      VALID_METHODS.has(e.method) &&
      typeof e.session_index === 'number' &&
      e.session_index >= 0 &&
      e.session_index < 10000 &&
      // Security: Validate fields used in Redis keys
      validateNullableField(e.label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableField(e.label_normalized, VALID_NORMALIZED_LABEL_REGEX) &&
      validateNullableDomain(e.label_domain) &&
      typeof e.category_id === 'string' &&
      VALID_CATEGORY_ID_REGEX.test(e.category_id)
    );
  }

  if (e.type === 'label_updated') {
    return (
      typeof e.bin_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.bin_size) &&
      // Security: Validate fields used in Redis keys
      validateNullableField(e.old_label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableField(e.old_label_normalized, VALID_NORMALIZED_LABEL_REGEX) &&
      validateNullableField(e.new_label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableField(e.new_label_normalized, VALID_NORMALIZED_LABEL_REGEX) &&
      validateNullableDomain(e.new_label_domain)
    );
  }

  if (e.type === 'layout_snapshot') {
    return (
      typeof e.trigger === 'string' &&
      VALID_TRIGGERS.has(e.trigger) &&
      typeof e.layout_hash === 'string' &&
      VALID_LAYOUT_HASH_REGEX.test(e.layout_hash) &&
      typeof e.snapshot_index === 'number' &&
      e.snapshot_index >= 0 &&
      e.snapshot_index < 10000 &&
      typeof e.drawer_size === 'string' &&
      VALID_DRAWER_SIZE_REGEX.test(e.drawer_size) &&
      typeof e.layer_count === 'number' &&
      e.layer_count >= 0 &&
      e.layer_count <= 20 &&
      (e.purpose === null ||
        (typeof e.purpose === 'string' &&
          (VALID_PURPOSES.has(e.purpose) || VALID_PURPOSE_REGEX.test(e.purpose)))) &&
      typeof e.bin_count === 'number' &&
      e.bin_count >= 0 &&
      e.bin_count < 10000 &&
      validateSizeDistribution(e.size_distribution) &&
      validateDistribution(e.category_distribution, VALID_CATEGORY_ID_REGEX) &&
      validateDistribution(e.domain_distribution, /^[a-z_]+$/) &&
      validateLabelHashArray(e.top_label_hashes) &&
      typeof e.fill_percentage === 'number' &&
      e.fill_percentage >= 0 &&
      e.fill_percentage <= 100 &&
      typeof e.labeled_percentage === 'number' &&
      e.labeled_percentage >= 0 &&
      e.labeled_percentage <= 100 &&
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
      validateEdgeUsage(e.edge_usage)
    );
  }

  if (e.type === 'layout_quality') {
    return (
      typeof e.layout_hash === 'string' &&
      VALID_LAYOUT_HASH_REGEX.test(e.layout_hash) &&
      typeof e.signal === 'string' &&
      VALID_QUALITY_SIGNALS.has(e.signal) &&
      typeof e.days_since_creation === 'number' &&
      e.days_since_creation >= 0 &&
      e.days_since_creation < 10000
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
      typeof e.bin_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.bin_size) &&
      // Category name hash: 8-char hex (same format as label hashes)
      typeof e.category_name_hash === 'string' &&
      VALID_LABEL_HASH_REGEX.test(e.category_name_hash) &&
      typeof e.batch_size === 'number' &&
      e.batch_size > 0 &&
      e.batch_size < 1000 &&
      validateNullableField(e.label_hash, VALID_LABEL_HASH_REGEX) &&
      validateNullableDomain(e.label_domain)
    );
  }

  if (e.type === 'bin_resized') {
    const validDimensions = Array.isArray(e.dimensions_changed) &&
      e.dimensions_changed.length > 0 &&
      e.dimensions_changed.every((d: unknown) => d === 'width' || d === 'depth');
    return (
      typeof e.old_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.old_size) &&
      typeof e.new_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.new_size) &&
      validDimensions &&
      typeof e.batch_size === 'number' &&
      e.batch_size > 0 &&
      e.batch_size < 1000 &&
      typeof e.fill_pct === 'number' &&
      e.fill_pct >= 0 &&
      e.fill_pct <= 100
    );
  }

  if (e.type === 'bin_deleted') {
    return (
      typeof e.bin_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.bin_size) &&
      typeof e.position === 'string' &&
      VALID_POSITION_REGEX.test(e.position) &&
      typeof e.layer_index === 'number' &&
      e.layer_index >= 0 &&
      e.layer_index <= 20 &&
      typeof e.had_label === 'boolean' &&
      validateNullableDomain(e.label_domain) &&
      (e.age_ms === null || (typeof e.age_ms === 'number' && e.age_ms >= 0)) &&
      typeof e.batch_size === 'number' &&
      e.batch_size > 0 &&
      e.batch_size < 1000 &&
      typeof e.fill_pct === 'number' &&
      e.fill_pct >= 0 &&
      e.fill_pct <= 100 &&
      typeof e.method === 'string' &&
      VALID_DELETE_METHODS.has(e.method)
    );
  }

  if (e.type === 'bin_moved') {
    return (
      typeof e.bin_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.bin_size) &&
      typeof e.old_position === 'string' &&
      VALID_POSITION_REGEX.test(e.old_position) &&
      typeof e.new_position === 'string' &&
      VALID_POSITION_REGEX.test(e.new_position) &&
      typeof e.distance === 'number' &&
      e.distance >= 0 &&
      e.distance < 1000 &&
      typeof e.layer_index === 'number' &&
      e.layer_index >= 0 &&
      e.layer_index <= 20 &&
      typeof e.batch_size === 'number' &&
      e.batch_size > 0 &&
      e.batch_size < 1000 &&
      typeof e.method === 'string' &&
      VALID_MOVE_METHODS.has(e.method)
    );
  }

  if (e.type === 'drawer_resized') {
    const validDimensions = Array.isArray(e.dimensions_changed) &&
      e.dimensions_changed.length > 0 &&
      e.dimensions_changed.every((d: unknown) => d === 'width' || d === 'depth' || d === 'height');
    return (
      typeof e.old_size === 'string' &&
      VALID_DRAWER_SIZE_REGEX.test(e.old_size) &&
      typeof e.new_size === 'string' &&
      VALID_DRAWER_SIZE_REGEX.test(e.new_size) &&
      validDimensions &&
      typeof e.bins_staged === 'number' &&
      e.bins_staged >= 0 &&
      e.bins_staged < 10000 &&
      typeof e.fill_pct === 'number' &&
      e.fill_pct >= 0 &&
      e.fill_pct <= 100
    );
  }

  if (e.type === 'fill_operation') {
    return (
      typeof e.method === 'string' &&
      VALID_FILL_METHODS.has(e.method) &&
      (e.fill_size === null ||
        (typeof e.fill_size === 'string' && VALID_FILL_SIZE_REGEX.test(e.fill_size))) &&
      typeof e.bins_created === 'number' &&
      e.bins_created > 0 &&
      e.bins_created < 10000 &&
      typeof e.layer_index === 'number' &&
      e.layer_index >= 0 &&
      e.layer_index <= 20 &&
      typeof e.fill_pct === 'number' &&
      e.fill_pct >= 0 &&
      e.fill_pct <= 100 &&
      typeof e.drawer_size === 'string' &&
      VALID_DRAWER_SIZE_REGEX.test(e.drawer_size)
    );
  }

  if (e.type === 'layer_move') {
    return (
      typeof e.bin_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.bin_size) &&
      typeof e.from_layer_index === 'number' &&
      e.from_layer_index >= -1 && // -1 = staging
      e.from_layer_index <= 20 &&
      typeof e.to_layer_index === 'number' &&
      e.to_layer_index >= -1 && // -1 = staging
      e.to_layer_index <= 20 &&
      typeof e.batch_size === 'number' &&
      e.batch_size > 0 &&
      e.batch_size < 1000 &&
      typeof e.method === 'string' &&
      VALID_LAYER_MOVE_METHODS.has(e.method)
    );
  }

  if (e.type === 'bin_rotated') {
    return (
      typeof e.old_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.old_size) &&
      typeof e.new_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.new_size) &&
      typeof e.batch_size === 'number' &&
      e.batch_size > 0 &&
      e.batch_size < 1000
    );
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
        (typeof e.intended_position === 'string' && VALID_POSITION_REGEX.test(e.intended_position))) &&
      typeof e.layer_index === 'number' &&
      e.layer_index >= 0 &&
      e.layer_index <= 20 &&
      typeof e.drawer_size === 'string' &&
      VALID_DRAWER_SIZE_REGEX.test(e.drawer_size) &&
      typeof e.fill_pct === 'number' &&
      e.fill_pct >= 0 &&
      e.fill_pct <= 100 &&
      typeof e.mode === 'string' &&
      VALID_DRAW_MODES.has(e.mode)
    );
  }

  if (e.type === 'undo') {
    return (
      typeof e.action_undone === 'string' &&
      VALID_UNDO_ACTIONS.has(e.action_undone) &&
      typeof e.bins_affected === 'number' &&
      e.bins_affected >= 0 &&
      e.bins_affected < 10000 &&
      typeof e.time_since_action_ms === 'number' &&
      e.time_since_action_ms >= 0 &&
      typeof e.drawer_size === 'string' &&
      VALID_DRAWER_SIZE_REGEX.test(e.drawer_size)
    );
  }

  if (e.type === 'quick_correction') {
    return (
      typeof e.correction_type === 'string' &&
      VALID_CORRECTION_TYPES.has(e.correction_type) &&
      typeof e.original_size === 'string' &&
      VALID_BIN_SIZE_REGEX.test(e.original_size) &&
      (e.new_size === null ||
        (typeof e.new_size === 'string' && VALID_BIN_SIZE_REGEX.test(e.new_size))) &&
      typeof e.placement_method === 'string' &&
      VALID_METHODS.has(e.placement_method) &&
      typeof e.time_to_correction_ms === 'number' &&
      e.time_to_correction_ms >= 0 &&
      e.time_to_correction_ms < 600_000 && // Max 10 minutes
      typeof e.layer_index === 'number' &&
      e.layer_index >= 0 &&
      e.layer_index <= 20
    );
  }

  return false;
}

// ============================================
// AGGREGATION
// ============================================

interface Increments {
  [key: string]: { [field: string]: number };
}

function aggregateBinPlacement(event: BinPlacementEvent, inc: Increments): void {
  const { bin_size } = event;

  // 1. Global size frequency
  inc['ml:sizes'] = inc['ml:sizes'] || {};
  inc['ml:sizes'][bin_size] = (inc['ml:sizes'][bin_size] || 0) + 1;

  // 2. Transition matrix (if we have prev bin)
  if (event.prev_bin_size) {
    const transKey = `ml:trans:${event.prev_bin_size}`;
    inc[transKey] = inc[transKey] || {};
    inc[transKey][bin_size] = (inc[transKey][bin_size] || 0) + 1;
  }

  // 3. Drawer size correlation
  const drawerKey = `ml:drawer:${event.drawer_size}`;
  inc[drawerKey] = inc[drawerKey] || {};
  inc[drawerKey][bin_size] = (inc[drawerKey][bin_size] || 0) + 1;

  // 4. Label hash (PRIMARY - works for ANY language/domain)
  if (event.label_hash) {
    const hashKey = `ml:label_hash:${event.label_hash}`;
    inc[hashKey] = inc[hashKey] || {};
    inc[hashKey][bin_size] = (inc[hashKey][bin_size] || 0) + 1;

    // Track unknown hashes for vocabulary expansion
    if (!event.label_normalized) {
      inc['ml:unknown_hashes'] = inc['ml:unknown_hashes'] || {};
      inc['ml:unknown_hashes'][event.label_hash] =
        (inc['ml:unknown_hashes'][event.label_hash] || 0) + 1;
    }
  }

  // 5. Normalized label (ENRICHMENT - when vocabulary matches)
  if (event.label_normalized) {
    const labelKey = `ml:label:${event.label_normalized}`;
    inc[labelKey] = inc[labelKey] || {};
    inc[labelKey][bin_size] = (inc[labelKey][bin_size] || 0) + 1;
  }

  // 6. Label domain (FALLBACK - broader category)
  if (event.label_domain) {
    const domainKey = `ml:label_domain:${event.label_domain}`;
    inc[domainKey] = inc[domainKey] || {};
    inc[domainKey][bin_size] = (inc[domainKey][bin_size] || 0) + 1;
  }

  // 7. Category
  const catKey = `ml:cat:${event.category_id}`;
  inc[catKey] = inc[catKey] || {};
  inc[catKey][bin_size] = (inc[catKey][bin_size] || 0) + 1;

  // 8. Gap fit pattern
  const gapFitKey = `ml:gapfit:${event.gap_fit}`;
  inc[gapFitKey] = inc[gapFitKey] || {};
  inc[gapFitKey][bin_size] = (inc[gapFitKey][bin_size] || 0) + 1;

  // 9. Placement method
  const methodKey = `ml:method:${event.method}`;
  inc[methodKey] = inc[methodKey] || {};
  inc[methodKey][bin_size] = (inc[methodKey][bin_size] || 0) + 1;
}

function aggregateLabelUpdate(event: LabelUpdateEvent, inc: Increments): void {
  const { bin_size } = event;

  // Track new label associations
  if (event.new_label_hash) {
    const hashKey = `ml:label_hash:${event.new_label_hash}`;
    inc[hashKey] = inc[hashKey] || {};
    inc[hashKey][bin_size] = (inc[hashKey][bin_size] || 0) + 1;

    if (!event.new_label_normalized) {
      inc['ml:unknown_hashes'] = inc['ml:unknown_hashes'] || {};
      inc['ml:unknown_hashes'][event.new_label_hash] =
        (inc['ml:unknown_hashes'][event.new_label_hash] || 0) + 1;
    }
  }

  if (event.new_label_normalized) {
    const labelKey = `ml:label:${event.new_label_normalized}`;
    inc[labelKey] = inc[labelKey] || {};
    inc[labelKey][bin_size] = (inc[labelKey][bin_size] || 0) + 1;
  }

  if (event.new_label_domain) {
    const domainKey = `ml:label_domain:${event.new_label_domain}`;
    inc[domainKey] = inc[domainKey] || {};
    inc[domainKey][bin_size] = (inc[domainKey][bin_size] || 0) + 1;
  }
}

function aggregateLayoutSnapshot(event: LayoutSnapshotEvent, inc: Increments): void {
  const { drawer_size, trigger, purpose } = event;

  // 1. Track size distribution by drawer size
  for (const [size, count] of Object.entries(event.size_distribution)) {
    const drawerSizeKey = `ml:drawer_sizes:${drawer_size}`;
    inc[drawerSizeKey] = inc[drawerSizeKey] || {};
    inc[drawerSizeKey][size] = (inc[drawerSizeKey][size] || 0) + count;
  }

  // 2. Track domain distribution by drawer size
  for (const [domain, count] of Object.entries(event.domain_distribution)) {
    const domainKey = `ml:domains:${drawer_size}`;
    inc[domainKey] = inc[domainKey] || {};
    inc[domainKey][domain] = (inc[domainKey][domain] || 0) + count;
  }

  // 3. Build co-occurrence matrix from top label hashes
  // Track pairs of labels that appear together in the same layout
  const hashes = event.top_label_hashes;
  for (let i = 0; i < hashes.length; i++) {
    for (let j = i + 1; j < hashes.length; j++) {
      // Bidirectional: A→B and B→A
      const cooccurKeyA = `ml:cooccur:${hashes[i]}`;
      inc[cooccurKeyA] = inc[cooccurKeyA] || {};
      inc[cooccurKeyA][hashes[j]] = (inc[cooccurKeyA][hashes[j]] || 0) + 1;

      const cooccurKeyB = `ml:cooccur:${hashes[j]}`;
      inc[cooccurKeyB] = inc[cooccurKeyB] || {};
      inc[cooccurKeyB][hashes[i]] = (inc[cooccurKeyB][hashes[i]] || 0) + 1;
    }
  }

  // 4. Track snapshot trigger distribution
  inc['ml:triggers'] = inc['ml:triggers'] || {};
  inc['ml:triggers'][trigger] = (inc['ml:triggers'][trigger] || 0) + 1;

  // 5. Track purpose if set
  if (purpose) {
    inc['ml:purpose'] = inc['ml:purpose'] || {};
    inc['ml:purpose'][purpose] = (inc['ml:purpose'][purpose] || 0) + 1;

    // Track size distribution by purpose
    for (const [size, count] of Object.entries(event.size_distribution)) {
      const purposeSizeKey = `ml:purpose_sizes:${purpose}`;
      inc[purposeSizeKey] = inc[purposeSizeKey] || {};
      inc[purposeSizeKey][size] = (inc[purposeSizeKey][size] || 0) + count;
    }
  }

  // 6. Track fill percentage buckets (0-25%, 25-50%, 50-75%, 75-100%)
  const fillBucket = Math.min(Math.floor(event.fill_percentage / 25), 3);
  const fillKey = `ml:fill_bucket:${fillBucket}`;
  inc[fillKey] = inc[fillKey] || {};
  inc[fillKey][drawer_size] = (inc[fillKey][drawer_size] || 0) + 1;

  // 7. Track labeled percentage buckets
  const labeledBucket = Math.min(Math.floor(event.labeled_percentage / 25), 3);
  const labeledKey = `ml:labeled_bucket:${labeledBucket}`;
  inc[labeledKey] = inc[labeledKey] || {};
  inc[labeledKey][drawer_size] = (inc[labeledKey][drawer_size] || 0) + 1;

  // 8. Track quality tier distribution (for backend weighting)
  const { quality_tier } = event;
  inc['ml:quality_tier'] = inc['ml:quality_tier'] || {};
  inc['ml:quality_tier'][quality_tier] = (inc['ml:quality_tier'][quality_tier] || 0) + 1;

  // 9. Track size distribution by quality tier (high-quality layouts are better training data)
  if (quality_tier === 'high' || quality_tier === 'medium') {
    for (const [size, count] of Object.entries(event.size_distribution)) {
      const tierSizeKey = `ml:tier_sizes:${quality_tier}`;
      inc[tierSizeKey] = inc[tierSizeKey] || {};
      inc[tierSizeKey][size] = (inc[tierSizeKey][size] || 0) + count;
    }
  }

  // 10. Track layout archetype distribution
  const { archetype, spatial_patterns, uniformity_score, edge_usage } = event;
  inc['ml:archetype'] = inc['ml:archetype'] || {};
  inc['ml:archetype'][archetype] = (inc['ml:archetype'][archetype] || 0) + 1;

  // Track archetype by drawer size
  const archetypeDrawerKey = `ml:archetype:${drawer_size}`;
  inc[archetypeDrawerKey] = inc[archetypeDrawerKey] || {};
  inc[archetypeDrawerKey][archetype] = (inc[archetypeDrawerKey][archetype] || 0) + 1;

  // 11. Track spatial patterns
  for (const pattern of spatial_patterns) {
    inc['ml:patterns'] = inc['ml:patterns'] || {};
    inc['ml:patterns'][pattern] = (inc['ml:patterns'][pattern] || 0) + 1;

    // Track pattern co-occurrence with archetype
    const patternArchetypeKey = `ml:patterns:${archetype}`;
    inc[patternArchetypeKey] = inc[patternArchetypeKey] || {};
    inc[patternArchetypeKey][pattern] = (inc[patternArchetypeKey][pattern] || 0) + 1;
  }

  // 12. Track uniformity score buckets (0-0.25, 0.25-0.5, 0.5-0.75, 0.75-1.0)
  const uniformityBucket = Math.min(Math.floor(uniformity_score * 4), 3);
  inc['ml:uniformity'] = inc['ml:uniformity'] || {};
  inc['ml:uniformity'][`bucket_${uniformityBucket}`] = (inc['ml:uniformity'][`bucket_${uniformityBucket}`] || 0) + 1;

  // 13. Track edge usage patterns
  const edgeCount = [edge_usage.left, edge_usage.right, edge_usage.top, edge_usage.bottom].filter(Boolean).length;
  inc['ml:edge_count'] = inc['ml:edge_count'] || {};
  inc['ml:edge_count'][`edges_${edgeCount}`] = (inc['ml:edge_count'][`edges_${edgeCount}`] || 0) + 1;

  // Track specific edge combinations
  const edgeKey = `${edge_usage.left ? 'L' : ''}${edge_usage.right ? 'R' : ''}${edge_usage.top ? 'T' : ''}${edge_usage.bottom ? 'B' : ''}` || 'none';
  inc['ml:edge_combo'] = inc['ml:edge_combo'] || {};
  inc['ml:edge_combo'][edgeKey] = (inc['ml:edge_combo'][edgeKey] || 0) + 1;
}

function aggregateQualitySignal(event: LayoutQualityEvent, inc: Increments): void {
  const { signal } = event;

  // Track quality signal frequency
  inc['ml:quality'] = inc['ml:quality'] || {};
  inc['ml:quality'][signal] = (inc['ml:quality'][signal] || 0) + 1;

  // Track by age bucket (0-1 day, 1-7 days, 7-30 days, 30+ days)
  let ageBucket: string;
  if (event.days_since_creation <= 1) {
    ageBucket = 'day1';
  } else if (event.days_since_creation <= 7) {
    ageBucket = 'week1';
  } else if (event.days_since_creation <= 30) {
    ageBucket = 'month1';
  } else {
    ageBucket = 'older';
  }

  const ageKey = `ml:quality_age:${signal}`;
  inc[ageKey] = inc[ageKey] || {};
  inc[ageKey][ageBucket] = (inc[ageKey][ageBucket] || 0) + 1;
}

function aggregateDrawerPurpose(event: DrawerPurposeEvent, inc: Increments): void {
  const { purpose, is_custom } = event;

  // Track purpose frequency
  inc['ml:purpose'] = inc['ml:purpose'] || {};
  inc['ml:purpose'][purpose] = (inc['ml:purpose'][purpose] || 0) + 1;

  // Track custom vs predefined
  const customKey = is_custom ? 'custom' : 'predefined';
  inc['ml:purpose_type'] = inc['ml:purpose_type'] || {};
  inc['ml:purpose_type'][customKey] = (inc['ml:purpose_type'][customKey] || 0) + 1;
}

function aggregateCategoryChange(event: CategoryChangeEvent, inc: Increments): void {
  const { bin_size, category_name_hash, label_hash, label_domain } = event;

  // Track which bin sizes are assigned to which categories (by name hash)
  // Only custom categories reach here (defaults filtered client-side)
  const catSizeKey = `ml:cat_sizes:${category_name_hash}`;
  inc[catSizeKey] = inc[catSizeKey] || {};
  inc[catSizeKey][bin_size] = (inc[catSizeKey][bin_size] || 0) + 1;

  // Track label→category associations (helps learn what items go in what categories)
  if (label_hash) {
    const labelCatKey = `ml:label_cat:${label_hash}`;
    inc[labelCatKey] = inc[labelCatKey] || {};
    inc[labelCatKey][category_name_hash] = (inc[labelCatKey][category_name_hash] || 0) + 1;
  }

  // Track domain→category associations (broader pattern)
  if (label_domain) {
    const domainCatKey = `ml:domain_cat:${label_domain}`;
    inc[domainCatKey] = inc[domainCatKey] || {};
    inc[domainCatKey][category_name_hash] = (inc[domainCatKey][category_name_hash] || 0) + 1;
  }

  // Track total category change events
  inc['ml:cat_changes'] = inc['ml:cat_changes'] || {};
  inc['ml:cat_changes']['total'] = (inc['ml:cat_changes']['total'] || 0) + 1;
}

function aggregateBinResize(event: BinResizeEvent, inc: Increments): void {
  const { old_size, new_size, dimensions_changed } = event;

  // Track resize transitions (what sizes users resize to what)
  const resizeKey = `ml:resize:${old_size}`;
  inc[resizeKey] = inc[resizeKey] || {};
  inc[resizeKey][new_size] = (inc[resizeKey][new_size] || 0) + 1;

  // Track which dimensions are resized most often
  for (const dim of dimensions_changed) {
    inc['ml:resize_dims'] = inc['ml:resize_dims'] || {};
    inc['ml:resize_dims'][dim] = (inc['ml:resize_dims'][dim] || 0) + 1;
  }

  // Track total resize events
  inc['ml:resizes'] = inc['ml:resizes'] || {};
  inc['ml:resizes']['total'] = (inc['ml:resizes']['total'] || 0) + 1;

  // Track resulting sizes (what users resize to)
  inc['ml:resize_results'] = inc['ml:resize_results'] || {};
  inc['ml:resize_results'][new_size] = (inc['ml:resize_results'][new_size] || 0) + 1;
}

function aggregateBinDeletion(event: BinDeletedEvent, inc: Increments): void {
  const { bin_size, method, had_label, label_domain } = event;

  // Track deleted sizes (important negative signal - what users rejected)
  inc['ml:deleted_sizes'] = inc['ml:deleted_sizes'] || {};
  inc['ml:deleted_sizes'][bin_size] = (inc['ml:deleted_sizes'][bin_size] || 0) + 1;

  // Track deletion method distribution
  inc['ml:delete_methods'] = inc['ml:delete_methods'] || {};
  inc['ml:delete_methods'][method] = (inc['ml:delete_methods'][method] || 0) + 1;

  // Track whether deleted bins had labels (labeled bins being deleted may indicate bad ML suggestions)
  inc['ml:delete_labeled'] = inc['ml:delete_labeled'] || {};
  const labeledKey = had_label ? 'labeled' : 'unlabeled';
  inc['ml:delete_labeled'][labeledKey] = (inc['ml:delete_labeled'][labeledKey] || 0) + 1;

  // Track deleted bins by domain
  if (label_domain) {
    const domainKey = `ml:delete_domain:${label_domain}`;
    inc[domainKey] = inc[domainKey] || {};
    inc[domainKey][bin_size] = (inc[domainKey][bin_size] || 0) + 1;
  }

  // Track total deletions
  inc['ml:deletions'] = inc['ml:deletions'] || {};
  inc['ml:deletions']['total'] = (inc['ml:deletions']['total'] || 0) + 1;
}

function aggregateBinMove(event: BinMovedEvent, inc: Increments): void {
  const { bin_size, distance, method } = event;

  // Track moved sizes (helps understand position adjustment patterns)
  inc['ml:moved_sizes'] = inc['ml:moved_sizes'] || {};
  inc['ml:moved_sizes'][bin_size] = (inc['ml:moved_sizes'][bin_size] || 0) + 1;

  // Track move method distribution (drag vs nudge)
  inc['ml:move_methods'] = inc['ml:move_methods'] || {};
  inc['ml:move_methods'][method] = (inc['ml:move_methods'][method] || 0) + 1;

  // Track move distance buckets (short, medium, long moves)
  let distanceBucket: string;
  if (distance <= 1) {
    distanceBucket = 'micro'; // 1 cell or less
  } else if (distance <= 3) {
    distanceBucket = 'short'; // 2-3 cells
  } else if (distance < 10) {
    distanceBucket = 'medium'; // 4-9 cells
  } else {
    distanceBucket = 'long'; // 10+ cells (likely repositioning)
  }
  inc['ml:move_distances'] = inc['ml:move_distances'] || {};
  inc['ml:move_distances'][distanceBucket] = (inc['ml:move_distances'][distanceBucket] || 0) + 1;

  // Track total moves
  inc['ml:moves'] = inc['ml:moves'] || {};
  inc['ml:moves']['total'] = (inc['ml:moves']['total'] || 0) + 1;
}

function aggregateDrawerResize(event: DrawerResizedEvent, inc: Increments): void {
  const { old_size, new_size, dimensions_changed, bins_staged } = event;

  // Track resize transitions (what drawer sizes users resize to)
  const drawerResizeKey = `ml:drawer_resize:${old_size}`;
  inc[drawerResizeKey] = inc[drawerResizeKey] || {};
  inc[drawerResizeKey][new_size] = (inc[drawerResizeKey][new_size] || 0) + 1;

  // Track which dimensions are changed most often
  for (const dim of dimensions_changed) {
    inc['ml:drawer_resize_dims'] = inc['ml:drawer_resize_dims'] || {};
    inc['ml:drawer_resize_dims'][dim] = (inc['ml:drawer_resize_dims'][dim] || 0) + 1;
  }

  // Track how often bins are staged due to resize
  if (bins_staged > 0) {
    inc['ml:drawer_resize_staged'] = inc['ml:drawer_resize_staged'] || {};
    inc['ml:drawer_resize_staged']['with_bins'] = (inc['ml:drawer_resize_staged']['with_bins'] || 0) + 1;
  } else {
    inc['ml:drawer_resize_staged'] = inc['ml:drawer_resize_staged'] || {};
    inc['ml:drawer_resize_staged']['no_bins'] = (inc['ml:drawer_resize_staged']['no_bins'] || 0) + 1;
  }

  // Track total drawer resizes
  inc['ml:drawer_resizes'] = inc['ml:drawer_resizes'] || {};
  inc['ml:drawer_resizes']['total'] = (inc['ml:drawer_resizes']['total'] || 0) + 1;

  // Track resulting drawer sizes (what sizes users resize to)
  inc['ml:drawer_resize_results'] = inc['ml:drawer_resize_results'] || {};
  inc['ml:drawer_resize_results'][new_size] = (inc['ml:drawer_resize_results'][new_size] || 0) + 1;
}

function aggregateFillOperation(event: FillOperationEvent, inc: Increments): void {
  const { method, fill_size, bins_created, drawer_size } = event;

  // Track fill method distribution (uniform vs gaps)
  inc['ml:fill_methods'] = inc['ml:fill_methods'] || {};
  inc['ml:fill_methods'][method] = (inc['ml:fill_methods'][method] || 0) + 1;

  // Track which sizes users fill with (for uniform fill - strong preference signal!)
  if (fill_size) {
    inc['ml:fill_sizes'] = inc['ml:fill_sizes'] || {};
    inc['ml:fill_sizes'][fill_size] = (inc['ml:fill_sizes'][fill_size] || 0) + 1;

    // Track fill size by drawer size (size preferences depend on container)
    const fillByDrawerKey = `ml:fill_by_drawer:${drawer_size}`;
    inc[fillByDrawerKey] = inc[fillByDrawerKey] || {};
    inc[fillByDrawerKey][fill_size] = (inc[fillByDrawerKey][fill_size] || 0) + 1;
  }

  // Track bins created per fill (helps understand fill efficiency)
  const binsBucket = bins_created <= 10 ? 'small' :
    bins_created <= 50 ? 'medium' :
    bins_created <= 100 ? 'large' : 'xlarge';
  inc['ml:fill_bins'] = inc['ml:fill_bins'] || {};
  inc['ml:fill_bins'][binsBucket] = (inc['ml:fill_bins'][binsBucket] || 0) + 1;

  // Track total fill operations
  inc['ml:fills'] = inc['ml:fills'] || {};
  inc['ml:fills']['total'] = (inc['ml:fills']['total'] || 0) + 1;
}

function aggregateLayerMove(event: LayerMoveEvent, inc: Increments): void {
  const { bin_size, from_layer_index, to_layer_index, method } = event;

  // Track layer movement patterns (which layers users move bins between)
  const fromKey = from_layer_index === -1 ? 'staging' : `layer${from_layer_index}`;
  const toKey = to_layer_index === -1 ? 'staging' : `layer${to_layer_index}`;

  // Track from→to transitions
  const layerTransKey = `ml:layer_trans:${fromKey}`;
  inc[layerTransKey] = inc[layerTransKey] || {};
  inc[layerTransKey][toKey] = (inc[layerTransKey][toKey] || 0) + 1;

  // Track sizes moved between layers
  inc['ml:layer_moved_sizes'] = inc['ml:layer_moved_sizes'] || {};
  inc['ml:layer_moved_sizes'][bin_size] = (inc['ml:layer_moved_sizes'][bin_size] || 0) + 1;

  // Track layer move method distribution
  inc['ml:layer_move_methods'] = inc['ml:layer_move_methods'] || {};
  inc['ml:layer_move_methods'][method] = (inc['ml:layer_move_methods'][method] || 0) + 1;

  // Track staging in/out specifically (important for understanding stash usage)
  if (from_layer_index === -1) {
    inc['ml:staging_out'] = inc['ml:staging_out'] || {};
    inc['ml:staging_out'][toKey] = (inc['ml:staging_out'][toKey] || 0) + 1;
  }
  if (to_layer_index === -1) {
    inc['ml:staging_in'] = inc['ml:staging_in'] || {};
    inc['ml:staging_in'][fromKey] = (inc['ml:staging_in'][fromKey] || 0) + 1;
  }

  // Track total layer moves
  inc['ml:layer_moves'] = inc['ml:layer_moves'] || {};
  inc['ml:layer_moves']['total'] = (inc['ml:layer_moves']['total'] || 0) + 1;
}

function aggregateBinRotation(event: BinRotatedEvent, inc: Increments): void {
  const { old_size, new_size } = event;

  // Track rotation transitions (shows which sizes users rotate)
  const rotateKey = `ml:rotate:${old_size}`;
  inc[rotateKey] = inc[rotateKey] || {};
  inc[rotateKey][new_size] = (inc[rotateKey][new_size] || 0) + 1;

  // Track total rotations
  inc['ml:rotations'] = inc['ml:rotations'] || {};
  inc['ml:rotations']['total'] = (inc['ml:rotations']['total'] || 0) + 1;

  // Track rotated sizes (which sizes users rotate most)
  inc['ml:rotated_sizes'] = inc['ml:rotated_sizes'] || {};
  inc['ml:rotated_sizes'][old_size] = (inc['ml:rotated_sizes'][old_size] || 0) + 1;
}

// ============================================
// NEGATIVE SIGNAL AGGREGATION
// ============================================

/**
 * Aggregate placement rejection events (negative signal).
 * Tracks why users abandon draw/paint interactions.
 *
 * Redis keys:
 * - ml:rejections                     → Total rejection count by reason
 * - ml:reject_modes                   → Rejection count by draw/paint mode
 * - ml:reject_sizes                   → Intended sizes that were rejected (negative signal)
 * - ml:neg:reject_by_drawer:{size}    → Rejected sizes by drawer size (negative signal)
 */
function aggregatePlacementRejection(event: PlacementRejectedEvent, inc: Increments): void {
  const { rejection_reason, intended_size, mode, drawer_size } = event;

  // Track rejection reasons
  inc['ml:rejections'] = inc['ml:rejections'] || {};
  inc['ml:rejections'][rejection_reason] = (inc['ml:rejections'][rejection_reason] || 0) + 1;

  // Track by mode (draw vs paint)
  inc['ml:reject_modes'] = inc['ml:reject_modes'] || {};
  inc['ml:reject_modes'][mode] = (inc['ml:reject_modes'][mode] || 0) + 1;

  // Track rejected sizes (important negative signal - what users tried but abandoned)
  if (intended_size) {
    inc['ml:reject_sizes'] = inc['ml:reject_sizes'] || {};
    inc['ml:reject_sizes'][intended_size] = (inc['ml:reject_sizes'][intended_size] || 0) + 1;

    // Negative signal: size rejection by drawer size
    const negKey = `ml:neg:reject_by_drawer:${drawer_size}`;
    inc[negKey] = inc[negKey] || {};
    inc[negKey][intended_size] = (inc[negKey][intended_size] || 0) + 1;
  }

  // Track total rejections
  inc['ml:rejections']['total'] = (inc['ml:rejections']['total'] || 0) + 1;
}

/**
 * Aggregate undo events (negative signal).
 * Tracks what actions users regret and how quickly.
 *
 * Redis keys:
 * - ml:undos              → Total undo count by action type (negative signal)
 * - ml:undo_timing        → Undo timing buckets (immediate, quick, delayed)
 * - ml:undo_action_timing → Action + timing combos (e.g., placement_immediate)
 * - ml:undo_scale         → Distribution of undos by bins affected (single/few/many/bulk)
 */
function aggregateUndo(event: UndoEvent, inc: Increments): void {
  const { action_undone, bins_affected, time_since_action_ms } = event;

  // Track what actions get undone (strong negative signal)
  inc['ml:undos'] = inc['ml:undos'] || {};
  inc['ml:undos'][action_undone] = (inc['ml:undos'][action_undone] || 0) + 1;

  // Track timing buckets (how fast did user regret?)
  // Immediate: <2s, Quick: 2-10s, Delayed: >10s
  let timingBucket: string;
  if (time_since_action_ms < 2000) {
    timingBucket = 'immediate'; // Likely accidental or instant regret
  } else if (time_since_action_ms < 10000) {
    timingBucket = 'quick'; // Realized mistake quickly
  } else {
    timingBucket = 'delayed'; // Thought about it, then undid
  }
  inc['ml:undo_timing'] = inc['ml:undo_timing'] || {};
  inc['ml:undo_timing'][timingBucket] = (inc['ml:undo_timing'][timingBucket] || 0) + 1;

  // Track by action + timing (e.g., "placement_immediate" indicates bad auto-suggestion)
  const actionTimingKey = `${action_undone}_${timingBucket}`;
  inc['ml:undo_action_timing'] = inc['ml:undo_action_timing'] || {};
  inc['ml:undo_action_timing'][actionTimingKey] = (inc['ml:undo_action_timing'][actionTimingKey] || 0) + 1;

  // Track bins affected (bulk undos vs single-bin undos)
  const binsBucket = bins_affected <= 1 ? 'single' :
    bins_affected <= 5 ? 'few' :
    bins_affected <= 20 ? 'many' : 'bulk';
  inc['ml:undo_scale'] = inc['ml:undo_scale'] || {};
  inc['ml:undo_scale'][binsBucket] = (inc['ml:undo_scale'][binsBucket] || 0) + 1;

  // Track total undos
  inc['ml:undos']['total'] = (inc['ml:undos']['total'] || 0) + 1;
}

/**
 * Aggregate quick correction events (negative signal).
 * Tracks bins that were created then immediately changed/deleted.
 * This is the strongest negative signal - user explicitly rejected the result.
 *
 * Redis keys:
 * - ml:quick_corrections                 → Total quick correction count by type
 * - ml:neg:corrected_sizes               → Sizes that get quickly corrected (BAD sizes)
 * - ml:neg:correct_by_method:{method}    → Which placement methods produce corrections
 * - ml:correction_timing                 → How fast corrections happen
 * - ml:neg:resize_correct:{size}         → What users resize corrected bins to
 */
function aggregateQuickCorrection(event: QuickCorrectionEvent, inc: Increments): void {
  const { correction_type, original_size, new_size, placement_method, time_to_correction_ms } = event;

  // Track correction type (delete, resize, move)
  inc['ml:quick_corrections'] = inc['ml:quick_corrections'] || {};
  inc['ml:quick_corrections'][correction_type] = (inc['ml:quick_corrections'][correction_type] || 0) + 1;

  // STRONG NEGATIVE SIGNAL: Track which sizes get quickly corrected
  // These are sizes the model should NOT suggest
  inc['ml:neg:corrected_sizes'] = inc['ml:neg:corrected_sizes'] || {};
  inc['ml:neg:corrected_sizes'][original_size] = (inc['ml:neg:corrected_sizes'][original_size] || 0) + 1;

  // Track which placement methods produce quick corrections
  // High correction rate for a method = that method needs improvement
  const methodCorrKey = `ml:neg:correct_by_method:${placement_method}`;
  inc[methodCorrKey] = inc[methodCorrKey] || {};
  inc[methodCorrKey][correction_type] = (inc[methodCorrKey][correction_type] || 0) + 1;

  // Track correction timing
  // <5s = very quick (probably obvious mistake), 5-15s = quick, 15-30s = considered
  let timingBucket: string;
  if (time_to_correction_ms < 5000) {
    timingBucket = 'very_quick';
  } else if (time_to_correction_ms < 15000) {
    timingBucket = 'quick';
  } else {
    timingBucket = 'considered';
  }
  inc['ml:correction_timing'] = inc['ml:correction_timing'] || {};
  inc['ml:correction_timing'][timingBucket] = (inc['ml:correction_timing'][timingBucket] || 0) + 1;

  // For resize corrections, track the size transition (what user ACTUALLY wanted)
  if (correction_type === 'resize' && new_size) {
    const resizeCorrKey = `ml:neg:resize_correct:${original_size}`;
    inc[resizeCorrKey] = inc[resizeCorrKey] || {};
    inc[resizeCorrKey][new_size] = (inc[resizeCorrKey][new_size] || 0) + 1;
  }

  // Track total quick corrections
  inc['ml:quick_corrections']['total'] = (inc['ml:quick_corrections']['total'] || 0) + 1;
}

// ============================================
// HANDLER
// ============================================

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get Redis client
  const client = getRedis();
  if (!client) {
    // Silently accept if Redis not configured (dev mode)
    res.status(200).json({ ok: true, processed: 0 });
    return;
  }

  // Rate limiting
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    req.socket?.remoteAddress ||
    'unknown';

  const allowed = await checkRateLimit(ip, client);
  if (!allowed) {
    res.status(429).json({ error: 'Rate limit exceeded' });
    return;
  }

  // Parse body
  let events: unknown[];
  try {
    events = Array.isArray(req.body) ? req.body : [req.body];
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  // Limit batch size
  if (events.length > 100) {
    events = events.slice(0, 100);
  }

  // Validate and aggregate
  const increments: Increments = {};
  let validCount = 0;

  for (const event of events) {
    if (!validateEvent(event)) continue;
    validCount++;

    switch (event.type) {
      case 'bin_placed':
        aggregateBinPlacement(event, increments);
        break;
      case 'label_updated':
        aggregateLabelUpdate(event, increments);
        break;
      case 'layout_snapshot':
        aggregateLayoutSnapshot(event, increments);
        break;
      case 'layout_quality':
        aggregateQualitySignal(event, increments);
        break;
      case 'drawer_purpose':
        aggregateDrawerPurpose(event, increments);
        break;
      case 'category_changed':
        aggregateCategoryChange(event, increments);
        break;
      case 'bin_resized':
        aggregateBinResize(event, increments);
        break;
      case 'bin_deleted':
        aggregateBinDeletion(event, increments);
        break;
      case 'bin_moved':
        aggregateBinMove(event, increments);
        break;
      case 'drawer_resized':
        aggregateDrawerResize(event, increments);
        break;
      case 'fill_operation':
        aggregateFillOperation(event, increments);
        break;
      case 'layer_move':
        aggregateLayerMove(event, increments);
        break;
      case 'bin_rotated':
        aggregateBinRotation(event, increments);
        break;
      // Negative signal events
      case 'placement_rejected':
        aggregatePlacementRejection(event, increments);
        break;
      case 'undo':
        aggregateUndo(event, increments);
        break;
      case 'quick_correction':
        aggregateQuickCorrection(event, increments);
        break;
    }
  }

  if (validCount === 0) {
    res.status(200).json({ ok: true, processed: 0 });
    return;
  }

  // Write to Redis in single pipeline
  try {
    const pipe = client.pipeline();

    for (const [hash, fields] of Object.entries(increments)) {
      for (const [field, count] of Object.entries(fields)) {
        pipe.hincrby(hash, field, count);
      }
    }

    // Update metadata
    pipe.incrby('ml:meta:total_events', validCount);
    pipe.set('ml:meta:last_updated', new Date().toISOString());

    await pipe.exec();

    res.status(200).json({ ok: true, processed: validCount });
  } catch (error) {
    console.error('ML telemetry Redis error:', error);
    // Don't fail the request - telemetry should never break UX
    res.status(200).json({ ok: true, processed: 0, error: 'storage_error' });
  }
}
