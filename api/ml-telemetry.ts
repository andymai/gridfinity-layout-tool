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
 * - ml:quality_confidence     → Confidence score distribution buckets
 * - ml:quality_conf_by_signal:{signal} → Confidence by signal type
 * - ml:quality_score:{score_name} → Individual score distributions (undo, completion, session, correction)
 * - ml:abandonment            → Abandonment type distribution (incomplete, deleted, dormant, superseded)
 * - ml:abandonment_age:{type} → Abandonment by layout age
 * - ml:quality_dormancy       → Time since last edit buckets (active, recent, idle, dormant)
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
 * - ml:neg:deleted_sizes      → Size distribution of deleted bins (negative signal)
 * - ml:neg:delete_methods     → Deletion method distribution (key/context_menu/bulk/inspector)
 * - ml:neg:delete_labeled     → Labeled vs unlabeled deletion rate
 * - ml:neg:delete_domain:{domain} → Deleted sizes by label domain
 * - ml:neg:deletions          → Total deletion event count
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
 * - ml:neg:undos              → Total undo count by action type
 * - ml:neg:undo_timing        → Undo timing buckets (immediate/quick/delayed)
 * - ml:neg:undo_action_timing → Action + timing combos (e.g., placement_immediate)
 * - ml:neg:undo_scale         → Undo scale (single/few/many/bulk bins)
 *
 * === Quick Corrections (Negative Signal - STRONGEST) ===
 * - ml:neg:quick_corrections  → Total quick correction count by type
 * - ml:neg:corrected_sizes    → Sizes that get quickly corrected (BAD sizes)
 * - ml:neg:correct_by_method:{method} → Corrections by placement method
 * - ml:neg:correction_timing  → How fast corrections happen
 * - ml:neg:resize_correct:{size} → What users resize corrected bins to
 *
 * === Session Summary ===
 * - ml:session:bins_placed    → Histogram of bins placed per session
 * - ml:session:edit_ratio     → Edit-to-done ratio buckets (zero/low/medium/high)
 * - ml:session:time_to_first  → Time to first bin buckets (quick/normal/slow/very_slow)
 * - ml:session:confidence     → Confidence score distribution
 * - ml:session:duration       → Session duration buckets
 * - ml:size_seq:{drawer}      → Common size sequences by drawer
 * - ml:session:undo_count     → Undo count distribution
 * - ml:session:conf_by_drawer:{size} → Confidence by drawer size
 * - ml:session:totals         → Total session counts
 *
 * === Temporal Patterns ===
 * - ml:temporal:hour:{hour}   → Activity by hour of day (0-23)
 * - ml:temporal:day:{day}     → Activity by day of week (0-6)
 * - ml:temporal:weekday       → Weekend vs weekday activity
 *
 * === Layout Clustering ===
 * - ml:clusters:{structure_hash} → Size distributions per structure cluster
 * - ml:cluster_archetypes:{hash} → Archetype correlations per cluster
 * - ml:cluster_distribution   → How common each structure hash is
 *
 * === Metadata ===
 * - ml:meta:*                 → Metadata counters
 * - ml:meta:validation:passed → Total events that passed validation
 * - ml:meta:validation:failed → Total events that failed validation
 * - ml:meta:validation:failed:{type} → Failed events by event type
 * - ml:meta:vocab_version:{version} → Events by vocabulary version
 * - ml:meta:client_version:{version} → Events by client version
 */

import { createHash } from 'crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from 'ioredis';
import type { RedisOptions } from 'ioredis';
import { getClientIP } from './lib/rateLimit.js';

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

interface LabelUpdateEvent {
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

type LayoutArchetype = 'uniform' | 'mixed' | 'border_fill' | 'compartmentalized' | 'layered';
type SpatialPattern =
  | 'corner_start'
  | 'large_first'
  | 'category_grouped'
  | 'edge_aligned'
  | 'center_out';

interface EdgeUsage {
  left: boolean;
  right: boolean;
  top: boolean;
  bottom: boolean;
}

interface LayoutSnapshotEvent {
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

interface ConfidenceBreakdown {
  undo_score: number;
  completion_score: number;
  session_score: number;
  correction_score: number;
  combined: number;
}

type AbandonmentType = 'incomplete' | 'deleted' | 'dormant' | 'superseded';

interface LayoutQualityEvent {
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
  resize_direction: 'grow' | 'shrink' | 'mixed';
  area_delta: number;
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

interface AbandonedBinEvent {
  type: 'bin_abandoned';
  bin_size: string;
  position: string;
  layer_index: number;
  lifetime_ms: number;
  creation_method: string;
  fill_pct: number;
  drawer_size: string;
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

interface QuickCorrectionEvent {
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

interface SessionSummaryEvent {
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

interface CrossLayoutPatternEvent {
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

type MLTelemetryEvent =
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

// ============================================
// REDIS CONNECTION
// ============================================

/**
 * Parse Redis URL using WHATWG URL API to avoid deprecated url.parse().
 * ioredis accepts URL strings but uses the legacy url.parse() internally.
 */
function parseRedisUrl(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 6379,
    password: url.password || undefined,
    username: url.username || undefined,
    tls: url.protocol === 'rediss:' ? {} : undefined,
    db: url.pathname ? parseInt(url.pathname.slice(1), 10) || 0 : 0,
  };
}

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    const urlConfig = parseRedisUrl(process.env.REDIS_URL);
    redis = new Redis({
      ...urlConfig,
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
 * Internal rate limiting for ML telemetry endpoint.
 * Uses the same Redis client as aggregation operations.
 * 100 requests per minute per IP.
 */
async function checkRateLimitInternal(ip: string, client: Redis): Promise<boolean> {
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
    // On error, deny the request (fail-closed, consistent with main rate limiter)
    return false;
  }
}

function hashIP(ip: string): string {
  return createHash('sha256').update(ip).digest('hex').slice(0, 16);
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

function validateEvent(event: unknown): event is MLTelemetryEvent {
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

// ============================================
// AGGREGATION
// ============================================

interface Increments {
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

function aggregateBinPlacement(event: BinPlacementEvent, inc: Increments): void {
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

function aggregateLabelUpdate(event: LabelUpdateEvent, inc: Increments): void {
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

function aggregateLayoutSnapshot(event: LayoutSnapshotEvent, inc: Increments): void {
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

function aggregateQualitySignal(event: LayoutQualityEvent, inc: Increments): void {
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

function aggregateDrawerPurpose(event: DrawerPurposeEvent, inc: Increments): void {
  const { purpose, is_custom } = event;

  // Track purpose frequency
  incr(inc, 'ml:purpose', purpose);

  // Track custom vs predefined
  const customKey = is_custom ? 'custom' : 'predefined';
  incr(inc, 'ml:purpose_type', customKey);
}

function aggregateCategoryChange(event: CategoryChangeEvent, inc: Increments): void {
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

function aggregateBinResize(event: BinResizeEvent, inc: Increments): void {
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
function aggregateBinDeletion(event: BinDeletedEvent, inc: Increments): void {
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
 * Distance is mapped to one of the buckets: `micro` (<=1), `short` (2–3), `medium` (4–9), or `long` (10+).
 *
 * @param event - The bin move event containing `bin_size`, `distance`, and `method`
 * @param inc - Mutable increments map that will be updated with counters to write to Redis
 */
function aggregateBinMove(event: BinMovedEvent, inc: Increments): void {
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

function aggregateDrawerResize(event: DrawerResizedEvent, inc: Increments): void {
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

function aggregateFillOperation(event: FillOperationEvent, inc: Increments): void {
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

function aggregateLayerMove(event: LayerMoveEvent, inc: Increments): void {
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

function aggregateBinRotation(event: BinRotatedEvent, inc: Increments): void {
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
 * - ml:rejections                     → Total rejection count by reason
 * - ml:reject_modes                   → Rejection count by draw/paint mode
 * - ml:reject_sizes                   → Intended sizes that were rejected (negative signal)
 * - ml:neg:reject_by_drawer:{size}    → Rejected sizes by drawer size (negative signal)
 */
function aggregatePlacementRejection(event: PlacementRejectedEvent, inc: Increments): void {
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
 * Timing buckets: `immediate` (< 2000 ms), `quick` (2000–9999 ms), `delayed` (>= 10000 ms).
 * Undo scale buckets: `single` (<=1), `few` (2–5), `many` (6–20), `bulk` (>20).
 *
 * @param event - The undo event; uses `action_undone`, `bins_affected`, and `time_since_action_ms`.
 * @param inc - Mutable increments map to update with counts keyed by Redis metric names.
 */
function aggregateUndo(event: UndoEvent, inc: Increments): void {
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
 * - ml:neg:quick_corrections             → Total quick correction count by type
 * - ml:neg:corrected_sizes               → Sizes that get quickly corrected (BAD sizes)
 * - ml:neg:correct_by_method:{method}    → Which placement methods produce corrections
 * - ml:neg:correction_timing             → How fast corrections happen
 * - ml:neg:resize_correct:{size}         → What users resize corrected bins to
 */
function aggregateQuickCorrection(event: QuickCorrectionEvent, inc: Increments): void {
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
 * - ml:neg:abandoned_sizes        → Sizes that get abandoned most
 * - ml:neg:abandoned_by_method    → Abandonment rate by creation method
 * - ml:neg:abandon_lifetime       → How long bins existed before being abandoned
 * - ml:neg:abandonment_total      → Total abandoned bins
 */
function aggregateBinAbandonment(event: AbandonedBinEvent, inc: Increments): void {
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
 * - ml:inferred_purpose:{drawer}      → Inferred purposes by drawer size
 * - ml:purpose_confidence             → Purpose confidence distribution
 * - ml:label_consistency              → Label-size consistency rates
 * - ml:user_patterns                  → Pattern count by user hash (for sampling)
 * - ml:cross_layout_total             → Total cross-layout events
 */
function aggregateCrossLayoutPattern(event: CrossLayoutPatternEvent, inc: Increments): void {
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
 * - ml:session:bins_placed           → Histogram of bins placed per session
 * - ml:session:edit_ratio            → Edit-to-done ratio buckets (low/medium/high)
 * - ml:session:time_to_first         → Time to first bin buckets
 * - ml:session:confidence            → Confidence score distribution
 * - ml:session:duration              → Session duration buckets
 * - ml:size_seq:{drawer}             → Common size sequences by drawer
 * - ml:session:totals                → Total session counts
 */
function aggregateSessionSummary(event: SessionSummaryEvent, inc: Increments): void {
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

// ============================================
// HANDLER
/**
 * HTTP POST handler for the ML telemetry ingestion endpoint.
 *
 * Validates and aggregates a batch of telemetry events, writing aggregated counters and metadata to Redis and returning a JSON summary of processed and failed events.
 *
 * Behavior:
 * - Only accepts POST; responds 405 for other methods.
 * - Applies a per-IP rate limit; responds 429 when exceeded.
 * - Accepts a JSON event or an array of events (batch capped at 100).
 * - Validates events, accumulates per-event-type failure counts, and tallies vocab/client versions from valid events.
 * - Writes aggregated counters and metadata (with appropriate TTLs) to Redis in a single pipeline.
 * - Responds 200 with { ok: true, processed, failed } on success.
 * - On Redis/storage errors responds 200 with { ok: true, processed: 0, error: 'storage_error' }.
 * - If Redis is not configured (development), responds 200 with { ok: true, processed: 0 }.
 *
 * @param req - Incoming VercelRequest containing the telemetry event(s)
 * @param res - VercelResponse used to send the JSON response
 */

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Get Redis client
  const client = getRedis();
  if (!client) {
    if (process.env.VERCEL_ENV === 'production') {
      console.warn('ml-telemetry: Redis unavailable in production, telemetry discarded');
    }
    res.status(200).json({ ok: true, processed: 0 });
    return;
  }

  // Rate limiting
  const ip = getClientIP(req);

  const allowed = await checkRateLimitInternal(ip, client);
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
  let failedCount = 0;
  const failedByType: Record<string, number> = {};
  const vocabVersions: Record<string, number> = {};
  const clientVersions: Record<string, number> = {};

  for (const event of events) {
    if (!validateEvent(event)) {
      failedCount++;
      // Track failures by event type (extract from potentially invalid event)
      const maybeType = (event as Record<string, unknown>).type;
      const eventType = typeof maybeType === 'string' ? maybeType : 'unknown';
      failedByType[eventType] = (failedByType[eventType] || 0) + 1;
      continue;
    }
    validCount++;

    // Track vocab version from events that have it
    if ('vocab_version' in event && typeof event.vocab_version === 'string') {
      vocabVersions[event.vocab_version] = (vocabVersions[event.vocab_version] || 0) + 1;
    }

    // Track client version from events
    if ('client_version' in event && typeof event.client_version === 'string') {
      clientVersions[event.client_version] = (clientVersions[event.client_version] || 0) + 1;
    }

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
      case 'bin_abandoned':
        aggregateBinAbandonment(event, increments);
        break;
      case 'session_summary':
        aggregateSessionSummary(event, increments);
        break;
      // Cross-layout learning
      case 'cross_layout_pattern':
        aggregateCrossLayoutPattern(event, increments);
        break;
    }
  }

  // Write to Redis even if validCount is 0 (to track failures)
  // Write to Redis in single pipeline
  try {
    const pipe = client.pipeline();

    for (const [hash, fields] of Object.entries(increments)) {
      if (!fields) continue;
      for (const [field, count] of Object.entries(fields)) {
        pipe.hincrby(hash, field, count);
      }

      // Add TTLs for keys that can grow unbounded (90 days)
      // These are lower-value or temporary data
      // Use NX flag to only set TTL on first creation, not reset on every write
      if (
        hash === 'ml:unknown_hashes' ||
        hash.startsWith('ml:size_seq:') ||
        hash.startsWith('ml:cooccur:')
      ) {
        pipe.expire(hash, 90 * 24 * 60 * 60, 'NX'); // 90 days, only if no TTL exists
      }
    }

    // Update metadata
    if (validCount > 0) {
      pipe.incrby('ml:meta:total_events', validCount);
    }
    pipe.set('ml:meta:last_updated', new Date().toISOString());

    // Track validation metrics
    if (validCount > 0) {
      pipe.incrby('ml:meta:validation:passed', validCount);
    }
    if (failedCount > 0) {
      pipe.incrby('ml:meta:validation:failed', failedCount);
      for (const [eventType, count] of Object.entries(failedByType)) {
        // Sanitize event type for Redis key (only allow alphanumeric and underscore)
        const safeType = eventType.replace(/[^a-z0-9_]/gi, '_').slice(0, 32) || 'unknown';
        pipe.hincrby('ml:meta:validation:failed_by_type', safeType, count);
      }
    }

    // Track vocab versions (90 day TTL for version tracking)
    for (const [version, count] of Object.entries(vocabVersions)) {
      const safeVersion = version.replace(/[^a-z0-9_.]/gi, '_').slice(0, 16) || 'unknown';
      pipe.hincrby('ml:meta:vocab_versions', safeVersion, count);
    }
    // Use NX flag to only set TTL on first creation, not reset on every write
    pipe.expire('ml:meta:vocab_versions', 90 * 24 * 60 * 60, 'NX');

    // Track client versions (90 day TTL for version tracking)
    for (const [version, count] of Object.entries(clientVersions)) {
      const safeVersion = version.replace(/[^a-z0-9_.]/gi, '_').slice(0, 16) || 'unknown';
      pipe.hincrby('ml:meta:client_versions', safeVersion, count);
    }
    // Use NX flag to only set TTL on first creation, not reset on every write
    pipe.expire('ml:meta:client_versions', 90 * 24 * 60 * 60, 'NX');

    await pipe.exec();

    res.status(200).json({ ok: true, processed: validCount, failed: failedCount });
  } catch (error) {
    console.error('ML telemetry Redis error:', error);
    // Don't fail the request - telemetry should never break UX
    res.status(200).json({ ok: true, processed: 0, error: 'storage_error' });
  }
}
