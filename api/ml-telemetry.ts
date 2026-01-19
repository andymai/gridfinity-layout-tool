/**
 * ML Telemetry API Endpoint
 *
 * Receives batched telemetry events from clients and aggregates into Redis counters.
 * No raw events are stored - only aggregate counts for ML training.
 *
 * Redis Schema:
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

type MLTelemetryEvent = BinPlacementEvent | LabelUpdateEvent;

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

    if (event.type === 'bin_placed') {
      aggregateBinPlacement(event, increments);
    } else if (event.type === 'label_updated') {
      aggregateLabelUpdate(event, increments);
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
