/**
 * ML Telemetry API Endpoint
 *
 * Receives batched telemetry events from clients and aggregates into Redis counters.
 * No raw events are stored - only aggregate counts for ML training.
 *
 * Redis Schema:
 *
 * === Bin Placement (existing) ===
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
 * === Layout Snapshots (new) ===
 * - ml:drawer_sizes:{drawer}  → Bin size distribution by drawer size
 * - ml:domains:{drawer}       → Domain distribution by drawer size
 * - ml:cooccur:{hash}         → Label co-occurrence matrix
 * - ml:triggers               → Snapshot trigger distribution
 * - ml:purpose:{purpose}      → Drawer purpose frequency
 * - ml:purpose_sizes:{purpose} → Bin sizes by drawer purpose
 *
 * === Quality Signals (new) ===
 * - ml:quality:{signal}       → Quality signal counts
 * - ml:quality_layouts        → Layouts by quality signal type
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

type MLTelemetryEvent =
  | BinPlacementEvent
  | LabelUpdateEvent
  | LayoutSnapshotEvent
  | LayoutQualityEvent
  | DrawerPurposeEvent;

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
      VALID_QUALITY_TIERS.has(e.quality_tier)
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
